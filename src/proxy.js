// Proxy tương thích OpenAI: chỉ mở POST /v1/chat/completions.
const http = require('http');
const https = require('https');
const { URL } = require('url');
const express = require('express');
const config = require('./config');

function oaError(res, status, message, type, code) {
  res.status(status).json({ error: { message, type, param: null, code } });
}

// Gửi request tới OpenAI bằng key chung (module https có sẵn, Node 16 chưa có fetch).
function callUpstream(payload) {
  const url = new URL(`${config.upstreamUrl}/chat/completions`);
  const body = JSON.stringify(payload);
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openaiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: config.upstreamTimeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('OpenAI không phản hồi kịp (timeout)'), { timedOut: true })));
    req.on('error', reject);
    req.end(body);
  });
}

// Trần chi phí cho MỘT request (chặn client tự đặt n / max tokens khổng lồ).
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS) || 16000;
const MAX_N = 4;

function createProxyRouter(store) {
  const router = express.Router();
  const inflight = new Map(); // keyId -> $ đã giữ chỗ cho các request đang chạy
  const windows = new Map(); // keyId -> { start, count } — cửa sổ 1 phút cho rate limit

  // Trả về số giây cần chờ nếu key đã vượt rate limit, ngược lại 0.
  function rateLimited(keyId) {
    if (!(config.rateLimitPerMin > 0)) return 0;
    const now = Date.now();
    let w = windows.get(keyId);
    if (!w || now - w.start >= 60000) {
      w = { start: now, count: 0 };
      windows.set(keyId, w);
    }
    if (w.count >= config.rateLimitPerMin) return Math.ceil((w.start + 60000 - now) / 1000);
    w.count++;
    return 0;
  }

  router.post('/chat/completions', express.json({ limit: '2mb' }), async (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const key = store.findByToken(token);
    if (!key) return oaError(res, 401, 'Invalid API key.', 'invalid_request_error', 'invalid_api_key');
    if (key.disabled) return oaError(res, 403, 'This API key has been disabled.', 'invalid_request_error', 'key_disabled');
    // Không ghi log request bị chặn vì rate limit để không đẩy trôi nhật ký thật.
    const wait = rateLimited(key.id);
    if (wait) {
      res.set('Retry-After', String(wait));
      return oaError(res, 429, `Rate limit reached: ${config.rateLimitPerMin} requests per minute for this API key. Try again in ${wait}s.`, 'requests', 'rate_limit_exceeded');
    }
    if (store.isOverLimit(key, inflight.get(key.id) || 0)) {
      store.logRequest({ keyId: key.id, status: 429, ms: 0, error: 'quota_exceeded' });
      return oaError(res, 429, 'This API key has exceeded its usage limit. Contact the administrator to reset it.', 'insufficient_quota', 'quota_exceeded');
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return oaError(res, 400, 'Request body must be a JSON object.', 'invalid_request_error', 'invalid_body');
    }
    if (body.stream) {
      return oaError(res, 400, 'Streaming is not supported by this endpoint.', 'invalid_request_error', 'stream_not_supported');
    }

    // Ép model và reasoning effort theo Cài đặt, bất kể client gửi gì.
    const { model, reasoningEffort } = store.data.settings;
    const payload = { ...body, model };
    if (reasoningEffort) payload.reasoning_effort = reasoningEffort;
    else delete payload.reasoning_effort;
    // Tham số làm tăng chi phí: giới hạn trần, bỏ service_tier (giá khác bảng giá đã cấu hình).
    const n = Math.min(Math.max(1, Math.floor(Number(body.n)) || 1), MAX_N);
    const maxOut = Math.min(Math.floor(Number(body.max_completion_tokens || body.max_tokens)) || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);
    if (n > 1) payload.n = n; else delete payload.n;
    payload.max_completion_tokens = maxOut;
    delete payload.max_tokens;
    delete payload.service_tier;

    // Giữ chỗ chi phí tối đa trước khi gọi OpenAI → request song song không vượt được giới hạn.
    // Số byte của body là cận trên thô của token vào (không áp dụng cho ảnh qua URL).
    const worst = { input: Buffer.byteLength(JSON.stringify(payload)), cached: 0, output: maxOut * n };
    const reserved = store.usdOf(worst);
    const pending = inflight.get(key.id) || 0;
    if (store.isOverLimit(key, pending + reserved)) {
      store.logRequest({ keyId: key.id, status: 429, ms: 0, error: 'quota_exceeded' });
      return oaError(res, 429, 'This API key has exceeded its usage limit. Contact the administrator to reset it.', 'insufficient_quota', 'quota_exceeded');
    }
    inflight.set(key.id, pending + reserved);
    const release = () => {
      const left = (inflight.get(key.id) || 0) - reserved;
      if (left > 1e-12) inflight.set(key.id, left);
      else inflight.delete(key.id);
    };

    const started = Date.now();
    let up;
    try {
      up = await callUpstream(payload);
    } catch (err) {
      release();
      // Timeout: OpenAI có thể vẫn xử lý và tính tiền → ghi nhận chi phí tối đa đã giữ chỗ (ước tính).
      if (err.timedOut) store.recordUsage(key, worst);
      store.logRequest({ keyId: key.id, status: 502, ms: Date.now() - started, error: err.message, ...(err.timedOut ? worst : {}) });
      return oaError(res, 502, err.timedOut ? 'Upstream timeout.' : 'Upstream error.', 'api_error', 'upstream_error');
    }
    release();

    const entry = { keyId: key.id, status: up.status, ms: Date.now() - started };
    let json = null;
    try {
      json = JSON.parse(up.body);
    } catch (e) {
      // body không phải JSON — trả nguyên cho client
    }
    if (up.status === 200 && json && json.usage) {
      const u = json.usage;
      const cached = Math.min((u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || 0, u.prompt_tokens || 0);
      const t = { input: (u.prompt_tokens || 0) - cached, cached, output: u.completion_tokens || 0 };
      store.recordUsage(key, t);
      Object.assign(entry, t);
    } else if (up.status !== 200) {
      entry.error = (json && json.error && (json.error.code || json.error.message)) || `HTTP ${up.status}`;
    }
    store.logRequest(entry);

    // Không để lộ organization id của key chung trong thông báo lỗi OpenAI.
    const out = up.status === 200 ? up.body : up.body.replace(/org-[A-Za-z0-9]+/g, 'org-***');
    res.status(up.status).type('application/json').send(out);
  });

  router.all('*', (req, res) =>
    oaError(res, 404, `Endpoint ${req.method} ${req.originalUrl} is not supported. Only POST /chat/completions is available.`, 'invalid_request_error', 'not_found')
  );

  // Lỗi parse JSON của express.json → trả theo format OpenAI.
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    const status = err.status || 400;
    oaError(res, status, status === 413 ? 'Request body too large.' : 'Invalid JSON body.', 'invalid_request_error', 'invalid_body');
  });

  return router;
}

module.exports = { createProxyRouter };
