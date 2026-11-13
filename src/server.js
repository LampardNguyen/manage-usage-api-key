const path = require('path');
const express = require('express');
const config = require('./config');
const Store = require('./store');
const { createProxyRouter } = require('./proxy');
const { createAdminRouter } = require('./admin');

const store = new Store(config.dataFile);
const app = express();
app.disable('x-powered-by');
if (config.behindHttpsProxy) app.set('trust proxy', 1);

// Express so khớp route không phân biệt hoa/thường, còn <Location> của Apache thì có →
// /openai-custom/ADMIN/... lọt qua giới hạn IP của Apache. Mọi path hợp lệ đều viết thường.
app.use((req, res, next) => (req.path !== req.path.toLowerCase() ? res.status(404).end() : next()));

const base = express.Router();
base.get('/health', (req, res) => res.json({ ok: true }));
base.use('/v1', createProxyRouter(store));
base.use('/admin/api', createAdminRouter(store));

const alpinePath = require.resolve('alpinejs/dist/cdn.min.js');
base.get('/admin/vendor/alpine.js', (req, res) => res.sendFile(alpinePath));
base.get('/admin', (req, res, next) => (req.originalUrl.endsWith('/') ? next() : res.redirect(`${config.basePath}/admin/`)));
base.use('/admin', express.static(path.join(__dirname, '..', 'web')));

app.use(config.basePath || '/', base);

// Lỗi chưa xử lý (vd. JSON hỏng gửi tới /admin/api/login) → không trả stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Lỗi máy chủ' : 'Request không hợp lệ' });
});

// Chỉ nghe trên loopback: mọi truy cập phải đi qua Apache (HTTPS, X-Forwarded-For tin cậy, giới hạn IP).
const server = app.listen(config.port, config.host, () => {
  console.log(`Proxy:   http://localhost:${config.port}${config.basePath}/v1/chat/completions`);
  console.log(`Quản trị: http://localhost:${config.port}${config.basePath}/admin/`);
  if (!store.pricesReady()) console.log('CẢNH BÁO: chưa đặt giá model → chưa tính được $ và chưa chặn được theo giới hạn $.');
});

// Ghi dữ liệu còn trong RAM trước khi tắt (Ctrl+C trong screen, hoặc kill).
function shutdown() {
  store.saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
