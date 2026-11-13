const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const basePath = ('/' + (process.env.BASE_PATH || '/openai-custom').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');

const config = {
  openaiKey: process.env.OPENAI_API_KEY || '',
  upstreamUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  password: process.env.ADMIN_PASSWORD || '',
  port: Number(process.env.PORT) || 3005,
  host: process.env.HOST || '127.0.0.1',
  basePath, // vd. "/openai-custom" (chuỗi rỗng nếu chạy ở gốc)
  behindHttpsProxy: process.env.BEHIND_HTTPS_PROXY === 'true',
  upstreamTimeoutMs: (Number(process.env.UPSTREAM_TIMEOUT_SEC) || 120) * 1000,
  // Số request tối đa / phút cho mỗi key con; 0 = tắt.
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 60) >= 0 ? Number(process.env.RATE_LIMIT_PER_MIN || 60) : 60,
  dataFile: path.resolve(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json')),
};

const missing = [];
if (!config.openaiKey) missing.push('OPENAI_API_KEY');
if (!config.password) missing.push('ADMIN_PASSWORD');
if (missing.length) {
  console.error(`Thiếu biến môi trường: ${missing.join(', ')}. Sao chép .env.example thành .env rồi điền vào.`);
  process.exit(1);
}

module.exports = config;
