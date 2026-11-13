// Lưu dữ liệu trong một file JSON. Bộ đếm cập nhật trong RAM, ghi file gom lại mỗi 2 giây
// (ghi ra file tạm rồi rename để không hỏng file khi đang ghi).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_REQUESTS = 5000;
const MAX_EVENTS = 1000;
const DAILY_KEEP_DAYS = 90;
const SAVE_DELAY_MS = 2000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const emptyCounter = () => ({ input: 0, cached: 0, output: 0, requests: 0 });
const today = () => new Date().toISOString().slice(0, 10);

function defaults() {
  return {
    settings: {
      model: 'gpt-6-luna',
      reasoningEffort: 'none',
      // USD cho 1 triệu token; null = chưa đặt giá → không tính được $ và không chặn được theo $.
      prices: { input: null, cached_input: null, output: null },
    },
    keys: {},
    requests: [], // log request, mới nhất ở đầu
    events: [], // log thao tác quản trị, mới nhất ở đầu
  };
}

class Store {
  constructor(file) {
    this.file = file;
    this.timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const base = defaults();
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
    } else {
      this.data = base;
    }
    this.byHash = new Map(Object.values(this.data.keys).map((k) => [k.hash, k]));
    this.saveNow();
  }

  saveNow() {
    clearTimeout(this.timer);
    this.timer = null;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  save() {
    if (!this.timer) this.timer = setTimeout(() => this.saveNow(), SAVE_DELAY_MS);
  }

  // ---------- Giá ----------
  pricesReady() {
    const p = this.data.settings.prices;
    return [p.input, p.cached_input, p.output].every((v) => typeof v === 'number' && v >= 0);
  }

  // input ở đây là token vào KHÔNG cache; cached tính riêng.
  usdOf(c) {
    if (!this.pricesReady()) return 0;
    const p = this.data.settings.prices;
    return (c.input * p.input + c.cached * p.cached_input + c.output * p.output) / 1e6;
  }

  // ---------- Key con ----------
  createKey(name, usdLimit) {
    const token = `sk-tg-${crypto.randomBytes(24).toString('base64url')}`;
    const key = {
      id: `k_${crypto.randomBytes(6).toString('hex')}`,
      name,
      hash: hashToken(token),
      hint: `${token.slice(0, 9)}…${token.slice(-4)}`,
      createdAt: Date.now(),
      lastUsedAt: null,
      disabled: false,
      usdLimit,
      used: { ...emptyCounter(), since: Date.now() }, // từ lần reset gần nhất
      lifetime: emptyCounter(),
      daily: {}, // 'YYYY-MM-DD' -> counter
    };
    this.data.keys[key.id] = key;
    this.byHash.set(key.hash, key);
    this.save();
    return { key, token };
  }

  findByToken(token) {
    return token ? this.byHash.get(hashToken(token)) || null : null;
  }

  deleteKey(key) {
    delete this.data.keys[key.id];
    this.byHash.delete(key.hash);
    this.save();
  }

  resetKey(key) {
    key.used = { ...emptyCounter(), since: Date.now() };
    this.save();
  }

  // extraUsd: chi phí đã giữ chỗ cho request đang chạy / sắp chạy.
  isOverLimit(key, extraUsd = 0) {
    if (key.usdLimit == null || !this.pricesReady()) return false;
    const used = this.usdOf(key.used);
    return used >= key.usdLimit || (extraUsd > 0 && used + extraUsd > key.usdLimit);
  }

  recordUsage(key, t) {
    for (const c of [key.used, key.lifetime, this.dayBucket(key)]) {
      c.input += t.input;
      c.cached += t.cached;
      c.output += t.output;
      c.requests += 1;
    }
    key.lastUsedAt = Date.now();
    this.save();
  }

  dayBucket(key) {
    const d = today();
    if (!key.daily[d]) {
      key.daily[d] = emptyCounter();
      const days = Object.keys(key.daily).sort();
      days.slice(0, Math.max(0, days.length - DAILY_KEEP_DAYS)).forEach((old) => delete key.daily[old]);
    }
    return key.daily[d];
  }

  // ---------- Log ----------
  logRequest(entry) {
    this.data.requests.unshift({ at: Date.now(), ...entry });
    if (this.data.requests.length > MAX_REQUESTS) this.data.requests.length = MAX_REQUESTS;
    this.save();
  }

  addEvent(type, message, keyId) {
    this.data.events.unshift({ at: Date.now(), type, message, keyId: keyId || null });
    if (this.data.events.length > MAX_EVENTS) this.data.events.length = MAX_EVENTS;
    this.save();
  }
}

module.exports = Store;
