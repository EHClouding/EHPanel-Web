# EHPanel Web Agent Job Contract

## Goal

EHPanel Web queues jobs in the panel database and dispatches them to the connected Go agent. The agent executes the job on the node and reports progress/results back to the panel.

This is the first contract for the web-hosting MVP. The backend stores jobs and dispatches them to connected agents over the Channels group for the target node.

## API

Create a job:

```http
POST /api/agents/jobs/
Content-Type: application/json

{
  "node": "NODE_UUID",
  "job_type": "create_account",
  "payload": {
    "username": "client001",
    "domain": "example.com",
    "limits": {
      "cpu_pct": 100,
      "memory_mb": 1024,
      "disk_mb": 10240
    }
  }
}
```

List jobs:

```http
GET /api/agents/jobs/
GET /api/agents/jobs/?node=NODE_UUID
GET /api/agents/jobs/?status=queued
GET /api/agents/jobs/?job_type=create_domain
```

## Job Status

- `queued`: created in EHPanel Web, not sent yet.
- `sent`: sent to the agent over WebSocket.
- `running`: agent accepted and started execution.
- `success`: agent completed the job.
- `failed`: agent failed the job and returned an error.
- `canceled`: panel canceled the job before completion.
- `expired`: job was not picked up within its allowed window.

## Initial Job Types

- `create_account`
- `provision_hosting`
- `delete_account`
- `suspend_account`
- `unsuspend_account`
- `create_domain`
- `delete_domain`
- `create_php_pool`
- `create_database`
- `create_dns_zone`
- `issue_ssl`
- `create_mail_domain`
- `create_mailbox`
- `change_mailbox_password`
- `suspend_mailbox`
- `unsuspend_mailbox`
- `delete_mailbox`
- `create_mail_alias`
- `delete_mail_alias`
- `set_mailbox_quota`
- `enable_dkim`
- `service_action`

## WebSocket Messages

Panel to agent:

```json
{
  "msg_type": "job.run",
  "msg_id": "uuid",
  "payload": {
    "job_id": "uuid",
    "job_type": "create_account",
    "payload": {}
  }
}
```

The initial executable job is `service_action`:

```json
{
  "node": "NODE_UUID",
  "job_type": "service_action",
  "payload": {
    "service": "nginx",
    "action": "status"
  }
}
```

Supported `service_action.action` values:

- `status`
- `restart`
- `stop`
- `start`

The Go agent enforces its own allowlist of services and actions before invoking `systemctl`.

The first combined hosting MVP job is `provision_hosting`:

```json
{
  "node": "NODE_UUID",
  "job_type": "provision_hosting",
  "payload": {
    "username": "client001",
    "domain": "client-domain.com"
  }
}
```

This creates the Linux account if needed, writes an initial `public_html/index.html`, creates Apache and Nginx vhost files, validates both configs, and reloads both services.

The first executable database job is `create_database`:

```json
{
  "node": "NODE_UUID",
  "job_type": "create_database",
  "payload": {
    "engine": "mariadb",
    "database": "client001_wp",
    "user": "client001_wp",
    "password": "generated-strong-password"
  }
}
```

This creates a MariaDB database and local MariaDB user, resets the user password, grants privileges on that database, and verifies the database exists.

The first executable DNS job is `create_dns_zone`:

```json
{
  "node": "NODE_UUID",
  "job_type": "create_dns_zone",
  "payload": {
    "zone": "client-domain.com",
    "ip": "203.0.113.10",
    "nameserver": "ns1.client-domain.com",
    "records": [
      { "name": "mail", "type": "A", "ttl": 300, "value": "203.0.113.10" }
    ]
  }
}
```

This creates the PowerDNS zone when missing and idempotently replaces the default `@`, `www`, `mail`, `MX`, SPF, DMARC, and `ns1` records. Extra records can be supplied in `records`.

The first executable SSL job is `issue_ssl`:

```json
{
  "node": "NODE_UUID",
  "job_type": "issue_ssl",
  "payload": {
    "domain": "client-domain.com",
    "username": "client001",
    "email": "admin@client-domain.com",
    "aliases": ["www.client-domain.com"],
    "staging": false,
    "force_renewal": false
  }
}
```

This first performs a public HTTP ACME probe through `/.well-known/acme-challenge/`, then uses Certbot HTTP-01 webroot validation. On success it rewrites the Nginx vhost with HTTP ACME handling, HTTP to HTTPS redirect, and HTTPS proxying to Apache.

The first executable mail jobs are `create_mail_domain` and `create_mailbox`:

```json
{
  "node": "NODE_UUID",
  "job_type": "create_mailbox",
  "payload": {
    "email": "info@client-domain.com",
    "password": "generated-strong-password"
  }
}
```

This prepares Postfix virtual mailbox maps, Dovecot passwd-file authentication, `/var/vmail` storage, creates the mailbox Maildir, enables authenticated SMTP submission on port 587, and reloads/restarts the mail services needed for receiving, IMAP access, and outbound authenticated submission.

`create_mail_domain` also enables DKIM signing through Rspamd. DKIM can be repaired or rotated explicitly with `enable_dkim`:

```json
{
  "node": "NODE_UUID",
  "job_type": "enable_dkim",
  "payload": {
    "domain": "client-domain.com",
    "selector": "ehpanel"
  }
}
```

The job creates or reuses `/var/lib/rspamd/dkim/<domain>.<selector>.key`, configures Rspamd `dkim_signing`, restarts Rspamd after `rspamadm configtest`, and publishes `<selector>._domainkey.<domain>` as TXT in PowerDNS when the zone exists.

Mailbox lifecycle jobs:

```json
{
  "node": "NODE_UUID",
  "job_type": "change_mailbox_password",
  "payload": {
    "email": "info@client-domain.com",
    "password": "new-generated-strong-password"
  }
}
```

```json
{
  "node": "NODE_UUID",
  "job_type": "suspend_mailbox",
  "payload": {
    "email": "info@client-domain.com"
  }
}
```

```json
{
  "node": "NODE_UUID",
  "job_type": "unsuspend_mailbox",
  "payload": {
    "email": "info@client-domain.com"
  }
}
```

```json
{
  "node": "NODE_UUID",
  "job_type": "delete_mailbox",
  "payload": {
    "email": "info@client-domain.com",
    "purge": false
  }
}
```

Suspending a mailbox removes active Dovecot authentication and Postfix delivery map entries while preserving the Maildir. Unsuspending restores those entries. Deleting removes active and suspended entries; `purge=true` also removes the Maildir.

Alias/forwarder and quota jobs:

```json
{
  "node": "NODE_UUID",
  "job_type": "create_mail_alias",
  "payload": {
    "alias": "ventas@client-domain.com",
    "destinations": [
      "info@client-domain.com",
      "owner@example.net"
    ]
  }
}
```

```json
{
  "node": "NODE_UUID",
  "job_type": "delete_mail_alias",
  "payload": {
    "alias": "ventas@client-domain.com"
  }
}
```

```json
{
  "node": "NODE_UUID",
  "job_type": "set_mailbox_quota",
  "payload": {
    "email": "info@client-domain.com",
    "quota_mb": 1024
  }
}
```

Aliases use Postfix `virtual_alias_maps` and can forward to local or external addresses. Mailbox quotas are applied through Dovecot quota rules for authenticated IMAP access; `quota_mb: 0` removes the per-mailbox limit.

Agent to panel:

```json
{
  "msg_type": "job.started",
  "msg_id": "uuid",
  "payload": {
    "job_id": "uuid"
  }
}
```

```json
{
  "msg_type": "job.completed",
  "msg_id": "uuid",
  "payload": {
    "job_id": "uuid",
    "result": {}
  }
}
```

```json
{
  "msg_type": "job.failed",
  "msg_id": "uuid",
  "payload": {
    "job_id": "uuid",
    "error_code": "COMMAND_FAILED",
    "error_detail": "human-readable detail",
    "result": {}
  }
}
```

## MVP Execution Order

1. `provision_hosting`
2. `create_domain`
3. `create_php_pool`
4. `create_database`
5. `create_dns_zone`
6. `issue_ssl`
7. `create_mail_domain`
8. `create_mailbox`
9. `change_mailbox_password`, `suspend_mailbox`, `unsuspend_mailbox`, or `delete_mailbox` for mailbox administration
10. `create_mail_alias`, `delete_mail_alias`, and `set_mailbox_quota` for cPanel/Plesk-style mail administration
11. `enable_dkim` when DKIM must be repaired or rotated

After these jobs work end-to-end, EHPanel Web can create the first real hosting account from the UI with web, database, DNS, SSL, and email.
