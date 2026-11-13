# Contributing

Thanks for your interest in improving Key Guard! Issues and pull requests in English or Vietnamese are welcome.

## Reporting bugs and requesting features

- Search [existing issues](https://github.com/LampardNguyen/manage-usage-api-key/issues) first.
- Use the issue templates and include: Node version, steps to reproduce, expected vs. actual behavior, and relevant logs.
- **Never paste real API keys, `.env` contents, or `data/db.json`** into an issue.
- Security vulnerabilities must be reported privately — see [SECURITY.md](SECURITY.md).

## Development setup

```bash
git clone https://github.com/LampardNguyen/manage-usage-api-key.git
cd manage-usage-api-key
nvm use            # Node 16.15.1
npm install
cp .env.example .env
```

Develop against the mock server so you don't spend real money:

```bash
npm run mock                                   # terminal 1
OPENAI_BASE_URL=http://localhost:4010/v1 npm start   # terminal 2
```

## Pull requests

1. Fork the repo and create a branch from `main` (e.g. `feat/streaming-support`, `fix/quota-rounding`).
2. Keep changes focused — one feature or fix per PR.
3. Follow the existing style: CommonJS, 2-space indentation, single quotes, no build step for `web/`.
4. Avoid adding dependencies unless clearly necessary.
5. Test manually with the mock server (create a key, send requests, check counters, limits, and logs).
6. Update `README.md` / `README.vi.md` and `CHANGELOG.md` when behavior or configuration changes.
7. Use clear commit messages, preferably [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `docs:`, `refactor:`…).

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE)
and that you will follow the [Code of Conduct](CODE_OF_CONDUCT.md).
