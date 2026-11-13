// Server giả lập OpenAI /v1/chat/completions để chạy thử proxy mà không tốn tiền.
// Chạy: npm run mock   rồi đặt OPENAI_BASE_URL=http://localhost:4010/v1 trong .env
const http = require('http');

const PORT = Number(process.env.MOCK_PORT) || 4010;

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (!(req.headers.authorization || '').startsWith('Bearer ')) {
        return send(res, 401, { error: { message: 'missing key', type: 'invalid_request_error', code: 'invalid_api_key' } });
      }
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        return send(res, 404, { error: { message: 'not found' } });
      }
      const body = JSON.parse(raw || '{}');
      console.log(`model=${body.model} reasoning_effort=${body.reasoning_effort} messages=${(body.messages || []).length}`);
      const text = (body.messages || []).map((m) => m.content).join(' ');
      if (text.includes('FAIL')) {
        return send(res, 400, { error: { message: 'Mock lỗi theo yêu cầu', type: 'invalid_request_error', code: 'mock_error' } });
      }
      const prompt = 1000 + text.length;
      const cached = text.includes('CACHE') ? 500 : 0;
      const completion = 400;
      // Client gửi mảng JSON các chuỗi (kiểu TScreen) → trả mảng cùng độ dài.
      const last = (body.messages || []).slice(-1)[0] || {};
      let content = `[bản dịch giả lập] ${text.slice(0, 80)}`;
      try {
        const arr = JSON.parse(last.content);
        if (Array.isArray(arr)) content = JSON.stringify(arr.map((s) => `[dịch] ${s}`));
      } catch (e) {
        // không phải mảng JSON
      }
      send(res, 200, {
        id: `chatcmpl-mock${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: prompt,
          completion_tokens: completion,
          total_tokens: prompt + completion,
          prompt_tokens_details: { cached_tokens: cached },
          completion_tokens_details: { reasoning_tokens: 0 },
        },
      });
    });
  })
  .listen(PORT, () => console.log(`Mock OpenAI tại http://localhost:${PORT}/v1/chat/completions`));
