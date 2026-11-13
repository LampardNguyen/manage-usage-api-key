// API cho UI quản trị: đăng nhập, quản lý key con, nhật ký, cài đặt.
const crypto = require('crypto');
const express = require('express');
const config = require('./config');

const SESSION_TTL = 12 * 3600 * 1000;
const COOKIE = 'tg_admin';

function createAdminRouter(store) {
  const router = express.Router();
  const sessions = new Map(); // token -> hết hạn
  const failures = new Map(); // ip -> { count, lockedUntil }
  router.use(express.json({ limit: '100kb' }));

  // ---------- Đăng nhập ----------
  function readCookie(req) {
    for (const part of (req.headers.cookie || '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return decodeURIComponent(v.join('='));
    }
    return null;
  }

  function setCookie(res, value, maxAgeSec) {
    const attrs = [`${COOKIE}=${value}`, `Path=${config.basePath || '/'}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
    if (config.behindHttpsProxy) attrs.push('Secure');
    res.setHeader('Set-Cookie', attrs.join('; '));
  }

  function passwordMatches(input) {
    const a = crypto.createHash('sha256').update(String(input || '')).digest();
    const b = crypto.createHash('sha256').update(config.password).digest();
    return crypto.timingSafeEqual(a, b);
  }

  function isAuthed(req) {
    const token = readCookie(req);
    const exp = token && sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  router.post('/login', (req, res) => {
    const ip = req.ip;
    const f = failures.get(ip) || { count: 0, lockedUntil: 0 };
    if (f.lockedUntil > Date.now()) {
      return res.status(429).json({ error: `Sai quá nhiều lần, thử lại sau ${Math.ceil((f.lockedUntil - Date.now()) / 60000)} phút` });
    }
    if (!passwordMatches(req.body && req.body.password)) {
      f.count++;
      if (f.count >= 5) {
        f.lockedUntil = Date.now() + 15 * 60000;
        f.count = 0;
      }
      if (failures.size > 10000) failures.clear(); // chặn phình bộ nhớ
      failures.set(ip, f);
      return res.status(401).json({ error: 'Sai mật khẩu' });
    }
    failures.delete(ip);
    for (const [t, exp] of sessions) if (exp < Date.now()) sessions.delete(t);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    setCookie(res, token, SESSION_TTL / 1000);
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    sessions.delete(readCookie(req));
    setCookie(res, '', 0);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => res.json({ authed: isAuthed(req) }));
  router.use((req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'Chưa đăng nhập' })));

  // ---------- Hiển thị ----------
  function counterView(c) {
    return { input: c.input, cached: c.cached, output: c.output, tokens: c.input + c.cached + c.output, requests: c.requests, usd: store.usdOf(c) };
  }

  function keyView(k) {
    const used = counterView(k.used);
    const pct = k.usdLimit && store.pricesReady() ? (used.usd / k.usdLimit) * 100 : null;
    let status = 'ok';
    if (k.disabled) status = 'disabled';
    else if (store.isOverLimit(k)) status = 'over';
    else if (pct !== null && pct >= 80) status = 'warn';
    else if (k.usdLimit == null) status = 'unlimited';
    return {
      id: k.id,
      name: k.name,
      hint: k.hint,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      disabled: k.disabled,
      usdLimit: k.usdLimit,
      used: { ...used, since: k.used.since },
      lifetime: counterView(k.lifetime),
      pct,
      status,
    };
  }

  const keyName = (id) => (store.data.keys[id] ? store.data.keys[id].name : '(đã xoá)');
  const requestView = (r) => ({ ...r, keyName: keyName(r.keyId), usd: r.input != null ? store.usdOf(r) : null });

  function parseName(v) {
    const name = String(v || '').trim();
    if (!name || name.length > 60) return null;
    return name;
  }

  function parseLimit(v) {
    if (v === '' || v === null || v === undefined) return { value: null };
    const n = Number(v);
    if (!(n > 0)) return { error: 'Giới hạn $ phải lớn hơn 0 (bỏ trống = không giới hạn)' };
    return { value: n };
  }

  function findKey(req, res) {
    const id = req.params.id;
    const k = Object.prototype.hasOwnProperty.call(store.data.keys, id) ? store.data.keys[id] : null;
    if (!k) res.status(404).json({ error: 'Không tìm thấy key' });
    return k;
  }

  // ---------- Key con ----------
  router.get('/state', (req, res) => {
    const keys = Object.values(store.data.keys).map(keyView);
    res.json({
      keys,
      settings: { model: store.data.settings.model, reasoningEffort: store.data.settings.reasoningEffort },
      pricesReady: store.pricesReady(),
      endpoint: `${config.basePath}/v1`,
    });
  });

  router.post('/keys', (req, res) => {
    const name = parseName(req.body && req.body.name);
    if (!name) return res.status(400).json({ error: 'Tên key bắt buộc, tối đa 60 ký tự' });
    const limit = parseLimit(req.body && req.body.usdLimit);
    if (limit.error) return res.status(400).json({ error: limit.error });
    const { key, token } = store.createKey(name, limit.value);
    store.addEvent('key_created', `Tạo key "${name}"${limit.value ? `, giới hạn $${limit.value}` : ', không giới hạn'}`, key.id);
    res.json({ key: keyView(key), token });
  });

  router.get('/keys/:id', (req, res) => {
    const k = findKey(req, res);
    if (!k) return;
    const daily = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const c = k.daily[d] || { input: 0, cached: 0, output: 0, requests: 0 };
      daily.push({ date: d, ...counterView(c) });
    }
    res.json({
      key: keyView(k),
      daily,
      requests: store.data.requests.filter((r) => r.keyId === k.id).slice(0, 50).map(requestView),
      events: store.data.events.filter((e) => e.keyId === k.id).slice(0, 50),
    });
  });

  router.patch('/keys/:id', (req, res) => {
    const k = findKey(req, res);
    if (!k) return;
    const b = req.body || {};
    const changes = [];
    if (b.name !== undefined) {
      const name = parseName(b.name);
      if (!name) return res.status(400).json({ error: 'Tên key bắt buộc, tối đa 60 ký tự' });
      if (name !== k.name) changes.push(`đổi tên "${k.name}" → "${name}"`);
      k.name = name;
    }
    if (b.usdLimit !== undefined) {
      const limit = parseLimit(b.usdLimit);
      if (limit.error) return res.status(400).json({ error: limit.error });
      if (limit.value !== k.usdLimit) changes.push(`giới hạn ${limit.value ? `$${limit.value}` : 'không giới hạn'}`);
      k.usdLimit = limit.value;
    }
    if (b.disabled !== undefined && !!b.disabled !== k.disabled) {
      k.disabled = !!b.disabled;
      changes.push(k.disabled ? 'khoá key' : 'mở khoá key');
    }
    if (changes.length) store.addEvent('key_updated', `Key "${k.name}": ${changes.join(', ')}`, k.id);
    store.save();
    res.json({ key: keyView(k) });
  });

  router.post('/keys/:id/reset', (req, res) => {
    const k = findKey(req, res);
    if (!k) return;
    const before = counterView(k.used);
    store.resetKey(k);
    store.addEvent(
      'key_reset',
      `Reset bộ đếm key "${k.name}" (trước đó: ${before.tokens.toLocaleString('en-US')} token, ~$${before.usd.toFixed(4)}, ${before.requests} request)`,
      k.id
    );
    res.json({ key: keyView(k) });
  });

  router.delete('/keys/:id', (req, res) => {
    const k = findKey(req, res);
    if (!k) return;
    if ((req.body && req.body.confirmName) !== k.name) return res.status(400).json({ error: 'Tên xác nhận không khớp' });
    store.deleteKey(k);
    store.addEvent('key_deleted', `Xoá key "${k.name}"`, k.id);
    res.json({ ok: true });
  });

  // ---------- Nhật ký ----------
  router.get('/requests', (req, res) => {
    const { keyId, errorsOnly } = req.query;
    let list = store.data.requests;
    if (keyId) list = list.filter((r) => r.keyId === keyId);
    if (errorsOnly === '1') list = list.filter((r) => r.status !== 200);
    res.json(list.slice(0, 500).map(requestView));
  });

  router.get('/events', (req, res) => {
    res.json(store.data.events.slice(0, 500).map((e) => ({ ...e, keyName: e.keyId ? keyName(e.keyId) : null })));
  });

  // ---------- Cài đặt ----------
  router.get('/settings', (req, res) => res.json(store.data.settings));

  router.put('/settings', (req, res) => {
    const b = req.body || {};
    const model = String(b.model || '').trim();
    if (!model) return res.status(400).json({ error: 'Model bắt buộc' });
    const reasoningEffort = String(b.reasoningEffort || '').trim();
    const prices = {};
    for (const f of ['input', 'cached_input', 'output']) {
      const v = b.prices && b.prices[f];
      if (v === '' || v === null || v === undefined) prices[f] = null;
      else if (Number(v) >= 0) prices[f] = Number(v);
      else return res.status(400).json({ error: `Giá ${f} không hợp lệ` });
    }
    const s = store.data.settings;
    const changes = [];
    if (s.model !== model) changes.push(`model ${model}`);
    if (s.reasoningEffort !== reasoningEffort) changes.push(`reasoning effort "${reasoningEffort || '(không gửi)'}"`);
    if (JSON.stringify(s.prices) !== JSON.stringify(prices)) {
      changes.push(`giá in/cached/out = ${prices.input}/${prices.cached_input}/${prices.output}`);
    }
    Object.assign(s, { model, reasoningEffort, prices });
    if (changes.length) store.addEvent('settings_changed', `Cập nhật cài đặt: ${changes.join(', ')}`);
    store.save();
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAdminRouter };
