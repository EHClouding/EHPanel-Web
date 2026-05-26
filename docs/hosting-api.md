# EHPanel Web Hosting API

This is the first backend surface for creating real hosting accounts from EHPanel Web.

## Provision a Hosting Account

```http
POST /api/hosting/accounts/provision/
Content-Type: application/json
```

```json
{
  "node": "NODE_UUID",
  "username": "client001",
  "primary_domain": "client-domain.com",
  "customer_name": "Client Name",
  "customer_email": "client@example.com",
  "php_version": "8.3",
  "public_ip": "203.0.113.10",
  "ssl_email": "admin@client-domain.com",
  "ssl_staging": false,
  "database": {
    "engine": "mariadb",
    "name": "client001_wp",
    "username": "client001_wp",
    "password": "generated-strong-password"
  },
  "mailbox": {
    "email": "info@client-domain.com",
    "password": "generated-strong-password",
    "quota_mb": 1024
  }
}
```

The endpoint creates the panel records and queues these jobs for the node:

1. `provision_hosting`
2. `create_dns_zone`
3. `create_mail_domain`
4. `issue_ssl`
5. `create_database` when `database` is present
6. `create_mailbox` when `mailbox` is present

If the WebSocket channel is temporarily unavailable, jobs remain queued and can be dispatched again:

```http
POST /api/agents/jobs/{job_id}/dispatch/
```

After jobs complete, the panel can reconcile the account and child resource states:

```http
POST /api/hosting/accounts/{account_id}/sync-status/
POST /api/hosting/provisioning-runs/{run_id}/sync/
```

## Current Scope

This API stores the EHPanel-side account, domain, database, mailbox, provisioning run, and job-step records. Status reconciliation is explicit for now; a background reconciler can be added once the UI workflow is in place.
