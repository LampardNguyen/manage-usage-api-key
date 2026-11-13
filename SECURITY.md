# Security Policy

## Supported versions

Only the latest version on the `main` branch receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via
[GitHub Security Advisories](https://github.com/LampardNguyen/manage-usage-api-key/security/advisories/new).
Include a description, steps to reproduce, and the potential impact. You should receive a response within 7 days.

## Hardening recommendations

- Use a long, random `ADMIN_PASSWORD` and never commit `.env`.
- Serve the app only behind HTTPS and set `BEHIND_HTTPS_PROXY=true`.
- Restrict the admin UI (`/admin/`) by IP at the reverse proxy.
- Bind the app to localhost and expose it only through the reverse proxy.
- Protect `data/db.json` with filesystem permissions — it contains usage logs (sub-keys are stored only as hashes).
- Set a hard spending limit on the shared OpenAI key in the OpenAI dashboard as a last line of defense.
