# EHPanel Web — Production Deploy Checklist

This checklist assumes EHPanel Web is deployed by Server0 using the repository
deploy script and a GitHub-backed checkout.

## Target Layout

- App path: `/opt/ehpanel-web`
- Virtualenv: `/opt/ehpanel-web/venv`
- Service: `ehpanel-web`
- Runtime port: `8004`
- Public domain: `web.ehclouding.com`
- Reverse proxy: Nginx on the panel/server0 host
- Database: PostgreSQL
- Channel layer: Valkey on `127.0.0.1:6379`

## Required Environment

Create `/etc/ehpanel-web/ehpanel-web.env` or the EnvironmentFile used by the
systemd unit:

```env
DEBUG=false
SECRET_KEY=CHANGE_ME_LONG_RANDOM_VALUE
DBTOOLS_CREDENTIAL_KEY=CHANGE_ME_INDEPENDENT_CREDENTIAL_KEY
DBTOOLS_SSO_SECRET=CHANGE_ME_INDEPENDENT_DBTOOLS_SSO_SECRET
WEBMAIL_SSO_SECRET=CHANGE_ME_INDEPENDENT_WEBMAIL_SSO_SECRET
ALLOWED_HOSTS=web.ehclouding.com,127.0.0.1,localhost
CSRF_TRUSTED_ORIGINS=https://web.ehclouding.com
SECURE_SSL_REDIRECT=false
SECURE_PROXY_SSL_HEADER=true
TRUSTED_PROXY_IPS=127.0.0.1,::1

DATABASE_URL=postgres://ehpanel_web:CHANGE_ME@127.0.0.1:5432/ehpanel_web
REDIS_URL=redis://127.0.0.1:6379/0
CHANNEL_LAYER_BACKEND=redis

AGENT_CLOCK_SKEW_SECONDS=90
AGENT_HEARTBEAT_TIMEOUT_SECONDS=45
AGENT_ALLOW_LEGACY_RESUME=false
```

## Deploy Variables For Server0

Server0 should call:

```bash
EHPANEL_WEB_DEPLOY_DIR=/opt/ehpanel-web
EHPANEL_WEB_VENV_DIR=/opt/ehpanel-web/venv
EHPANEL_WEB_SERVICE_NAME=ehpanel-web
EHPANEL_WEB_BRANCH=main
EHPANEL_WEB_HEALTH_URL=http://127.0.0.1:8004/health/
EHPANEL_WEB_REQUIRE_GIT_UPDATE=true
/opt/ehpanel-web/scripts/deploy.sh
```

## Preflight

1. Rotate all staging credentials before first production deploy.
2. Use SSH keys or a read-only GitHub deploy token for the production checkout.
3. Confirm PostgreSQL database/user exist.
4. Confirm Valkey is active.
5. Confirm Nginx proxies HTTP and WebSocket traffic to `127.0.0.1:8004`.
   If `web.ehclouding.com` has an AAAA record, the vhost must include both
   `listen 443 ssl http2;` and `listen [::]:443 ssl http2;`; otherwise IPv6
   requests may fall through to another TLS vhost such as Webmail.
6. Confirm TLS certificate exists for `web.ehclouding.com`.
7. Confirm the Go agent nodes use `wss://web.ehclouding.com/ws/agent/`.

## Validate After Deploy

```bash
systemctl status ehpanel-web --no-pager
curl -fsS http://127.0.0.1:8004/health/
curl -fsS https://web.ehclouding.com/health/
journalctl -u ehpanel-web -n 120 --no-pager
```

Expected health response:

```json
{"status":"ok"}
```

## Current Production Gaps

These are intentionally not presented as completed features in the client UI:

- Backups/restore: backend endpoints and restore workflow still pending.
- SFTP key/password management: backend endpoints still pending.
- Runtime changes: final backend flow for PHP version and web engine changes
  should be closed before exposing it as a production self-service action.
- Metrics chart: detailed node metrics API should replace the current summary
  placeholder.
