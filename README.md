# Key Guard — OpenAI proxy with spending-capped sub-keys

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-16.15.1-green.svg)](.nvmrc)

**English** | [Tiếng Việt](README.vi.md)

You have **one** shared OpenAI API key. Key Guard sits in front of it, issues many **sub-keys** (`sk-tg-…`) to your
apps, counts each sub-key's input/output tokens, and blocks a sub-key once it reaches its USD limit.

```
App A ──(sk-tg-…)──▶ https://your-domain.example/openai-custom/v1/chat/completions ──(shared key)──▶ api.openai.com
```

## Features

- **OpenAI-compatible** — clients only change the **base URL** and **API key**; request/response format is unchanged.
- **Per-key USD limits** — cost is estimated from the `usage` field OpenAI returns × the prices you configure.
- **Forced model settings** — `model` (default `gpt-6-luna`) and `reasoning_effort` (default `none`) are always
  overridden from Settings, whatever the client sends.
- **Admin UI** — create / lock / reset / delete keys, 31-day usage chart, request log, audit log. No build step
  (plain HTML + Alpine.js).
- **Hashed keys** — only a hash of each sub-key is stored; leaking `data/db.json` does not reveal the keys.
- **Zero database** — data lives in a single JSON file, flushed every 2 seconds.

### Limitations

- Only `POST /v1/chat/completions` is exposed; every other path returns 404.
- **Streaming is not supported** (`stream: true` is rejected).
- No automatic reset period: counters accumulate until an admin clicks **Reset counter** for a key.
- The limit is checked **before** each request, so the last request may overshoot the limit slightly.

## Quick start

Requires **Node.js 16.15.1** (pinned in `.nvmrc` and `package.json`).

```bash
git clone https://github.com/LampardNguyen/manage-usage-api-key.git
cd manage-usage-api-key
npm install
cp .env.example .env   # then fill in OPENAI_API_KEY and ADMIN_PASSWORD
npm start
```

Open `http://localhost:3005/openai-custom/admin/` and sign in with `ADMIN_PASSWORD`.

### Configuration

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | The real, shared OpenAI key | — (required) |
| `ADMIN_PASSWORD` | Admin UI password | — (required) |
| `PORT` | Listening port | `3005` |
| `BASE_PATH` | URL prefix, must match your reverse proxy | `/openai-custom` |
| `BEHIND_HTTPS_PROXY` | `true` when running behind an HTTPS reverse proxy (secure cookies, real client IP) | `false` |
| `UPSTREAM_TIMEOUT_SEC` | Timeout waiting for OpenAI | `120` |
| `RATE_LIMIT_PER_MIN` | Max requests per minute per sub-key (`0` = off) | `60` |
| `DATA_FILE` | Data file location | `./data/db.json` |
| `OPENAI_BASE_URL` | Upstream base URL (use for the mock server) | `https://api.openai.com/v1` |

## Usage

1. In the admin UI go to **Settings** and enter the **model prices** (USD per 1M tokens: input, cached input, output).
   Until prices are set, cost cannot be computed and keys **cannot be blocked** by their USD limit.
2. **Keys → + Create key**: set a name and a USD limit. The key is shown **only once** — copy it right away.
3. Point your app at the proxy:

```bash
curl https://your-domain.example/openai-custom/v1/chat/completions \
  -H "Authorization: Bearer sk-tg-..." \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Translate to English: Xin chào"}]}'
```

With an OpenAI SDK: `baseURL = "https://your-domain.example/openai-custom/v1"`, `apiKey = "sk-tg-..."`.

### Error responses (OpenAI format)

| HTTP | `error.code` | When |
|---|---|---|
| 401 | `invalid_api_key` | Sub-key is wrong or deleted |
| 403 | `key_disabled` | Sub-key is locked |
| 429 | `quota_exceeded` | Usage ≥ USD limit — wait for an admin reset |
| 429 | `rate_limit_exceeded` | Sub-key exceeded `RATE_LIMIT_PER_MIN` requests/minute — retry after the `Retry-After` header |
| 400 | `stream_not_supported` / `invalid_body` | `stream: true` or malformed JSON |
| 502 | `upstream_error` | Could not reach OpenAI |
| other | (from OpenAI) | OpenAI errors are passed through and **not** counted |

## Deployment

### Apache reverse proxy

See [`deploy/apache-openai-custom.conf`](deploy/apache-openai-custom.conf). Add it to your HTTPS `VirtualHost`,
enable `proxy proxy_http headers`, and reload Apache. Endpoints:

- Proxy: `https://your-domain.example/openai-custom/v1/chat/completions`
- Admin: `https://your-domain.example/openai-custom/admin/`
- Health check: `https://your-domain.example/openai-custom/health`

Restricting the admin UI by IP is strongly recommended (optional block at the end of the sample file).

### Running with `screen`

```bash
screen -S keyguard
npm start
# Ctrl+A then D to detach. Reattach with: screen -r keyguard
```

Stop with **Ctrl+C** so in-memory data is flushed to disk. Avoid `kill -9` — up to ~2 seconds of data may be lost.
`screen` does not restart the app after a crash or reboot; use a process manager (systemd, pm2…) for that.

## Local testing without spending money

```bash
npm run mock   # terminal 1: fake OpenAI at http://localhost:4010/v1
```

Set `OPENAI_BASE_URL=http://localhost:4010/v1` in `.env`, then `npm start` in terminal 2.
A message containing `FAIL` makes the mock return 400; `CACHE` makes it return 500 cached tokens.
**Remove `OPENAI_BASE_URL` (and `data/db.json`) before running for real.**

## Project structure

```
src/
  server.js   Wires everything together, serves the UI, flushes data on shutdown
  proxy.js    POST /v1/chat/completions: check sub-key, override model, call OpenAI, count tokens
  admin.js    Admin API: login, sub-keys, logs, settings
  store.js    Data store (JSON file, batched writes every 2 s), cost calculation
  config.js   Reads .env
web/          Admin UI (HTML + Alpine.js + CSS, no build step)
deploy/       Sample Apache config
scripts/mock-openai.js   Fake OpenAI server for local testing
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Nguyen Duy Linh
