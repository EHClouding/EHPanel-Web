import json
import os
import platform
import socket
import subprocess

from django.conf import settings
from django.utils import timezone

from agents.models import AgentJob, Node


def is_local_provisioning_enabled():
    return getattr(settings, "HOSTING_PROVISIONING_MODE", "local") == "local"


def local_public_ip():
    configured = getattr(settings, "LOCAL_PUBLIC_IP", "")
    if configured:
        return configured
    try:
        return socket.gethostbyname(socket.getfqdn())
    except OSError:
        return ""


def ensure_local_node():
    hostname = getattr(settings, "LOCAL_PANEL_HOSTNAME", "") or socket.getfqdn() or socket.gethostname()
    node, _created = Node.objects.get_or_create(
        hostname=hostname,
        defaults={
            "agent_type": Node.AgentType.WEB,
            "state": Node.State.ONLINE,
            "agent_version": "local-panel",
            "os_name": platform.platform(),
            "arch": platform.machine(),
        },
    )
    capabilities = node.capabilities if isinstance(node.capabilities, dict) else {}
    capabilities.update(
        {
            "local_panel": True,
            "provisioning_mode": "local",
            "web_engine": getattr(settings, "HOSTING_DEFAULT_WEB_ENGINE", "openlitespeed"),
            "edge": "nginx",
            "backend": "openlitespeed",
            "datacenter": getattr(settings, "LOCAL_PANEL_DATACENTER", "") or capabilities.get("datacenter", ""),
            "public_ip": local_public_ip() or capabilities.get("public_ip", ""),
        }
    )
    node.agent_type = Node.AgentType.WEB
    node.state = Node.State.ONLINE
    node.agent_version = "local-panel"
    node.os_name = platform.platform()
    node.arch = platform.machine()
    node.last_seen_at = timezone.now()
    node.last_telemetry = {**(node.last_telemetry or {}), "public_ip": capabilities.get("public_ip", "")}
    node.capabilities = capabilities
    node.save(
        update_fields=[
            "agent_type",
            "state",
            "agent_version",
            "os_name",
            "arch",
            "last_seen_at",
            "last_telemetry",
            "capabilities",
            "updated_at",
        ]
    )
    return node


def helper_settings_payload():
    return {
        "home_root": getattr(settings, "LOCAL_HOME_ROOT", "/home"),
        "nginx_vhosts_dir": getattr(settings, "LOCAL_NGINX_VHOSTS_DIR", "/etc/nginx/conf.d"),
        "ols_home": getattr(settings, "LOCAL_OLS_HOME", "/usr/local/lsws"),
        "ols_backend_port": getattr(settings, "LOCAL_OLS_BACKEND_PORT", 8088),
        "panel_backend": getattr(settings, "LOCAL_PANEL_BACKEND", "http://127.0.0.1:8004"),
        "panel_host_header": getattr(settings, "LOCAL_PANEL_HOST_HEADER", getattr(settings, "LOCAL_PANEL_HOSTNAME", "localhost")),
        "provision_dns": bool(getattr(settings, "LOCAL_PROVISION_DNS", True)),
        "provision_ssl": bool(getattr(settings, "LOCAL_PROVISION_SSL", True)),
        "provision_mail": bool(getattr(settings, "LOCAL_PROVISION_MAIL", True)),
        "webmail_enabled": bool(getattr(settings, "LOCAL_WEBMAIL_ENABLED", True)),
        "webmail_root": getattr(settings, "LOCAL_WEBMAIL_ROOT", "/opt/ehpanel-webmail"),
        "webmail_port": getattr(settings, "LOCAL_WEBMAIL_PORT", 8012),
        "dovecot_passwd_file": getattr(settings, "LOCAL_DOVECOT_PASSWD_FILE", "/etc/dovecot/ehpanel-users"),
        "postfix_virtual_domains_file": getattr(settings, "LOCAL_POSTFIX_VIRTUAL_DOMAINS_FILE", "/etc/postfix/ehpanel-virtual-domains"),
        "postfix_virtual_mailboxes_file": getattr(settings, "LOCAL_POSTFIX_VIRTUAL_MAILBOXES_FILE", "/etc/postfix/ehpanel-virtual-mailboxes"),
        "file_manager_temp_root": str(getattr(settings, "LOCAL_FILE_MANAGER_TEMP_ROOT", "/opt/ehpanel/web/media/file-manager")),
        "advanced_root": getattr(settings, "LOCAL_ADVANCED_ROOT", "/etc/ehpanel/advanced"),
        "public_ip": local_public_ip(),
    }


def execute_local_job(job):
    helper = getattr(settings, "LOCAL_PROVISIONING_HELPER", "/usr/local/sbin/ehpanel-local-provision")
    payload = {
        "job_id": str(job.id),
        "job_type": job.job_type,
        "payload": job.payload or {},
        "settings": helper_settings_payload(),
    }
    job.status = AgentJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    if bool(getattr(settings, "LOCAL_PROVISIONING_DRY_RUN", False)):
        job.mark_success({"local": True, "dry_run": True, "helper": helper, "payload": payload})
        return job

    command = [helper]
    if os.name == "posix" and bool(getattr(settings, "LOCAL_PROVISIONING_SUDO", True)) and hasattr(os, "geteuid") and os.geteuid() != 0:
        command = ["sudo", "-n", helper]

    try:
        completed = subprocess.run(
            command,
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=300,
            check=False,
        )
    except FileNotFoundError:
        job.mark_failed("LOCAL_HELPER_NOT_FOUND", f"No existe el helper local: {helper}", {"command": command})
        return job
    except subprocess.TimeoutExpired as exc:
        job.mark_failed("LOCAL_HELPER_TIMEOUT", "El helper local excedio el tiempo limite.", {"stdout": exc.stdout or "", "stderr": exc.stderr or ""})
        return job

    result = {"stdout": completed.stdout, "stderr": completed.stderr, "returncode": completed.returncode}
    try:
        parsed = json.loads(completed.stdout or "{}")
        if isinstance(parsed, dict):
            result.update(parsed)
    except json.JSONDecodeError:
        pass

    if completed.returncode == 0 and result.get("ok", True):
        job.mark_success(result)
    else:
        job.mark_failed(str(result.get("error_code") or "LOCAL_HELPER_FAILED"), str(result.get("detail") or completed.stderr or completed.stdout), result)
    return job


def dispatch_or_execute_local(job, run=None, account_id=None):
    if is_local_provisioning_enabled():
        if job.job_type == AgentJob.Type.SERVICE_ACTION and (job.payload or {}).get("action") in {"php_versions", "collect_php_versions"}:
            from .local_metrics import collect_node_telemetry

            job.mark_running()
            telemetry = collect_node_telemetry(job.node)
            job.mark_success(
                {
                    "local": True,
                    "php_versions": telemetry.get("php_versions", []),
                    "lsphp_versions": telemetry.get("lsphp_versions", []),
                    "php": telemetry.get("php", {}),
                }
            )
            return job

        execute_local_job(job)
        from .services import sync_job_side_effects

        sync_job_side_effects(job)
        if run:
            run.sync_from_jobs()
        elif account_id and job.status == AgentJob.Status.SUCCESS:
            from .models import HostingAccount

            account = HostingAccount.objects.filter(id=account_id).first()
            if account and job.job_type == AgentJob.Type.UNSUSPEND_ACCOUNT:
                account.status = HostingAccount.Status.ACTIVE
                account.save(update_fields=["status", "updated_at"])
            elif account and job.job_type == AgentJob.Type.DELETE_ACCOUNT:
                account.status = HostingAccount.Status.DELETED
                account.save(update_fields=["status", "updated_at"])
        return job

    from agents.views import dispatch_job

    dispatch_job(job)
    return job
