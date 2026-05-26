# Staging Plan

## Hosts

- `panel.theflakito.com`: EHPanel Web.
- `web-01.theflakito.com`: AlmaLinux 10 web node with EHPanel Agent Web.

## First milestone

1. Deploy EHPanel Web on `panel.theflakito.com`.
2. Create an enrollment token for `web-01.theflakito.com`.
3. Install and configure EHPanel Agent Web on `web-01.theflakito.com`.
4. Confirm the node appears online in the panel.
5. Confirm heartbeat, capabilities and telemetry are persisted.

## DNS

Create A records:

- `panel.theflakito.com` -> panel VPS public IP.
- `web-01.theflakito.com` -> web node VPS public IP.
