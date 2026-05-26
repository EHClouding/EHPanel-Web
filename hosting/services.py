import base64
import hashlib
import json
import os
import secrets
import socket
import time
import re
import uuid
from datetime import timezone as dt_timezone
from email.utils import parsedate_to_datetime
from urllib import parse as urllib_parse

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import OperationalError, transaction
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from cryptography.fernet import Fernet, InvalidToken

from agents.models import AgentJob
from .models import DNSTemplateRecord, GlobalConfiguration, GlobalNameserver, HostingAccount, HostingAccountExport, HostingAdvancedItem, HostingApplication, HostingApplicationBackup, HostingDatabase, HostingDatabaseCredential, HostingDatabaseGrant, HostingDatabaseSsoToken, HostingDatabaseUser, HostingDNSRecord, HostingDomain, HostingFtpUser, HostingIPBlock, HostingMailbox, HostingMailboxCredential, HostingMailboxSsoToken, HostingMonitorAlertRule, HostingMonitorCheck, HostingMonitorIncident, HostingMonitorSnapshot, HostingPerformanceAudit, HostingProtectedDirectory, HostingSecurityScan, HostingWafConfiguration, MigrationAccount, MigrationLog, MigrationRun, MigrationSource, MigrationStep, ProvisioningRun, ProvisioningStep
from .local_provisioning import dispatch_or_execute_local, is_local_provisioning_enabled
from .permissions import scoped_accounts


User = get_user_model()


def node_public_ip(node):
    configured = settings.NODE_PUBLIC_IPS.get(node.hostname)
    if configured:
        return configured
    telemetry_ip = (node.last_telemetry or {}).get("public_ip")
    if telemetry_ip:
        return telemetry_ip
    try:
        return socket.gethostbyname(node.hostname)
    except OSError:
        return ""


def nameserver_base_zone():
    config = GlobalConfiguration.current()
    dns_defaults = config.dns_defaults or {}
    base_domain = str(dns_defaults.get("base_domain") or "").strip().strip(".")
    if base_domain:
        return base_domain
    primary_ns = str(dns_defaults.get("primary_ns") or dns_defaults.get("ns1") or "").strip().strip(".")
    if primary_ns.startswith("ns1.") and len(primary_ns.split(".")) > 2:
        return primary_ns.removeprefix("ns1.")
    return os.environ.get("NAMESERVER_BASE_DOMAIN", "ehclouding.com").strip().strip(".") or "ehclouding.com"


def next_nameserver_sequence_start():
    highest = GlobalNameserver.objects.order_by("-sequence").values_list("sequence", flat=True).first() or 0
    candidate = highest + 1
    return candidate if candidate % 2 == 1 else candidate + 1


def sync_global_nameserver_template():
    nameservers = list(GlobalNameserver.objects.filter(status=GlobalNameserver.Status.ACTIVE).order_by("sequence"))
    for ns in nameservers:
        host = ns.hostname.rstrip(".")
        DNSTemplateRecord.objects.update_or_create(
            name="@",
            record_type=HostingDNSRecord.RecordType.NS,
            content=f"{host}.",
            defaults={
                "ttl": 300,
                "priority": None,
                "order": 80 + ns.sequence,
                "is_active": True,
                "description": f"Nameserver global {ns.short_name or ns.sequence}",
            },
        )
        if ns.ip_address:
            label = host
            zone_suffix = f".{ns.zone.strip('.')}"
            if label.endswith(zone_suffix):
                label = label[: -len(zone_suffix)]
            DNSTemplateRecord.objects.update_or_create(
                name=label or host,
                record_type=HostingDNSRecord.RecordType.A,
                content=str(ns.ip_address),
                defaults={
                    "ttl": 300,
                    "priority": None,
                    "order": 100 + ns.sequence,
                    "is_active": True,
                    "description": f"IP del nameserver global {ns.short_name or ns.sequence}",
                },
            )

    config = GlobalConfiguration.current()
    dns_defaults = dict(config.dns_defaults or {})
    dns_defaults["base_domain"] = nameserver_base_zone()
    if len(nameservers) >= 1:
        dns_defaults["primary_ns"] = nameservers[0].hostname
    if len(nameservers) >= 2:
        dns_defaults["secondary_ns"] = nameservers[1].hostname
    config.dns_defaults = dns_defaults
    config.save(update_fields=["dns_defaults", "updated_at"])
    return nameservers


def ensure_default_nameservers_for_node(node):
    if not node or node.agent_type != node.AgentType.WEB:
        return []
    existing = list(GlobalNameserver.objects.filter(node=node).order_by("sequence"))
    if existing:
        return existing
    zone = nameserver_base_zone()
    start = next_nameserver_sequence_start()
    ip_address = node_public_ip(node) or None
    status = GlobalNameserver.Status.ACTIVE if ip_address else GlobalNameserver.Status.REVIEW
    created = []
    for offset, role in enumerate(["Primario", "Secundario"]):
        sequence = start + offset
        created.append(
            GlobalNameserver.objects.create(
                hostname=f"ns{sequence}.{zone}",
                short_name=f"NS{sequence}",
                ip_address=ip_address,
                node=node,
                role=role,
                zone=zone,
                status=status,
                sequence=sequence,
            )
        )
    sync_global_nameserver_template()
    return created


def ensure_default_nameservers_for_all_nodes():
    from agents.models import Node

    created = []
    for node in Node.objects.filter(agent_type=Node.AgentType.WEB).order_by("hostname"):
        created.extend(item for item in ensure_default_nameservers_for_node(node) if item)
    sync_global_nameserver_template()
    return created


def dns_template_context(hosting_domain, public_ip=""):
    domain = hosting_domain.domain
    account = hosting_domain.account
    ip = public_ip or node_public_ip(account.node)
    selector = hosting_domain.dkim_selector or "ehpanel"
    return {
        "domain": domain,
        "ip": ip,
        "mail_host": f"mail.{domain}",
        "selector": selector,
        "hostname": account.node.hostname,
        "ftp_host": f"ftp.{domain}",
        "autodiscover_host": f"autodiscover.{domain}",
        "autoconfig_host": f"autoconfig.{domain}",
        "webmail_host": f"webmail.{domain}",
        "server_host": f"server.{domain}",
        "ns1_host": f"ns1.{domain}",
        "ns2_host": f"ns2.{domain}",
        "dkim_txt": hosting_domain.dkim_txt or "",
    }


def render_dns_template_value(value, context):
    rendered = str(value)
    for key, replacement in context.items():
        rendered = rendered.replace("{" + key + "}", str(replacement))
    return rendered


def dns_template_records_preview(hosting_domain, public_ip=""):
    context = dns_template_context(hosting_domain, public_ip)
    existing = {}
    for record in hosting_domain.records.all():
        existing.setdefault((record.name, record.record_type), []).append(record)
    preview = []
    for template in DNSTemplateRecord.objects.filter(is_active=True):
        content = render_dns_template_value(template.content, context).strip()
        if not content:
            continue
        name = render_dns_template_value(template.name, context).strip() or "@"
        key = (name, template.record_type)
        candidates = existing.get(key, [])
        current = next(
            (
                record
                for record in candidates
                if record.content == content
                and record.ttl == template.ttl
                and (record.priority or None) == (template.priority or None)
            ),
            None,
        )
        status = "new"
        current_payload = None
        if current:
            current_payload = {
                "id": current.id,
                "name": current.name,
                "type": current.record_type,
                "content": current.content,
                "ttl": current.ttl,
                "priority": current.priority,
            }
            status = "same"
        elif candidates:
            current_payload = [
                {
                    "id": record.id,
                    "name": record.name,
                    "type": record.record_type,
                    "content": record.content,
                    "ttl": record.ttl,
                    "priority": record.priority,
                }
                for record in candidates
            ]
            status = "new"
        preview.append(
            {
                "name": name,
                "type": template.record_type,
                "content": content,
                "ttl": template.ttl,
                "priority": template.priority,
                "status": status,
                "description": template.description,
                "existing": current_payload,
            }
        )
    return preview


def sync_domain_dns_from_template(hosting_domain, public_ip="", overwrite_keys=None):
    overwrite_set = None
    if overwrite_keys is not None:
        overwrite_set = {
            (item.get("name"), item.get("type") or item.get("record_type"), item.get("content"))
            for item in overwrite_keys
        }
    for item in dns_template_records_preview(hosting_domain, public_ip):
        key = (item["name"], item["type"], item["content"])
        if item["status"] == "same":
            continue
        if item["status"] == "conflict" and overwrite_set is not None and key not in overwrite_set:
            continue
        update_or_create_dns_record(
            hosting_domain,
            item["name"],
            item["type"],
            {
                "content": item["content"],
                "ttl": item["ttl"],
                "priority": item["priority"],
            },
        )


def ensure_account_panel_user(account, password):
    owner = account.owner
    if owner and not (owner.is_staff or owner.is_superuser):
        user = owner
    else:
        user, _created = User.objects.get_or_create(
            username=account.username,
            defaults={
                "email": account.customer_email,
                "first_name": account.customer_name,
                "is_active": True,
            },
        )
        if user.is_staff or user.is_superuser:
            raise ValueError("El username de la cuenta hosting ya pertenece a un usuario administrativo.")
        account.owner = user
        account.save(update_fields=["owner", "updated_at"])

    user.email = account.customer_email or user.email
    user.first_name = account.customer_name or user.first_name
    user.is_active = True
    user.is_staff = False
    user.is_superuser = False
    user.set_password(password)
    user.save(update_fields=["email", "first_name", "is_active", "is_staff", "is_superuser", "password"])

    reseller_group, _created = Group.objects.get_or_create(name="reseller")
    user.groups.remove(reseller_group)
    return user


def queue_agent_job(run, order, name, job_type, payload):
    job = AgentJob.objects.create(
        node=run.account.node,
        job_type=job_type,
        payload=payload,
    )
    ProvisioningStep.objects.create(run=run, job=job, name=name, order=order)
    transaction.on_commit(lambda job_id=job.id, run_id=run.id: dispatch_or_execute_local(AgentJob.objects.get(id=job_id), ProvisioningRun.objects.get(id=run_id)), robust=True)
    return job


def queue_account_job(account, job_type, payload):
    job = AgentJob.objects.create(node=account.node, job_type=job_type, payload=payload)
    transaction.on_commit(lambda job_id=job.id, account_id=account.id: dispatch_or_execute_local(AgentJob.objects.get(id=job_id), account_id=account_id), robust=True)
    return job


def effective_global_limits_for_account(account):
    policies = GlobalConfiguration.current().policies or {}
    global_limits = policies.get("global_limits") if isinstance(policies, dict) else {}
    if not isinstance(global_limits, dict):
        global_limits = {}
    defaults = {
        "bandwidth_mbps": int(global_limits.get("default_bandwidth_mbps") or 20),
        "db_connections": int(global_limits.get("default_db_connections") or 300),
    }
    profiles = global_limits.get("profiles") or []
    if account.plan_id and isinstance(profiles, list):
        for profile in profiles:
            if not isinstance(profile, dict) or not profile.get("enabled", True):
                continue
            if int(profile.get("plan_id") or 0) == account.plan_id:
                return {
                    "bandwidth_mbps": int(profile.get("bandwidth_mbps") or defaults["bandwidth_mbps"]),
                    "db_connections": int(profile.get("db_connections") or defaults["db_connections"]),
                    "profile_id": profile.get("id"),
                }
    return defaults


def apply_account_software(account):
    run = ProvisioningRun.objects.create(account=account, status=ProvisioningRun.Status.RUNNING)
    job_type = (
        AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING
        if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED
        else AgentJob.Type.PROVISION_HOSTING
    )
    queue_agent_job(
        run,
        1,
        "apply_software",
        job_type,
        {
            "username": account.username,
            "domain": account.primary_domain,
            "php_version": account.php_version,
            "write_default_index": False,
            "limits": {
                "disk_mb": account.disk_mb,
                "bandwidth_mb": account.bandwidth_mb,
                "memory_mb": account.memory_mb,
                "cpu_pct": account.cpu_pct,
                "global": effective_global_limits_for_account(account),
            },
        },
    )
    account.status = HostingAccount.Status.PROVISIONING
    account.save(update_fields=["status", "updated_at"])
    return run


def activate_account_if_local_ready(account):
    if account.status != HostingAccount.Status.PROVISIONING:
        return
    failed = AgentJob.objects.filter(
        node=account.node,
        payload__username=account.username,
        job_type__in=[AgentJob.Type.PROVISION_HOSTING, AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING],
        status=AgentJob.Status.FAILED,
    ).exists()
    success = AgentJob.objects.filter(
        node=account.node,
        payload__username=account.username,
        job_type__in=[AgentJob.Type.PROVISION_HOSTING, AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING],
        status=AgentJob.Status.SUCCESS,
    ).exists()
    if success and not failed:
        account.status = HostingAccount.Status.ACTIVE
        account.save(update_fields=["status", "updated_at"])


def suspend_account(account):
    account.status = HostingAccount.Status.SUSPENDED
    account.save(update_fields=["status", "updated_at"])
    return queue_account_job(account, AgentJob.Type.SUSPEND_ACCOUNT, {"username": account.username, "domain": account.primary_domain})


def unsuspend_account(account):
    account.status = HostingAccount.Status.PROVISIONING
    account.save(update_fields=["status", "updated_at"])
    return queue_account_job(account, AgentJob.Type.UNSUSPEND_ACCOUNT, {"username": account.username, "domain": account.primary_domain})


def collect_software_info(account, timeout=12):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.COLLECT_SOFTWARE_INFO,
        payload={
            "username": account.username,
            "domain": account.primary_domain,
            "web_engine": account.web_engine,
            "php_version": account.php_version,
        },
    )
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    if job.status == AgentJob.Status.SUCCESS:
        account.last_usage = {**(account.last_usage or {}), "software": job.result or {}}
        account.last_usage_at = timezone.now()
        account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
    return job


def apply_software_settings(account, payload, timeout=20):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.APPLY_SOFTWARE_SETTINGS,
        payload={
            "username": account.username,
            "domain": account.primary_domain,
            "web_engine": account.web_engine,
            "php_version": account.php_version,
            "php_settings": payload.get("php_settings") or {},
            "php_extra_directives": payload.get("php_extra_directives") or "",
            "php_fpm": payload.get("php_fpm") or {},
            "apache_http_directives": payload.get("apache_http_directives") or "",
            "apache_https_directives": payload.get("apache_https_directives") or "",
            "nginx_directives": payload.get("nginx_directives") or "",
            "extensions": payload.get("extensions") or {},
        },
    )
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    account.last_usage = {
        **(account.last_usage or {}),
        "software_settings": payload,
        "software_settings_result": job.result or {},
    }
    account.last_usage_at = timezone.now()
    account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
    return job


def run_web_performance_audit(account, target_url="", duration_seconds=15, samples=6, requested_by=None, timeout=90):
    duration_seconds = max(5, min(int(duration_seconds or 15), 60))
    samples = max(1, min(int(samples or 6), 30))
    domain = account.primary_domain.strip().lower()
    target_url = str(target_url or "").strip()
    if not target_url:
        target_url = f"https://{domain}/"
    elif target_url.startswith("/"):
        target_url = f"https://{domain}{target_url}"
    parsed = urllib_parse.urlparse(target_url)
    allowed_hosts = {domain, f"www.{domain}"}
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() not in allowed_hosts:
        raise ValueError("La auditoria solo puede ejecutarse contra el dominio principal o www de la cuenta.")

    performance = HostingPerformanceAudit.objects.create(
        account=account,
        target_url=target_url,
        duration_seconds=duration_seconds,
        samples=samples,
        requested_by=requested_by if getattr(requested_by, "is_authenticated", False) else None,
    )
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.RUN_WEB_PERFORMANCE_AUDIT,
        payload={
            "audit_id": performance.id,
            "account_id": str(account.id),
            "username": account.username,
            "domain": domain,
            "target_url": target_url,
            "duration_seconds": duration_seconds,
            "samples": samples,
            "php_version": account.php_version,
            "web_engine": account.web_engine,
        },
    )
    performance.job = job
    performance.status = HostingPerformanceAudit.Status.RUNNING
    performance.started_at = timezone.now()
    performance.save(update_fields=["job", "status", "started_at", "updated_at"])
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    sync_job_side_effects(job)
    performance.refresh_from_db()
    return performance


def retry_failed_provisioning_run(run):
    failed_steps = run.steps.select_related("job").filter(
        job__status__in=[
            AgentJob.Status.FAILED,
            AgentJob.Status.CANCELED,
            AgentJob.Status.EXPIRED,
        ]
    )
    retried = 0
    with transaction.atomic():
        for step in failed_steps:
            job = step.job
            job.status = AgentJob.Status.QUEUED
            job.error_code = ""
            job.error_detail = ""
            job.result = {}
            job.correlation_id = ""
            job.sent_at = None
            job.started_at = None
            job.finished_at = None
            job.save(
                update_fields=[
                    "status",
                    "error_code",
                    "error_detail",
                    "result",
                    "correlation_id",
                    "sent_at",
                    "started_at",
                    "finished_at",
                    "updated_at",
                ]
            )
            transaction.on_commit(
                lambda job_id=job.id, run_id=run.id: dispatch_or_execute_local(
                    AgentJob.objects.get(id=job_id),
                    ProvisioningRun.objects.get(id=run_id),
                ),
                robust=True,
            )
            retried += 1

        if retried:
            run.status = ProvisioningRun.Status.RUNNING
            run.save(update_fields=["status", "updated_at"])
            if run.account.status != HostingAccount.Status.SUSPENDED:
                run.account.status = HostingAccount.Status.PROVISIONING
                run.account.save(update_fields=["status", "updated_at"])
    return retried


def retry_provisioning_step(step):
    job = step.job
    retryable = [
        AgentJob.Status.FAILED,
        AgentJob.Status.CANCELED,
        AgentJob.Status.EXPIRED,
    ]
    if job.status not in retryable:
        return None
    with transaction.atomic():
        new_job = AgentJob.objects.create(
            node=job.node,
            job_type=job.job_type,
            payload=job.payload or {},
        )
        step.job = new_job
        step.save(update_fields=["job"])
        run = step.run
        run.status = ProvisioningRun.Status.RUNNING
        run.save(update_fields=["status", "updated_at"])
        if run.account.status != HostingAccount.Status.SUSPENDED:
            run.account.status = HostingAccount.Status.PROVISIONING
            run.account.save(update_fields=["status", "updated_at"])
        transaction.on_commit(
            lambda job_id=new_job.id, run_id=run.id: dispatch_or_execute_local(
                AgentJob.objects.get(id=job_id),
                ProvisioningRun.objects.get(id=run_id),
            ),
            robust=True,
        )
    return new_job


def create_mailbox(account, email, password, quota_mb, metadata=None):
    metadata = metadata or {}
    with transaction.atomic():
        mailbox = HostingMailbox.objects.create(
            account=account,
            email=email,
            quota_mb=quota_mb,
            description=metadata.get("description", ""),
            outgoing_limit=metadata.get("outgoing_limit", 150),
            antispam_enabled=metadata.get("antispam_enabled", True),
            antispam_settings=metadata.get("antispam_settings", {}),
            autoresponder_enabled=metadata.get("autoresponder_enabled", False),
            autoresponder_subject=metadata.get("autoresponder_subject", ""),
            autoresponder_format=metadata.get("autoresponder_format", "text"),
            autoresponder_encoding=metadata.get("autoresponder_encoding", "UTF-8"),
            autoresponder_message=metadata.get("autoresponder_message", ""),
            autoresponder_redirect=metadata.get("autoresponder_redirect", ""),
            autoresponder_unique_limit=metadata.get("autoresponder_unique_limit", 1),
            autoresponder_schedule=metadata.get("autoresponder_schedule", False),
        )
        store_mailbox_credential(mailbox, password)
        queue_account_job(
            account,
            AgentJob.Type.CREATE_MAILBOX,
            {"email": email, "password": password, "quota_mb": quota_mb},
        )
        queue_mailbox_settings_jobs(mailbox)
    return mailbox


def create_database(account, engine, name, username, password):
    with transaction.atomic():
        database = HostingDatabase.objects.create(account=account, engine=engine, name=name, username=username)
        database_user, _ = HostingDatabaseUser.objects.get_or_create(
            account=account,
            engine=engine,
            username=username,
            defaults={"access": HostingDatabaseUser.Access.ADMIN, "hosts": ["localhost"]},
        )
        store_database_credential(database_user, password)
        HostingDatabaseGrant.objects.update_or_create(
            database=database,
            user=database_user,
            defaults={"access": database_user.access, "privileges": privileges_for_access(database_user.access)},
        )
        queue_account_job(
            account,
            AgentJob.Type.CREATE_DATABASE,
            {"engine": engine, "database": name, "user": username, "password": password, "access": database_user.access},
        )
    return database


def create_database_with_user(account, engine, name, user_mode, database_user=None, username="", password="", access=None):
    access = access or HostingDatabaseUser.Access.READ_WRITE
    with transaction.atomic():
        if user_mode == "existing":
            user = database_user
            password = ""
        else:
            user = HostingDatabaseUser.objects.create(
                account=account,
                engine=engine,
                username=username,
                access=access,
                hosts=["localhost"],
            )
            store_database_credential(user, password)
        database = HostingDatabase.objects.create(account=account, engine=engine, name=name, username=user.username)
        HostingDatabaseGrant.objects.create(
            database=database,
            user=user,
            access=access,
            privileges=privileges_for_access(access),
        )
        payload = {
            "engine": engine,
            "database": name,
            "user": user.username,
            "password": password,
            "access": access,
            "create_user": user_mode != "existing",
        }
        job = queue_account_job(account, AgentJob.Type.CREATE_DATABASE, payload)
        user.last_job = job
        user.status = HostingDatabaseUser.Status.PENDING
        user.save(update_fields=["last_job", "status", "updated_at"])
    return database


def create_database_user(account, engine, username, password, database=None, access=None):
    access = access or HostingDatabaseUser.Access.READ_WRITE
    with transaction.atomic():
        user = HostingDatabaseUser.objects.create(account=account, engine=engine, username=username, access=access, hosts=["localhost"])
        store_database_credential(user, password)
        if database:
            HostingDatabaseGrant.objects.update_or_create(
                database=database,
                user=user,
                defaults={"access": access, "privileges": privileges_for_access(access)},
            )
        job = queue_account_job(
            account,
            AgentJob.Type.CREATE_DATABASE_USER,
            {"engine": engine, "database": database.name if database else "", "user": username, "password": password, "access": access},
        )
        user.last_job = job
        user.save(update_fields=["last_job", "updated_at"])
    return user


def update_database_user(user, password="", access=None):
    if access:
        user.access = access
        user.save(update_fields=["access", "updated_at"])
        user.grants.update(access=access, privileges=privileges_for_access(access))
    if password:
        store_database_credential(user, password)
        job = queue_account_job(
            user.account,
            AgentJob.Type.CHANGE_DATABASE_PASSWORD,
            {
                "engine": user.engine,
                "database": user.grants.first().database.name if user.grants.exists() else "_",
                "user": user.username,
                "password": password,
                "access": user.access,
            },
        )
        user.last_job = job
        user.status = HostingDatabaseUser.Status.PENDING
        user.save(update_fields=["last_job", "status", "updated_at"])
    elif access:
        for grant in user.grants.select_related("database").all():
            queue_account_job(
                user.account,
                AgentJob.Type.CREATE_DATABASE_USER,
                {"engine": user.engine, "database": grant.database.name, "user": user.username, "password": "", "access": grant.access, "create_user": False},
            )
    return user


def delete_database_user(user):
    job = queue_account_job(
        user.account,
        AgentJob.Type.DELETE_DATABASE_USER,
        {"engine": user.engine, "database": user.grants.first().database.name if user.grants.exists() else "_", "user": user.username},
    )
    user.status = HostingDatabaseUser.Status.PENDING
    user.last_job = job
    user.save(update_fields=["status", "last_job", "updated_at"])
    return job


def clone_database(database, new_name):
    clone = HostingDatabase.objects.create(account=database.account, engine=database.engine, name=new_name, username=database.username)
    for grant in database.grants.select_related("user").all():
        HostingDatabaseGrant.objects.create(database=clone, user=grant.user, access=grant.access, privileges=grant.privileges)
    queue_account_job(
        database.account,
        AgentJob.Type.CLONE_DATABASE,
        {"engine": database.engine, "database": database.name, "target_database": new_name, "user": database.username},
    )
    return clone


def check_repair_database(database):
    database.status = HostingDatabase.Status.PENDING
    database.save(update_fields=["status", "updated_at"])
    return queue_account_job(
        database.account,
        AgentJob.Type.CHECK_REPAIR_DATABASE,
        {"engine": database.engine, "database": database.name, "user": database.username},
    )


def export_database(database):
    return queue_account_job(
        database.account,
        AgentJob.Type.EXPORT_DATABASE,
        {"engine": database.engine, "database": database.name, "user": database.username, "account_username": database.account.username},
    )


def import_database(database, path):
    database.status = HostingDatabase.Status.PENDING
    database.save(update_fields=["status", "updated_at"])
    return queue_account_job(
        database.account,
        AgentJob.Type.IMPORT_DATABASE,
        {"engine": database.engine, "database": database.name, "user": database.username, "path": path, "account_username": database.account.username},
    )


def credential_fernet():
    raw_value = getattr(settings, "DBTOOLS_CREDENTIAL_KEY", "")
    if not raw_value:
        if settings.DEBUG:
            raw_value = settings.SECRET_KEY
        else:
            raise ImproperlyConfigured("DBTOOLS_CREDENTIAL_KEY must be set in production")
    raw = raw_value.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


MIGRATION_RUN_STEPS = [
    ("connect_origin", "Conectar origen", 10),
    ("discover_accounts", "Analizar cuentas detectadas", 25),
    ("select_accounts", "Seleccionar cuentas a restaurar", 35),
    ("copy_files", "Copiar archivos", 55),
    ("migrate_data", "Migrar bases y correos", 80),
    ("verify_destination", "Verificar destino", 100),
]


def encrypt_migration_secret(secret):
    if not secret:
        return ""
    return credential_fernet().encrypt(secret.encode()).decode()


def decrypt_migration_secret(source):
    if not source.encrypted_secret:
        return ""
    try:
        return credential_fernet().decrypt(source.encrypted_secret.encode()).decode()
    except (InvalidToken, UnicodeDecodeError):
        return ""


def create_migration_run(validated_data, user=None):
    secret = validated_data.pop("secret", "")
    destination_node = validated_data.pop("destination_node")
    source_fields = {
        "provider": validated_data.pop("provider"),
        "host": validated_data.pop("host").strip(),
        "port": validated_data.pop("port"),
        "username": validated_data.pop("username").strip(),
        "auth_method": validated_data.pop("auth_method"),
        "created_by": user if user and user.is_authenticated else None,
    }
    source = MigrationSource.objects.create(
        **source_fields,
        encrypted_secret=encrypt_migration_secret(secret),
    )
    options = {
        "preserve_mail_passwords": validated_data.pop("preserve_mail_passwords", True),
        "include_files": validated_data.pop("include_files", True),
        "include_databases": validated_data.pop("include_databases", True),
        "include_mail": validated_data.pop("include_mail", True),
        "include_subdomains": validated_data.pop("include_subdomains", True),
    }
    run = MigrationRun.objects.create(
        source=source,
        destination_node=destination_node,
        migration_type=validated_data.pop("migration_type"),
        mode=validated_data.pop("mode"),
        priority=validated_data.pop("priority"),
        concurrency=min(int(validated_data.pop("concurrency")), 5),
        selected_accounts=validated_data.pop("selected_accounts", []),
        notes=validated_data.pop("notes", ""),
        options=options,
        created_by=user if user and user.is_authenticated else None,
    )
    create_default_migration_steps(run)
    queue_migration_discovery(run)
    return run


def create_import_run(validated_data, user=None):
    destination_node = validated_data.pop("destination_node")
    backup_file = validated_data.pop("backup_file", None)
    backup_url = (validated_data.pop("backup_url", "") or "").strip()
    import_source = validated_data.pop("import_source")
    panel_type = validated_data.pop("panel_type")
    account_label = (validated_data.pop("account_label", "") or "").strip()
    artifact = {}
    if backup_file:
        artifact_dir = settings.MEDIA_ROOT / "migration-imports" / uuid.uuid4().hex
        artifact_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", backup_file.name or "backup.tar.gz")[:180]
        artifact_path = artifact_dir / safe_name
        with artifact_path.open("wb") as destination:
            for chunk in backup_file.chunks():
                destination.write(chunk)
        artifact = {
            "file_name": safe_name,
            "file_path": str(artifact_path),
            "file_size": artifact_path.stat().st_size,
        }
        host = f"uploaded:{safe_name}"
    else:
        host = backup_url
        artifact = {"backup_url": backup_url}
    source = MigrationSource.objects.create(
        provider=MigrationSource.Provider.BACKUP_URL,
        host=host,
        port=443,
        username=panel_type,
        auth_method=MigrationSource.AuthMethod.API_TOKEN,
        encrypted_secret="",
        created_by=user if user and user.is_authenticated else None,
    )
    options = {
        "import_flow": True,
        "import_source": import_source,
        "panel_type": panel_type,
        "artifact": artifact,
        "preserve_mail_passwords": validated_data.pop("preserve_mail_passwords", True),
        "include_files": validated_data.pop("include_files", True),
        "include_databases": validated_data.pop("include_databases", True),
        "include_mail": validated_data.pop("include_mail", True),
        "include_subdomains": validated_data.pop("include_subdomains", True),
    }
    run = MigrationRun.objects.create(
        source=source,
        destination_node=destination_node,
        migration_type=validated_data.pop("migration_type"),
        mode=MigrationRun.Mode.DISCOVER_ONLY,
        priority=validated_data.pop("priority"),
        concurrency=1,
        status=MigrationRun.Status.DRAFT,
        current_step="Backup registrado",
        progress_percent=5,
        notes=validated_data.pop("notes", ""),
        options=options,
        created_by=user if user and user.is_authenticated else None,
    )
    create_default_import_steps(run)
    if account_label:
        MigrationAccount.objects.create(
            run=run,
            source_username=panel_type,
            primary_domain=account_label.lower(),
            status=MigrationAccount.Status.DETECTED,
            current_step="Pendiente de analisis",
            detected={"panel_type": panel_type, "import_source": import_source, **artifact},
        )
        run.total_accounts = 1
        run.save(update_fields=["total_accounts", "updated_at"])
    MigrationLog.objects.create(
        run=run,
        level="info",
        message="Importacion registrada desde backup. Pendiente de analisis por agente.",
        metadata={"import_source": import_source, "panel_type": panel_type, "artifact": artifact},
    )
    return run


def create_account_export(validated_data, user=None):
    account = validated_data["account"]
    export = HostingAccountExport.objects.create(
        account=account,
        export_type=validated_data.get("export_type", "full"),
        include_files=validated_data.get("include_files", True),
        include_databases=validated_data.get("include_databases", True),
        include_mail=validated_data.get("include_mail", True),
        include_subdomains=validated_data.get("include_subdomains", True),
        notes=validated_data.get("notes", ""),
        created_by=user if user and user.is_authenticated else None,
    )
    databases = list(account.databases.values_list("name", flat=True)) if export.include_databases else []
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.BACKUP_ACCOUNT,
        payload={
            "export_id": export.id,
            "username": account.username,
            "domain": account.primary_domain,
            "include_files": export.include_files,
            "include_databases": export.include_databases,
            "include_mail": export.include_mail,
            "include_subdomains": export.include_subdomains,
            "databases": databases,
            "format": "ehpanel-account-export-v1",
        },
    )
    export.last_job = job
    export.save(update_fields=["last_job", "updated_at"])
    dispatch_or_execute_local(job)
    return export


def sync_account_export_from_job(job):
    export_id = (job.payload or {}).get("export_id")
    if not export_id:
        return False
    export = HostingAccountExport.objects.filter(id=export_id).first()
    if not export:
        return False
    if job.status in {AgentJob.Status.QUEUED, AgentJob.Status.SENT, AgentJob.Status.RUNNING}:
        export.status = HostingAccountExport.Status.RUNNING if job.status == AgentJob.Status.RUNNING else HostingAccountExport.Status.QUEUED
        export.save(update_fields=["status", "updated_at"])
        return True
    if job.status == AgentJob.Status.SUCCESS:
        result = job.result or {}
        archive_path = str(result.get("archive_path") or result.get("path") or "")
        size_value = result.get("size_bytes") or result.get("bytes") or 0
        try:
            size_bytes = int(size_value)
        except (TypeError, ValueError):
            size_bytes = 0
        export.status = HostingAccountExport.Status.COMPLETED
        export.archive_path = archive_path
        export.filename = os.path.basename(archive_path) if archive_path else f"{export.account.username}-export.tar.gz"
        export.size_bytes = size_bytes
        export.result = result
        export.error_code = ""
        export.error_detail = ""
        export.save(update_fields=["status", "archive_path", "filename", "size_bytes", "result", "error_code", "error_detail", "updated_at"])
        return True
    if job.status == AgentJob.Status.FAILED:
        export.status = HostingAccountExport.Status.FAILED
        export.error_code = job.error_code
        export.error_detail = job.error_detail
        export.result = job.result or {}
        export.save(update_fields=["status", "error_code", "error_detail", "result", "updated_at"])
        return True
    return False


def create_default_migration_steps(run):
    for order, (key, label, _threshold) in enumerate(MIGRATION_RUN_STEPS, start=1):
        MigrationStep.objects.get_or_create(run=run, account=None, key=key, defaults={"label": label, "order": order})


def create_default_import_steps(run):
    steps = [
        ("receive_backup", "Recibir backup"),
        ("inspect_backup", "Analizar contenido"),
        ("restore_files", "Restaurar archivos"),
        ("restore_databases", "Restaurar bases de datos"),
        ("restore_mail", "Restaurar correo"),
        ("verify_import", "Verificar destino"),
    ]
    for order, (key, label) in enumerate(steps, start=1):
        status_value = MigrationStep.Status.COMPLETED if key == "receive_backup" else MigrationStep.Status.PENDING
        progress = 100 if key == "receive_backup" else 0
        MigrationStep.objects.get_or_create(
            run=run,
            account=None,
            key=key,
            defaults={"label": label, "order": order, "status": status_value, "progress_percent": progress},
        )


def migration_source_payload(source):
    return {
        "provider": source.provider,
        "host": source.host,
        "port": source.port,
        "username": source.username,
        "auth_method": source.auth_method,
        "secret": decrypt_migration_secret(source),
    }


def queue_migration_discovery(run):
    run.status = MigrationRun.Status.DISCOVERING
    run.current_step = "Conectar origen"
    run.progress_percent = 5
    run.started_at = run.started_at or timezone.now()
    run.save(update_fields=["status", "current_step", "progress_percent", "started_at", "updated_at"])
    step = run.steps.filter(key="connect_origin", account__isnull=True).first()
    if step:
        step.status = MigrationStep.Status.RUNNING
        step.started_at = step.started_at or timezone.now()
        step.progress_percent = 10
        step.save(update_fields=["status", "started_at", "progress_percent", "updated_at"])
    job = AgentJob.objects.create(
        node=run.destination_node,
        job_type=AgentJob.Type.MIGRATION_DISCOVER,
        payload={
            "run_id": run.id,
            "source": migration_source_payload(run.source),
            "mode": run.mode,
            "migration_type": run.migration_type,
            "options": run.options,
        },
    )
    if step:
        step.job = job
        step.save(update_fields=["job", "updated_at"])
    MigrationLog.objects.create(run=run, level="info", message="Discovery de migracion enviado al agente.", metadata={"job": str(job.id)})
    dispatch_or_execute_local(job)
    return job


def start_migration_run(run, selected_accounts=None, concurrency=None):
    if concurrency:
        run.concurrency = min(int(concurrency), 5)
    if selected_accounts:
        run.selected_accounts = selected_accounts
        run.accounts.filter(primary_domain__in=selected_accounts).update(status=MigrationAccount.Status.SELECTED)
    accounts = list(run.accounts.filter(status__in=[MigrationAccount.Status.DETECTED, MigrationAccount.Status.SELECTED, MigrationAccount.Status.FAILED]))
    if selected_accounts:
        accounts = [account for account in accounts if account.primary_domain in selected_accounts or account.source_username in selected_accounts]
    if not accounts:
        MigrationLog.objects.create(run=run, level="warning", message="No hay cuentas detectadas o seleccionadas para migrar.")
        return []
    run.status = MigrationRun.Status.RUNNING
    run.current_step = "Migracion en cola"
    run.progress_percent = max(run.progress_percent, 35)
    run.total_accounts = max(run.total_accounts, len(accounts))
    run.started_at = run.started_at or timezone.now()
    run.save(update_fields=["concurrency", "selected_accounts", "status", "current_step", "progress_percent", "total_accounts", "started_at", "updated_at"])
    jobs = []
    for account in accounts:
        account.status = MigrationAccount.Status.QUEUED
        account.current_step = "En cola"
        account.progress_percent = max(account.progress_percent, 5)
        account.save(update_fields=["status", "current_step", "progress_percent", "updated_at"])
        job = AgentJob.objects.create(
            node=run.destination_node,
            job_type=AgentJob.Type.MIGRATE_ACCOUNT,
            payload={
                "run_id": run.id,
                "migration_account_id": account.id,
                "source": migration_source_payload(run.source),
                "account": {
                    "source_username": account.source_username,
                    "primary_domain": account.primary_domain,
                    "customer_email": account.customer_email,
                    "detected": account.detected,
                },
                "concurrency": run.concurrency,
                "migration_type": run.migration_type,
                "options": run.options,
                "skip_ssl": True,
            },
        )
        account.last_job = job
        account.save(update_fields=["last_job", "updated_at"])
        MigrationLog.objects.create(run=run, account=account, level="info", message="Migracion de cuenta enviada al agente.", metadata={"job": str(job.id)})
        dispatch_or_execute_local(job)
        jobs.append(job)
    return jobs


def sync_migration_from_job(job):
    payload = job.payload or {}
    run = MigrationRun.objects.filter(id=payload.get("run_id")).first()
    if not run:
        return False
    if job.job_type == AgentJob.Type.MIGRATION_DISCOVER:
        return sync_migration_discovery_job(run, job)
    if job.job_type == AgentJob.Type.MIGRATE_ACCOUNT:
        return sync_migration_account_job(run, job)
    return False


def sync_migration_discovery_job(run, job):
    if job.status == AgentJob.Status.SUCCESS:
        result = job.result or {}
        accounts = result.get("accounts") or []
        for raw in accounts:
            if not isinstance(raw, dict):
                continue
            domain = str(raw.get("primary_domain") or raw.get("domain") or "").strip().lower()
            if not domain:
                continue
            MigrationAccount.objects.update_or_create(
                run=run,
                primary_domain=domain,
                defaults={
                    "source_username": str(raw.get("username") or raw.get("source_username") or ""),
                    "customer_email": str(raw.get("email") or raw.get("customer_email") or ""),
                    "files_mb": int(raw.get("files_mb") or raw.get("disk_mb") or 0),
                    "databases_count": int(raw.get("databases_count") or len(raw.get("databases") or [])),
                    "mailboxes_count": int(raw.get("mailboxes_count") or len(raw.get("mailboxes") or [])),
                    "subdomains_count": int(raw.get("subdomains_count") or len(raw.get("subdomains") or [])),
                    "detected": raw,
                    "status": MigrationAccount.Status.DETECTED,
                    "current_step": "Detectada",
                    "progress_percent": 0,
                },
            )
        run.total_accounts = run.accounts.count()
        run.status = MigrationRun.Status.ANALYZED if run.mode != MigrationRun.Mode.AUTO_MIGRATE_ALL else MigrationRun.Status.QUEUED
        run.current_step = "Cuentas detectadas"
        run.progress_percent = 30
        run.save(update_fields=["total_accounts", "status", "current_step", "progress_percent", "updated_at"])
        run.steps.filter(key__in=["connect_origin", "discover_accounts"], account__isnull=True).update(status=MigrationStep.Status.COMPLETED, progress_percent=100, finished_at=timezone.now())
        MigrationLog.objects.create(run=run, level="info", message=f"Discovery completado. {run.total_accounts} cuentas detectadas.", metadata={"job": str(job.id)})
        if run.mode == MigrationRun.Mode.AUTO_MIGRATE_ALL:
            start_migration_run(run)
        return True
    if job.status == AgentJob.Status.FAILED:
        run.status = MigrationRun.Status.FAILED
        run.current_step = "Fallo al analizar origen"
        run.save(update_fields=["status", "current_step", "updated_at"])
        run.source.status = "failed"
        run.source.last_error = job.error_detail or job.error_code
        run.source.save(update_fields=["status", "last_error", "updated_at"])
        run.steps.filter(key__in=["connect_origin", "discover_accounts"], account__isnull=True).update(status=MigrationStep.Status.FAILED, error_detail=run.source.last_error)
        MigrationLog.objects.create(run=run, level="error", message=run.source.last_error or "No se pudo analizar el origen.", metadata={"job": str(job.id)})
        return True
    return False


def sync_migration_account_job(run, job):
    account = MigrationAccount.objects.filter(id=(job.payload or {}).get("migration_account_id"), run=run).first()
    if not account:
        return False
    if job.status == AgentJob.Status.RUNNING:
        account.status = MigrationAccount.Status.RUNNING
        account.current_step = "Migrando cuenta"
        account.started_at = account.started_at or timezone.now()
        account.save(update_fields=["status", "current_step", "started_at", "updated_at"])
        return True
    if job.status == AgentJob.Status.SUCCESS:
        result = job.result or {}
        account.status = MigrationAccount.Status.COMPLETED
        account.progress_percent = 100
        account.current_step = "Completada"
        account.error_code = ""
        account.error_detail = ""
        account.finished_at = timezone.now()
        if result.get("account_id"):
            account.destination_account_id = result["account_id"]
        account.save(update_fields=["status", "progress_percent", "current_step", "error_code", "error_detail", "finished_at", "destination_account", "updated_at"])
        MigrationLog.objects.create(run=run, account=account, level="info", message="Cuenta migrada correctamente.", metadata={"job": str(job.id), "result": result})
    elif job.status == AgentJob.Status.FAILED:
        account.status = MigrationAccount.Status.FAILED
        account.current_step = "Fallida"
        account.error_code = job.error_code
        account.error_detail = job.error_detail
        account.finished_at = timezone.now()
        account.save(update_fields=["status", "current_step", "error_code", "error_detail", "finished_at", "updated_at"])
        MigrationLog.objects.create(run=run, account=account, level="error", message=job.error_detail or job.error_code or "Cuenta fallida.", metadata={"job": str(job.id)})
    else:
        return False
    sync_migration_run_progress(run)
    return True


def sync_migration_run_progress(run):
    total = run.accounts.count()
    completed = run.accounts.filter(status=MigrationAccount.Status.COMPLETED).count()
    failed = run.accounts.filter(status=MigrationAccount.Status.FAILED).count()
    active = run.accounts.filter(status__in=[MigrationAccount.Status.QUEUED, MigrationAccount.Status.RUNNING]).count()
    run.total_accounts = total
    run.completed_accounts = completed
    run.failed_accounts = failed
    if total:
        run.progress_percent = max(35, min(100, round(((completed + failed) / total) * 100)))
    if total and completed + failed >= total:
        run.status = MigrationRun.Status.FAILED if failed and not completed else MigrationRun.Status.COMPLETED
        run.current_step = "Migracion finalizada"
        run.finished_at = timezone.now()
    elif active:
        run.status = MigrationRun.Status.RUNNING
        run.current_step = "Migrando cuentas"
    run.save(update_fields=["total_accounts", "completed_accounts", "failed_accounts", "status", "current_step", "progress_percent", "finished_at", "updated_at"])


def store_database_credential(user, password):
    if not password:
        return None
    token = credential_fernet().encrypt(password.encode()).decode()
    credential, _ = HostingDatabaseCredential.objects.update_or_create(user=user, defaults={"encrypted_password": token})
    return credential


def read_database_credential(user):
    credential = getattr(user, "credential", None)
    if not credential:
        return ""
    try:
        return credential_fernet().decrypt(credential.encrypted_password.encode()).decode()
    except (InvalidToken, UnicodeDecodeError):
        return ""


def store_mailbox_credential(mailbox, password):
    if not password:
        return None
    token = credential_fernet().encrypt(password.encode()).decode()
    credential, _ = HostingMailboxCredential.objects.update_or_create(mailbox=mailbox, defaults={"encrypted_password": token})
    return credential


def read_mailbox_credential(mailbox):
    credential = getattr(mailbox, "credential", None)
    if not credential:
        return ""
    try:
        return credential_fernet().decrypt(credential.encrypted_password.encode()).decode()
    except (InvalidToken, UnicodeDecodeError):
        return ""


def sso_token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_database_sso(database, manager, created_by=None):
    user = database.grants.select_related("user").filter(user__username=database.username).first()
    db_user = user.user if user else HostingDatabaseUser.objects.filter(account=database.account, engine=database.engine, username=database.username).first()
    if not db_user:
        raise ValueError("No hay usuario de base de datos asociado.")
    password = read_database_credential(db_user)
    if not password:
        raise ValueError("No hay credencial guardada para autologin. Cambia la contrasena de este usuario BD una vez para habilitarlo.")
    token = secrets.token_urlsafe(32)
    HostingDatabaseSsoToken.objects.create(
        manager=manager,
        token_hash=sso_token_hash(token),
        database=database,
        user=db_user,
        expires_at=timezone.now() + timezone.timedelta(seconds=settings.DBTOOLS_SSO_TTL_SECONDS),
        created_by=created_by if getattr(created_by, "is_authenticated", False) else None,
    )
    host = database.account.node.hostname
    return f"https://{host}/ehpanel-dbtools/sso.php?manager={manager}&token={token}"


def consume_database_sso(token, manager):
    item = HostingDatabaseSsoToken.objects.select_related("database", "database__account", "user").filter(
        token_hash=sso_token_hash(token),
        manager=manager,
    ).first()
    if not item:
        raise ValueError("Token invalido.")
    if item.consumed_at:
        raise ValueError("Token ya utilizado.")
    if item.expires_at <= timezone.now():
        raise ValueError("Token expirado.")
    password = read_database_credential(item.user)
    if not password:
        raise ValueError("Credencial no disponible.")
    item.consumed_at = timezone.now()
    item.save(update_fields=["consumed_at"])
    return {
        "engine": item.database.engine,
        "manager": item.manager,
        "database": item.database.name,
        "username": item.user.username,
        "password": password,
        "host": "127.0.0.1",
        "port": 3306 if item.database.engine == HostingDatabase.Engine.MARIADB else 5432,
    }


def create_webmail_sso(mailbox, created_by=None):
    password = read_mailbox_credential(mailbox)
    if not password:
        raise ValueError("No hay credencial guardada para autologin. Cambia la contrasena de este buzon una vez para habilitarlo.")
    token = secrets.token_urlsafe(32)
    ttl = getattr(settings, "WEBMAIL_SSO_TTL_SECONDS", getattr(settings, "DBTOOLS_SSO_TTL_SECONDS", 60))
    HostingMailboxSsoToken.objects.create(
        token_hash=sso_token_hash(token),
        mailbox=mailbox,
        expires_at=timezone.now() + timezone.timedelta(seconds=ttl),
        created_by=created_by if getattr(created_by, "is_authenticated", False) else None,
    )
    configured_url = getattr(settings, "WEBMAIL_SSO_URL", "").strip()
    if configured_url:
        base_url = configured_url
    else:
        domain = mailbox.email.split("@", 1)[1] if "@" in mailbox.email else mailbox.account.primary_domain
        base_url = f"https://webmail.{domain}/ehpanel-sso/"
    return f"{base_url.rstrip('/')}/?token={token}"


def consume_webmail_sso(token):
    item = HostingMailboxSsoToken.objects.select_related("mailbox", "mailbox__account").filter(token_hash=sso_token_hash(token)).first()
    if not item:
        raise ValueError("Token invalido.")
    if item.consumed_at:
        raise ValueError("Token ya utilizado.")
    if item.expires_at <= timezone.now():
        raise ValueError("Token expirado.")
    password = read_mailbox_credential(item.mailbox)
    if not password:
        raise ValueError("Credencial no disponible.")
    item.consumed_at = timezone.now()
    item.save(update_fields=["consumed_at"])
    return {"email": item.mailbox.email, "password": password}


def privileges_for_access(access):
    if access == HostingDatabaseUser.Access.READ_ONLY:
        return ["SELECT"]
    if access == HostingDatabaseUser.Access.ADMIN:
        return ["ALL"]
    return ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "INDEX", "CREATE TEMPORARY TABLES", "LOCK TABLES"]


def change_account_password(account, password):
    with transaction.atomic():
        ensure_account_panel_user(account, password)
        return queue_account_job(
            account,
            AgentJob.Type.CREATE_SFTP_USER,
            {"username": account.username, "password": password},
        )


def create_ftp_user(account, username, password, root, quota_mb=0, ftp_user=None):
    with transaction.atomic():
        if ftp_user is None:
            ftp_user = HostingFtpUser.objects.create(account=account, username=username, root=root, quota_mb=quota_mb)
        else:
            ftp_user.quota_mb = quota_mb
            ftp_user.save(update_fields=["quota_mb", "updated_at"])
        job = queue_account_job(
            account,
            AgentJob.Type.CREATE_FTP_USER,
            {
                "username": username,
                "password": password,
                "account_username": account.username,
                "root": ftp_user.absolute_root,
                "relative_root": root,
                "quota_mb": quota_mb,
                "protocol": "ftps",
                "shell": "/usr/sbin/nologin",
            },
        )
        ftp_user.last_job = job
        ftp_user.save(update_fields=["last_job", "updated_at"])
    return ftp_user


def delete_ftp_user(ftp_user):
    with transaction.atomic():
        job = queue_account_job(
            ftp_user.account,
            AgentJob.Type.DELETE_FTP_USER,
            {
                "username": ftp_user.username,
                "account_username": ftp_user.account.username,
                "root": ftp_user.absolute_root,
                "relative_root": ftp_user.root,
                "protocol": "ftps",
            },
        )
        ftp_user.status = HostingFtpUser.Status.PENDING
        ftp_user.last_job = job
        ftp_user.save(update_fields=["status", "last_job", "updated_at"])
    return job


def suspend_ftp_user(ftp_user):
    with transaction.atomic():
        job = queue_account_job(
            ftp_user.account,
            AgentJob.Type.SUSPEND_FTP_USER,
            {
                "username": ftp_user.username,
                "account_username": ftp_user.account.username,
                "root": ftp_user.absolute_root,
                "relative_root": ftp_user.root,
                "protocol": "ftps",
            },
        )
        ftp_user.status = HostingFtpUser.Status.PENDING
        ftp_user.last_job = job
        ftp_user.save(update_fields=["status", "last_job", "updated_at"])
    return job


def unsuspend_ftp_user(ftp_user):
    with transaction.atomic():
        job = queue_account_job(
            ftp_user.account,
            AgentJob.Type.UNSUSPEND_FTP_USER,
            {
                "username": ftp_user.username,
                "account_username": ftp_user.account.username,
                "root": ftp_user.absolute_root,
                "relative_root": ftp_user.root,
                "protocol": "ftps",
            },
        )
        ftp_user.status = HostingFtpUser.Status.PENDING
        ftp_user.last_job = job
        ftp_user.save(update_fields=["status", "last_job", "updated_at"])
    return job


def collect_account_usage(account, wait=True):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.COLLECT_ACCOUNT_USAGE,
        payload={
            "account_id": str(account.id),
            "username": account.username,
            "domain": account.primary_domain,
            "limits": {
                "disk_mb": account.disk_mb,
                "bandwidth_mb": account.bandwidth_mb,
                "memory_mb": account.memory_mb,
                "cpu_pct": account.cpu_pct,
                "global": effective_global_limits_for_account(account),
            },
        },
    )
    if is_local_provisioning_enabled():
        job.mark_running()
        try:
            from .local_metrics import collect_account_usage_local

            result = collect_account_usage_local(account)
            job.mark_success(result)
            account.last_usage = normalize_account_usage(account, result)
            account.last_usage_at = timezone.now()
            account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
        except Exception as exc:
            job.mark_failed("LOCAL_METRICS_ERROR", str(exc))
        return job

    transaction.on_commit(lambda job_id=job.id: dispatch_or_execute_local(AgentJob.objects.get(id=job_id)), robust=True)
    if not wait:
        return job

    deadline = timezone.now().timestamp() + 12
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status == AgentJob.Status.SUCCESS:
            account.last_usage = normalize_account_usage(account, job.result or {})
            account.last_usage_at = timezone.now()
            account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
            return job
        if job.status == AgentJob.Status.FAILED:
            return job
        time.sleep(0.35)
    return job


def normalize_account_usage(account, result):
    def numeric(name, default=0):
        value = result.get(name, default)
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return default

    def numeric_from(values, name, default=0):
        try:
            return round(float((values or {}).get(name, default)), 2)
        except (TypeError, ValueError):
            return default

    http_metrics = result.get("http") or {}
    storage = dict(result.get("storage") or {})
    storage["databases_mb"] = round(
        sum(float(db.size_mb or 0) for db in account.databases.all()),
        2,
    )
    storage["mailboxes_mb"] = round(
        sum(float(mailbox.used_mb or 0) for mailbox in account.mailboxes.all()),
        2,
    )
    storage["backups_mb"] = round(
        sum((backup.size_bytes or 0) for backup in HostingApplicationBackup.objects.filter(app__account=account)) / 1024 / 1024,
        2,
    )
    storage["total_mb"] = round(
        numeric_from(storage, "files_mb")
        + numeric_from(storage, "mail_mb")
        + numeric_from(storage, "tmp_mb")
        + numeric_from(storage, "logs_mb")
        + numeric_from(storage, "databases_mb")
        + numeric_from(storage, "mailboxes_mb")
        + numeric_from(storage, "backups_mb"),
        2,
    )

    return {
        "disk_used_mb": numeric("disk_used_mb"),
        "disk_quota_mb": account.disk_mb,
        "ram_used_mb": numeric("ram_used_mb"),
        "ram_used_bytes": numeric("ram_used_bytes"),
        "memory_limit_mb": account.memory_mb,
        "cpu_pct": numeric("cpu_pct"),
        "cpu_limit_pct": account.cpu_pct,
        "processes": int(result.get("processes") or 0),
        "bandwidth_used_mb": numeric("bandwidth_used_mb"),
        "bandwidth_bytes": numeric("bandwidth_bytes"),
        "bandwidth_mb": account.bandwidth_mb,
        "http": http_metrics,
        "storage": storage,
        "mail": result.get("mail", {}),
        "resource_limits": result.get("resource_limits", {}),
        "quota": result.get("quota", {}),
        "collected_at": result.get("collected_at"),
        "warnings": result.get("warnings", []),
    }


def ensure_monitoring_defaults(account):
    domain = account.primary_domain
    smtp_host = f"mail.{domain}"
    smtp_target = f"{smtp_host}:25"
    legacy_smtp = HostingMonitorCheck.objects.filter(account=account, check_type=HostingMonitorCheck.CheckType.SMTP, target=smtp_host).first()
    current_smtp = HostingMonitorCheck.objects.filter(account=account, check_type=HostingMonitorCheck.CheckType.SMTP, target=smtp_target).first()
    if legacy_smtp and current_smtp:
        legacy_smtp.delete()
    elif legacy_smtp:
        legacy_smtp.target = smtp_target
        legacy_smtp.last_message = ""
        legacy_smtp.status = HostingMonitorCheck.Status.UNKNOWN
        legacy_smtp.save(update_fields=["target", "last_message", "status", "updated_at"])

    for check_type, name, target, interval in [
        (HostingMonitorCheck.CheckType.HTTP, "HTTP / HTTPS", f"https://{domain}", 60),
        (HostingMonitorCheck.CheckType.DNS, "DNS", domain, 300),
        (HostingMonitorCheck.CheckType.SSL, "SSL", domain, 3600),
        (HostingMonitorCheck.CheckType.SMTP, "SMTP", smtp_target, 300),
        (HostingMonitorCheck.CheckType.WEBMAIL, "Webmail", f"https://webmail.{domain}", 300),
    ]:
        HostingMonitorCheck.objects.get_or_create(
            account=account,
            check_type=check_type,
            target=target,
            defaults={"name": name, "interval_seconds": interval},
        )
    for channel, event, threshold, target in [
        (HostingMonitorAlertRule.Channel.EMAIL, "site_down", "2 fallos seguidos", account.customer_email or ""),
        (HostingMonitorAlertRule.Channel.PANEL, "ssl_expiring", "15 dias antes", ""),
        (HostingMonitorAlertRule.Channel.PANEL, "service_down", "1 fallo confirmado", ""),
    ]:
        HostingMonitorAlertRule.objects.get_or_create(
            account=account,
            channel=channel,
            event=event,
            defaults={"threshold": threshold, "target": target},
        )


def collect_account_monitoring(account, wait=True):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.COLLECT_ACCOUNT_MONITORING,
        payload={
            "account_id": str(account.id),
            "username": account.username,
            "domain": account.primary_domain,
            "web_engine": account.web_engine,
            "php_version": account.php_version,
        },
    )
    transaction.on_commit(lambda job_id=job.id: dispatch_or_execute_local(AgentJob.objects.get(id=job_id)), robust=True)
    if not wait:
        return job

    deadline = timezone.now().timestamp() + 15
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            if job.status == AgentJob.Status.SUCCESS:
                sync_account_monitoring_from_result(account, job.result or {})
            return job
        time.sleep(0.35)
    return job


def _monitor_status_label(value):
    value = str(value or "").lower()
    if value in ["ok", "active", "running", "success", "operational"]:
        return HostingMonitorCheck.Status.OK
    if value in ["warning", "degraded", "review", "revisar"]:
        return HostingMonitorCheck.Status.WARNING
    if value in ["failed", "down", "inactive", "error", "dead"]:
        return HostingMonitorCheck.Status.FAILED
    if value == "paused":
        return HostingMonitorCheck.Status.PAUSED
    return HostingMonitorCheck.Status.UNKNOWN


def _monitor_severity(status):
    if status == HostingMonitorCheck.Status.FAILED:
        return HostingMonitorIncident.Severity.HIGH
    if status == HostingMonitorCheck.Status.WARNING:
        return HostingMonitorIncident.Severity.MEDIUM
    return HostingMonitorIncident.Severity.LOW


def _sync_monitor_incident(account, title, status, detail="", service="", monitor_check=None):
    incident = HostingMonitorIncident.objects.filter(
        account=account,
        title=title,
        status__in=[HostingMonitorIncident.Status.OPEN, HostingMonitorIncident.Status.ACKNOWLEDGED],
    ).first()
    if status in [HostingMonitorCheck.Status.OK, HostingMonitorCheck.Status.PAUSED]:
        if incident:
            incident.status = HostingMonitorIncident.Status.RESOLVED
            incident.resolved_at = timezone.now()
            incident.detail = detail or incident.detail
            incident.save(update_fields=["status", "resolved_at", "detail", "updated_at"])
        return None
    if incident:
        incident.detail = detail or incident.detail
        incident.severity = _monitor_severity(status)
        incident.save(update_fields=["detail", "severity", "updated_at"])
        return incident
    return HostingMonitorIncident.objects.create(
        account=account,
        monitor_check=monitor_check,
        title=title,
        service=service,
        severity=_monitor_severity(status),
        detail=detail,
        metadata={"source": "monitoring"},
    )


def sync_account_monitoring_from_result(account, result):
    ensure_monitoring_defaults(account)
    now = timezone.now()
    checks = result.get("checks") or []
    services = result.get("services") or []
    logs = result.get("logs") or {}
    summary = result.get("summary") or {}
    sla = result.get("sla") or {}

    for item in checks:
        check_type = str(item.get("type") or item.get("check_type") or "http").lower()
        target = str(item.get("target") or item.get("url") or "").strip()
        if not target:
            continue
        status_value = _monitor_status_label(item.get("status"))
        check, _ = HostingMonitorCheck.objects.get_or_create(
            account=account,
            check_type=check_type,
            target=target,
            defaults={"name": item.get("name") or check_type.upper()},
        )
        if check.enabled:
            check.status = status_value
        check.name = item.get("name") or check.name
        check.response_ms = int(float(item.get("response_ms") or 0))
        check.last_checked_at = now
        check.last_message = str(item.get("message") or item.get("detail") or "")[:255]
        check.metadata = {k: v for k, v in item.items() if k not in ["name", "type", "check_type", "target", "status", "response_ms", "message", "detail"]}
        check.save(update_fields=["name", "status", "response_ms", "last_checked_at", "last_message", "metadata", "updated_at"])
        _sync_monitor_incident(account, f"{check.name}: {check.target}", check.status, check.last_message, monitor_check=check)

    for service in services:
        name = str(service.get("name") or service.get("service") or "").strip()
        if not name:
            continue
        status_value = _monitor_status_label(service.get("status") or service.get("process"))
        _sync_monitor_incident(
            account,
            f"Servicio {name}",
            status_value,
            str(service.get("message") or service.get("detail") or service.get("status") or ""),
            service=name,
        )

    incidents_open = HostingMonitorIncident.objects.filter(
        account=account,
        status__in=[HostingMonitorIncident.Status.OPEN, HostingMonitorIncident.Status.ACKNOWLEDGED],
    ).count()
    status_value = summary.get("status") or ("degraded" if incidents_open else "operational")
    HostingMonitorSnapshot.objects.create(
        account=account,
        status=status_value,
        uptime_pct=float(summary.get("uptime_pct") or sla.get("uptime_pct") or 100),
        response_ms=int(float(summary.get("response_ms") or 0)),
        incidents_open=incidents_open,
        services=services,
        checks=checks,
        logs=logs,
        sla=sla,
    )


def build_account_monitoring(account, refresh=False):
    ensure_monitoring_defaults(account)
    job = collect_account_monitoring(account, wait=True) if refresh else None
    latest = account.monitor_snapshots.first()
    checks_qs = account.monitor_checks.all()
    open_count = account.monitor_incidents.filter(status__in=[HostingMonitorIncident.Status.OPEN, HostingMonitorIncident.Status.ACKNOWLEDGED]).count()
    failed_count = checks_qs.filter(status=HostingMonitorCheck.Status.FAILED).count()
    warning_count = checks_qs.filter(status=HostingMonitorCheck.Status.WARNING).count()
    status_value = "down" if failed_count else ("degraded" if warning_count or open_count else "operational")
    uptime_pct = latest.uptime_pct if latest else (99.99 if not open_count else 99.90)
    return {
        "status": "failed" if job and job.status == AgentJob.Status.FAILED else "ok",
        "job": str(job.id) if job else None,
        "error_code": job.error_code if job and job.status == AgentJob.Status.FAILED else "",
        "error_detail": job.error_detail if job and job.status == AgentJob.Status.FAILED else "",
        "summary": {
            "status": status_value,
            "uptime_pct": round(float(uptime_pct or 0), 3),
            "response_ms": latest.response_ms if latest else 0,
            "incidents_open": open_count,
            "checks_failed": failed_count,
            "checks_warning": warning_count,
            "last_checked_at": latest.collected_at if latest else None,
        },
        "checks": [
            {
                "id": check.id,
                "type": check.check_type,
                "name": check.name,
                "target": check.target,
                "status": check.status,
                "response_ms": check.response_ms,
                "enabled": check.enabled,
                "last_checked_at": check.last_checked_at,
                "last_message": check.last_message,
            }
            for check in checks_qs
        ],
        "services": latest.services if latest else [],
        "incidents": [
            {
                "id": incident.id,
                "title": incident.title,
                "severity": incident.severity,
                "service": incident.service,
                "status": incident.status,
                "started_at": incident.started_at,
                "acknowledged_at": incident.acknowledged_at,
                "resolved_at": incident.resolved_at,
                "detail": incident.detail,
            }
            for incident in account.monitor_incidents.all()[:20]
        ],
        "alerts": [
            {
                "id": rule.id,
                "channel": rule.channel,
                "event": rule.event,
                "threshold": rule.threshold,
                "target": rule.target,
                "enabled": rule.enabled,
                "last_test_at": rule.last_test_at,
                "last_test_status": rule.last_test_status,
            }
            for rule in account.monitor_alert_rules.all()
        ],
        "logs": latest.logs if latest else {"web": [], "mail": [], "system": []},
        "history": [
            {"time": snapshot.collected_at, "status": snapshot.status, "response_ms": snapshot.response_ms, "incidents_open": snapshot.incidents_open}
            for snapshot in account.monitor_snapshots.all()[:30]
        ],
        "sla": latest.sla if latest else {"uptime_pct": uptime_pct, "downtime_minutes": 0, "incidents": open_count, "mttr_minutes": 0},
    }


def queue_security_scan(account, scan_type="quick", path="", scan=None):
    scan_type = scan_type if scan_type in ["quick", "full", "manual"] else "quick"
    path = (path or "").strip().strip("/") or ("." if scan_type == "full" else "public_html")
    if scan is None:
        scan = HostingSecurityScan.objects.create(account=account, scan_type=scan_type, path=path)
    scan.status = HostingSecurityScan.Status.QUEUED
    scan.progress = 5
    scan.error_code = ""
    scan.error_detail = ""
    scan.save(update_fields=["status", "progress", "error_code", "error_detail", "updated_at"])
    payload = {
        "scan_id": scan.id,
        "account_id": str(account.id),
        "username": account.username,
        "scan_type": scan_type,
        "path": path,
    }
    job = queue_account_job(account, AgentJob.Type.SECURITY_SCAN, payload)
    scan.last_job = job
    scan.save(update_fields=["last_job", "updated_at"])
    return scan


def queue_security_remediation(scan, action, targets=None, requested_by=""):
    action = action if action in ["clean", "quarantine", "delete"] else "quarantine"
    targets = targets if isinstance(targets, list) else []
    report = scan.report if isinstance(scan.report, dict) else {}
    remediation_log = report.get("remediation_log") if isinstance(report.get("remediation_log"), list) else []
    remediation_log.append(
        {
            "action": action,
            "targets": targets,
            "requested_by": requested_by,
            "queued_at": timezone.now().isoformat(),
            "status": "queued",
        }
    )
    scan.report = {**report, "remediation_log": remediation_log}
    scan.status = HostingSecurityScan.Status.QUEUED
    scan.progress = 5
    scan.error_code = ""
    scan.error_detail = ""
    scan.save(update_fields=["report", "status", "progress", "error_code", "error_detail", "updated_at"])
    payload = {
        "scan_id": scan.id,
        "account_id": str(scan.account_id),
        "username": scan.account.username,
        "scan_type": scan.scan_type,
        "path": scan.path,
        "action": "remediate",
        "remediation_action": action,
        "targets": targets,
    }
    job = queue_account_job(scan.account, AgentJob.Type.SECURITY_SCAN, payload)
    scan.last_job = job
    scan.save(update_fields=["last_job", "updated_at"])
    return scan


def sync_security_scan_from_job(scan, job):
    result = job.result or {}
    if job.status in [AgentJob.Status.SENT, AgentJob.Status.RUNNING]:
        scan.status = HostingSecurityScan.Status.RUNNING
        scan.progress = max(scan.progress, 35)
        if not scan.started_at:
            scan.started_at = timezone.now()
        scan.save(update_fields=["status", "progress", "started_at", "updated_at"])
        return scan
    if job.status == AgentJob.Status.SUCCESS:
        scan.status = HostingSecurityScan.Status.CLEAN
        scan.progress = 100
        scan.error_code = ""
        scan.error_detail = ""
    elif job.status == AgentJob.Status.FAILED:
        scan.status = HostingSecurityScan.Status.THREAT if job.error_code == "MALWARE_FOUND" else HostingSecurityScan.Status.FAILED
        scan.progress = 100
        scan.error_code = job.error_code
        scan.error_detail = job.error_detail
    elif job.status == AgentJob.Status.CANCELED:
        scan.status = HostingSecurityScan.Status.CANCELED
    else:
        return scan
    scan.files_scanned = max(0, int(result.get("scanned") or 0))
    scan.infected_files = max(0, int(result.get("infected") or 0))
    scan.data_scanned = str(result.get("data_scanned") or "")
    scan.output = str(result.get("output") or "")
    previous_report = scan.report if isinstance(scan.report, dict) else {}
    next_report = {
        "target": result.get("target", ""),
        "infected_files": result.get("infected_files", []),
        "duration_seconds": result.get("duration_seconds"),
        "started_at": result.get("started_at", ""),
        "finished_at": result.get("finished_at", ""),
    }
    if previous_report.get("remediation_log"):
        next_report["remediation_log"] = previous_report.get("remediation_log")
    if result.get("remediation"):
        remediation_log = next_report.get("remediation_log") if isinstance(next_report.get("remediation_log"), list) else []
        remediation_log.append(result.get("remediation"))
        next_report["remediation_log"] = remediation_log
    scan.report = next_report
    scan.finished_at = timezone.now()
    if not scan.started_at:
        scan.started_at = scan.finished_at
    scan.save(
        update_fields=[
            "status",
            "progress",
            "files_scanned",
            "infected_files",
            "data_scanned",
            "output",
            "report",
            "error_code",
            "error_detail",
            "started_at",
            "finished_at",
            "updated_at",
        ]
    )
    return scan


def create_domain(account, domain, public_ip, domain_type=None, document_root=""):
    with transaction.atomic():
        domain_type = domain_type or (
            HostingDomain.DomainType.SUBDOMAIN
            if domain.endswith("." + account.primary_domain)
            else HostingDomain.DomainType.ALIAS
        )
        document_root = document_root or ("public_html" if domain_type == HostingDomain.DomainType.ALIAS else f"subdomains/{domain.split('.')[0]}")
        hosting_domain = HostingDomain.objects.create(
            account=account,
            domain=domain,
            domain_type=domain_type,
            document_root=document_root,
        )
        sync_domain_dns_from_template(hosting_domain, public_ip)
        if domain_type == HostingDomain.DomainType.SUBDOMAIN and domain.endswith("." + account.primary_domain):
            parent_domain = account.domains.filter(is_primary=True).first() or account.domains.filter(domain=account.primary_domain).first()
            if parent_domain:
                label = domain[: -(len(account.primary_domain) + 1)]
                target_ip = public_ip or node_public_ip(account.node)
                update_or_create_dns_record(
                    parent_domain,
                    label,
                    HostingDNSRecord.RecordType.A,
                    {"content": target_ip, "ttl": 300, "priority": None},
                )
                update_or_create_dns_record(
                    parent_domain,
                    f"webmail.{label}",
                    HostingDNSRecord.RecordType.A,
                    {"content": target_ip, "ttl": 300, "priority": None},
                )
                sync_domain_dns(parent_domain)
        job_type = (
            AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING
            if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED
            else AgentJob.Type.PROVISION_HOSTING
        )
        queue_account_job(
            account,
            job_type,
            {
                "username": account.username,
                "domain": domain,
                "php_version": account.php_version,
                "document_root": document_root,
                "limits": {
                    "disk_mb": account.disk_mb,
                    "bandwidth_mb": account.bandwidth_mb,
                    "memory_mb": account.memory_mb,
                    "cpu_pct": account.cpu_pct,
                },
            },
        )
        queue_account_job(
            account,
            AgentJob.Type.CREATE_DNS_ZONE,
            {
                "zone": domain,
                "nameserver": f"ns1.{domain}",
                "records": dns_records_payload(hosting_domain),
            },
        )
        queue_account_job(
            account,
            "configure_webmail_domain",
            {
                "domain": domain,
                "username": account.username,
                "ssl_active": False,
            },
        )
    return hosting_domain


def sync_domain_dns(hosting_domain, public_ip="", delete_records=None, apply_template=False, overwrite_template_records=None):
    if apply_template:
        sync_domain_dns_from_template(hosting_domain, public_ip, overwrite_template_records)
    hosting_domain.dns_status = HostingDomain.Status.PENDING
    hosting_domain.save(update_fields=["dns_status", "updated_at"])
    return queue_account_job(
        hosting_domain.account,
        AgentJob.Type.CREATE_DNS_ZONE,
        {
            "zone": hosting_domain.domain,
            "nameserver": f"ns1.{hosting_domain.domain}",
            "records": dns_records_payload(hosting_domain),
            "delete_records": delete_records or [],
        },
    )


def update_or_create_dns_record(hosting_domain, name, record_type, defaults):
    content = defaults.get("content", "")
    last_error = None
    for attempt in range(5):
        try:
            return HostingDNSRecord.objects.update_or_create(
                domain=hosting_domain,
                name=name,
                record_type=record_type,
                content=content,
                defaults=defaults,
            )
        except OperationalError as exc:
            if "database is locked" not in str(exc).lower():
                raise
            last_error = exc
            time.sleep(0.2 * (attempt + 1))
    raise last_error


def dns_records_payload(hosting_domain):
    payload = []
    for record in hosting_domain.records.all():
        value = record.content
        if record.record_type == HostingDNSRecord.RecordType.MX:
            value = f"{record.priority or 10} {record.content.rstrip('.')}."
        elif record.record_type == HostingDNSRecord.RecordType.TXT and not record.content:
            continue
        elif record.record_type == HostingDNSRecord.RecordType.TXT:
            value = dns_txt_value(record.content)
        payload.append(
            {
                "name": record.name,
                "type": record.record_type,
                "value": value,
                "ttl": record.ttl,
            }
        )
    return payload


def apply_dkim_result(hosting_domain, result):
    dkim = (result or {}).get("dkim") or result or {}
    if not isinstance(dkim, dict):
        return False

    selector = str(dkim.get("selector") or hosting_domain.dkim_selector or "ehpanel").strip() or "ehpanel"
    record_value = str(dkim.get("record_value") or "").strip()
    if not record_value:
        return False

    hosting_domain.dkim_selector = selector
    hosting_domain.dkim_txt = record_value
    hosting_domain.dkim_status = HostingDomain.Status.ACTIVE
    hosting_domain.save(update_fields=["dkim_selector", "dkim_txt", "dkim_status", "updated_at"])
    update_or_create_dns_record(
        hosting_domain,
        f"{selector}._domainkey",
        HostingDNSRecord.RecordType.TXT,
        {
            "content": record_value,
            "ttl": 300,
            "priority": None,
        },
    )
    return True


def dns_txt_value(value):
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def explain_ssl_error(code, detail="", result=None):
    text = f"{code or ''} {detail or ''} {(result or {}).get('output', '')} {(result or {}).get('probe_output', '')}".lower()
    if code == "ACME_PROBE_FAILED" or "acme probe" in text or "challenge" in text or "404" in text:
        return "Let's Encrypt no pudo leer el archivo de verificacion HTTP. Confirma que el dominio apunta a este nodo, que Cloudflare este en nube gris y que /.well-known/acme-challenge/ no este bloqueado."
    if "invalid email" in text:
        return "El correo usado para Let's Encrypt no es valido. Usa un correo real, por ejemplo admin@tu-dominio.com."
    if "rate limit" in text or "too many certificates" in text:
        return "Let's Encrypt aplico limite de intentos. Espera antes de reintentar o usa staging para pruebas."
    if "unauthorized" in text:
        return "La autoridad SSL rechazo la verificacion. Normalmente ocurre por DNS mal apuntado, Cloudflare naranja o un redirect que impide el challenge HTTP."
    if "dns" in text or "no valid a records" in text or "servfail" in text:
        return "El DNS del dominio no resuelve correctamente hacia el nodo. Revisa los registros A/AAAA antes de emitir SSL."
    if "cloudflare" in text:
        return "Para este flujo usa Cloudflare en nube gris hasta emitir el certificado. Nube naranja se tratara como caso especial."
    return detail or "No se pudo emitir el certificado SSL. Revisa DNS, webroot y logs del job."


def parse_ssl_expiration(result):
    if not isinstance(result, dict):
        return None
    raw_value = result.get("not_after")
    if not raw_value:
        return None
    parsed = parse_datetime(str(raw_value))
    if parsed is None:
        try:
            parsed = parsedate_to_datetime(str(raw_value))
        except (TypeError, ValueError):
            return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, dt_timezone.utc)
    return parsed


def apply_ssl_success(hosting_domain, result):
    aliases = result.get("aliases") if isinstance(result, dict) else []
    if not isinstance(aliases, list):
        aliases = []
    dns_names = result.get("dns_names") if isinstance(result, dict) else []
    if isinstance(dns_names, list) and dns_names:
        domains = [str(name) for name in dns_names]
    else:
        domains = [hosting_domain.domain, *[str(alias) for alias in aliases]]
    hosting_domain.ssl_status = HostingDomain.Status.ACTIVE
    hosting_domain.ssl_issuer = str(result.get("issuer") or "Let's Encrypt") if isinstance(result, dict) else "Let's Encrypt"
    hosting_domain.ssl_expires_at = parse_ssl_expiration(result)
    hosting_domain.ssl_domains = domains
    hosting_domain.ssl_cert_path = str(result.get("cert") or "") if isinstance(result, dict) else ""
    hosting_domain.ssl_privkey_path = str(result.get("privkey") or "") if isinstance(result, dict) else ""
    hosting_domain.ssl_error_code = ""
    hosting_domain.ssl_error_detail = ""
    hosting_domain.save(
        update_fields=[
            "ssl_status",
            "ssl_issuer",
            "ssl_expires_at",
            "ssl_domains",
            "ssl_cert_path",
            "ssl_privkey_path",
            "ssl_error_code",
            "ssl_error_detail",
            "updated_at",
        ]
    )


def apply_ssl_failure(hosting_domain, job):
    hosting_domain.ssl_status = HostingDomain.Status.FAILED
    hosting_domain.ssl_error_code = job.error_code or "SSL_FAILED"
    hosting_domain.ssl_error_detail = explain_ssl_error(job.error_code, job.error_detail, job.result or {})
    hosting_domain.save(update_fields=["ssl_status", "ssl_error_code", "ssl_error_detail", "updated_at"])


def issue_domain_ssl(hosting_domain, email="", include_www=True, staging=False, force_renewal=False):
    hosting_domain.ssl_status = HostingDomain.Status.PENDING
    hosting_domain.ssl_error_code = ""
    hosting_domain.ssl_error_detail = ""
    hosting_domain.save(update_fields=["ssl_status", "ssl_error_code", "ssl_error_detail", "updated_at"])
    include_www = bool(include_www) and hosting_domain.domain_type != HostingDomain.DomainType.SUBDOMAIN
    aliases = [f"www.{hosting_domain.domain}"] if include_www else []
    webmail_alias = f"webmail.{hosting_domain.domain}"
    if not hosting_domain.domain.startswith("webmail.") and webmail_alias not in aliases:
        aliases.append(webmail_alias)
    for mail_config_alias in [f"autoconfig.{hosting_domain.domain}", f"autodiscover.{hosting_domain.domain}"]:
        if mail_config_alias not in aliases:
            aliases.append(mail_config_alias)
    document_root = (hosting_domain.document_root or "public_html").strip().strip("/")
    return queue_account_job(
        hosting_domain.account,
        AgentJob.Type.ISSUE_SSL,
        {
            "domain": hosting_domain.domain,
            "username": hosting_domain.account.username,
            "email": email or hosting_domain.account.customer_email or f"admin@{hosting_domain.domain}",
            "aliases": aliases,
            "document_root": document_root,
            "webroot": f"/home/{hosting_domain.account.username}/{document_root}",
            "staging": bool(staging),
            "force_renewal": bool(force_renewal),
        },
    )


def configure_domain_webmail(hosting_domain, email="", sync_dns=True, issue_ssl_certificate=True, force_renewal=False, staging=False):
    public_ip = node_public_ip(hosting_domain.account.node)
    dns_job = None
    ssl_job = None
    if sync_dns:
        sync_domain_dns_from_template(hosting_domain, public_ip)
        dns_job = sync_domain_dns(hosting_domain, public_ip, apply_template=False)
    webmail_job = queue_account_job(
        hosting_domain.account,
        "configure_webmail_domain",
        {
            "domain": hosting_domain.domain,
            "username": hosting_domain.account.username,
            "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
        },
    )
    if issue_ssl_certificate:
        ssl_job = issue_domain_ssl(
            hosting_domain,
            email=email,
            include_www=hosting_domain.domain_type != HostingDomain.DomainType.SUBDOMAIN,
            staging=staging,
            force_renewal=force_renewal,
        )
    return {"dns": dns_job, "webmail": webmail_job, "ssl": ssl_job}


def queue_web_protection_apply(hosting_domain, settings):
    account = hosting_domain.account
    document_root = (hosting_domain.document_root or "public_html").strip().strip("/")
    backend_port = 8088 if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED else 8080
    aliases = []
    if hosting_domain.domain_type != HostingDomain.DomainType.SUBDOMAIN:
        aliases.append(f"www.{hosting_domain.domain}")
    job = queue_account_job(
        account,
        AgentJob.Type.APPLY_WEB_PROTECTION,
        {
            "domain": hosting_domain.domain,
            "username": account.username,
            "webroot": f"/home/{account.username}/{document_root}",
            "backend_port": backend_port,
            "aliases": aliases,
            "settings": settings,
            "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
            "cert": hosting_domain.ssl_cert_path or f"/etc/letsencrypt/live/{hosting_domain.domain}/fullchain.pem",
            "privkey": hosting_domain.ssl_privkey_path or f"/etc/letsencrypt/live/{hosting_domain.domain}/privkey.pem",
        },
    )
    hosting_domain.web_protection_last_job = job
    hosting_domain.save(update_fields=["web_protection_last_job", "updated_at"])
    return job


def _recover_protected_directory_password(item):
    jobs = []
    if item.last_job:
        jobs.append(item.last_job)
    jobs.extend(
        AgentJob.objects.filter(
            node=item.domain.account.node,
            job_type=AgentJob.Type.APPLY_PROTECTED_DIRECTORIES,
        )
        .order_by("-queued_at")[:50]
    )
    seen = set()
    for job in jobs:
        if job.id in seen:
            continue
        seen.add(job.id)
        if (job.payload or {}).get("domain") != item.domain.domain:
            continue
        for entry in (job.payload or {}).get("directories", []):
            if entry.get("id") == item.id and entry.get("password"):
                return str(entry["password"])
    return ""


def queue_protected_directories_apply(hosting_domain, password_map=None):
    password_map = password_map or {}
    entries = []
    for item in hosting_domain.protected_directories.order_by("path"):
        payload = {
            "id": item.id,
            "path": item.path,
            "zone": item.zone,
            "username": item.username,
            "enabled": item.enabled,
        }
        if item.id in password_map:
            payload["password"] = password_map[item.id]
        elif item.enabled:
            recovered_password = _recover_protected_directory_password(item)
            if recovered_password:
                payload["password"] = recovered_password
        entries.append(payload)
    job = queue_account_job(
        hosting_domain.account,
        AgentJob.Type.APPLY_PROTECTED_DIRECTORIES,
        {
            "domain": hosting_domain.domain,
            "username": hosting_domain.account.username,
            "backend_port": 8088 if hosting_domain.account.web_engine == HostingAccount.WebEngine.OPENLITESPEED else 8080,
            "directories": entries,
        },
    )
    hosting_domain.protected_directories.update(last_job=job, status=HostingProtectedDirectory.Status.PENDING)
    return job


def queue_waf_apply(hosting_domain, config):
    account = hosting_domain.account
    backend_port = 8088 if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED else 8080
    job = queue_account_job(
        account,
        AgentJob.Type.APPLY_WAF,
        {
            "domain": hosting_domain.domain,
            "username": account.username,
            "backend_port": backend_port,
            "settings": {
                "mode": config.mode,
                "owasp_crs": config.owasp_crs,
                "wordpress_rules": config.wordpress_rules,
                "block_xmlrpc": config.block_xmlrpc,
                "rate_limit_login": config.rate_limit_login,
            },
        },
    )
    config.last_job = job
    config.status = HostingWafConfiguration.Status.PENDING
    config.error = ""
    config.save(update_fields=["last_job", "status", "error", "updated_at"])
    return job


def collect_waf_events(hosting_domain, limit=50):
    limit = max(1, min(int(limit or 50), 200))
    job = AgentJob.objects.create(
        node=hosting_domain.account.node,
        job_type=AgentJob.Type.COLLECT_WAF_EVENTS,
        payload={
            "domain": hosting_domain.domain,
            "username": hosting_domain.account.username,
            "limit": limit,
        },
    )
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + 6
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status == AgentJob.Status.SUCCESS:
            events = job.result.get("events", []) if isinstance(job.result, dict) else []
            return events if isinstance(events, list) else []
        if job.status == AgentJob.Status.FAILED:
            return []
        time.sleep(0.25)
    return []


def queue_ip_blocks_apply(hosting_domain):
    today = timezone.localdate()
    hosting_domain.ip_blocks.filter(enabled=True, expires_on__lt=today).update(status=HostingIPBlock.Status.EXPIRED)
    entries = []
    for item in hosting_domain.ip_blocks.order_by("target"):
        if not item.enabled or item.status == HostingIPBlock.Status.EXPIRED:
            continue
        if item.expires_on and item.expires_on < today:
            continue
        entries.append(
            {
                "id": item.id,
                "target": item.target,
                "reason": item.reason,
                "expires_on": item.expires_on.isoformat() if item.expires_on else None,
            }
        )
    job = queue_account_job(
        hosting_domain.account,
        AgentJob.Type.APPLY_IP_BLOCKS,
        {
            "domain": hosting_domain.domain,
            "username": hosting_domain.account.username,
            "blocks": entries,
        },
    )
    hosting_domain.ip_blocks.exclude(status=HostingIPBlock.Status.EXPIRED).update(last_job=job, status=HostingIPBlock.Status.PENDING)
    return job


def web_protection_ai_mock(hosting_domain):
    settings = hosting_domain.web_protection or {}
    ssl_active = hosting_domain.ssl_status == HostingDomain.Status.ACTIVE
    checks = [
        {
            "label": "HTTPS",
            "status": "ok" if settings.get("force_https", True) and ssl_active else "warning",
            "detail": "Redireccion HTTPS lista." if ssl_active else "Requiere SSL activo para forzar HTTPS sin errores.",
        },
        {
            "label": "HSTS",
            "status": "ok" if settings.get("hsts_enabled") else "info",
            "detail": "HSTS activo." if settings.get("hsts_enabled") else "Puede activarse cuando todos los subdominios tengan SSL.",
        },
        {
            "label": "PHP y cuenta",
            "status": "mock",
            "detail": "Mock IA: luego revisara memory_limit, max_execution_time, post_max_size, upload_max_filesize, display_errors y version PHP.",
        },
    ]
    return {
        "mode": "mock",
        "summary": "Diagnostico IA reservado para integracion futura. Por ahora se muestran reglas tecnicas basicas y sugerencias simuladas.",
        "checks": checks,
    }


def change_database_password(database, password):
    database.status = HostingDatabase.Status.PENDING
    database.save(update_fields=["status", "updated_at"])
    db_user = HostingDatabaseUser.objects.filter(account=database.account, engine=database.engine, username=database.username).first()
    if db_user:
        store_database_credential(db_user, password)
    return queue_account_job(
        database.account,
        AgentJob.Type.CHANGE_DATABASE_PASSWORD,
        {"engine": database.engine, "database": database.name, "user": database.username, "password": password},
    )


def delete_database(database):
    database.status = HostingDatabase.Status.PENDING
    database.save(update_fields=["status", "updated_at"])
    return queue_account_job(
        database.account,
        AgentJob.Type.DELETE_DATABASE,
        {"engine": database.engine, "database": database.name, "user": database.username},
    )


def collect_database_size(database):
    database.size_status = "pending"
    database.save(update_fields=["size_status", "updated_at"])
    return queue_account_job(
        database.account,
        AgentJob.Type.COLLECT_DATABASE_SIZE,
        {"engine": database.engine, "database": database.name, "user": database.username},
    )


def change_mailbox_password(mailbox, password):
    store_mailbox_credential(mailbox, password)
    return queue_account_job(mailbox.account, AgentJob.Type.CHANGE_MAILBOX_PASSWORD, {"email": mailbox.email, "password": password})


def suspend_mailbox(mailbox):
    mailbox.status = HostingMailbox.Status.PENDING
    mailbox.save(update_fields=["status", "updated_at"])
    return queue_account_job(mailbox.account, AgentJob.Type.SUSPEND_MAILBOX, {"email": mailbox.email})


def unsuspend_mailbox(mailbox):
    mailbox.status = HostingMailbox.Status.PENDING
    mailbox.save(update_fields=["status", "updated_at"])
    return queue_account_job(mailbox.account, AgentJob.Type.UNSUSPEND_MAILBOX, {"email": mailbox.email})


def delete_mailbox(mailbox):
    mailbox.status = HostingMailbox.Status.PENDING
    mailbox.save(update_fields=["status", "updated_at"])
    return queue_account_job(mailbox.account, AgentJob.Type.DELETE_MAILBOX, {"email": mailbox.email})


def set_mailbox_quota(mailbox, quota_mb):
    mailbox.quota_mb = quota_mb
    mailbox.status = HostingMailbox.Status.PENDING
    mailbox.save(update_fields=["quota_mb", "status", "updated_at"])
    return queue_account_job(mailbox.account, AgentJob.Type.SET_MAILBOX_QUOTA, {"email": mailbox.email, "quota_mb": quota_mb})


def mailbox_settings_payload(mailbox):
    return {
        "email": mailbox.email,
        "enabled": mailbox.autoresponder_enabled,
        "subject": mailbox.autoresponder_subject,
        "format": mailbox.autoresponder_format,
        "encoding": mailbox.autoresponder_encoding,
        "message": mailbox.autoresponder_message,
        "redirect": mailbox.autoresponder_redirect,
        "unique_limit": mailbox.autoresponder_unique_limit,
        "schedule": mailbox.autoresponder_schedule,
    }


def mailbox_antispam_payload(mailbox):
    payload = dict(mailbox.antispam_settings or {})
    payload.update({"email": mailbox.email, "enabled": mailbox.antispam_enabled})
    return payload


def queue_mailbox_settings_jobs(mailbox):
    queue_account_job(mailbox.account, AgentJob.Type.SET_MAILBOX_ANTISPAM, mailbox_antispam_payload(mailbox))
    queue_account_job(mailbox.account, AgentJob.Type.SET_MAILBOX_AUTORESPONDER, mailbox_settings_payload(mailbox))


def update_mailbox(mailbox, data):
    password = data.pop("password", "")
    quota_mb = data.pop("quota_mb", None)
    changed_settings = False
    simple_fields = [
        "description",
        "outgoing_limit",
        "antispam_enabled",
        "antispam_settings",
        "autoresponder_enabled",
        "autoresponder_subject",
        "autoresponder_format",
        "autoresponder_encoding",
        "autoresponder_message",
        "autoresponder_redirect",
        "autoresponder_unique_limit",
        "autoresponder_schedule",
    ]
    update_fields = []
    for field in simple_fields:
        if field in data:
            setattr(mailbox, field, data[field])
            update_fields.append(field)
            if field.startswith("autoresponder") or field.startswith("antispam"):
                changed_settings = True
    if quota_mb is not None:
        mailbox.quota_mb = quota_mb
        mailbox.status = HostingMailbox.Status.PENDING
        update_fields.extend(["quota_mb", "status"])
    if update_fields:
        mailbox.save(update_fields=[*set(update_fields), "updated_at"])
    if password:
        change_mailbox_password(mailbox, password)
    if quota_mb is not None:
        set_mailbox_quota(mailbox, quota_mb)
    if changed_settings:
        queue_mailbox_settings_jobs(mailbox)
    return mailbox


def sync_mailboxes(account, wait=True):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=AgentJob.Type.LIST_MAILBOXES,
        payload={"account_id": str(account.id), "domain": account.primary_domain},
    )
    transaction.on_commit(lambda job_id=job.id: dispatch_or_execute_local(AgentJob.objects.get(id=job_id)), robust=True)
    if not wait:
        return job
    deadline = timezone.now().timestamp() + 12
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status == AgentJob.Status.SUCCESS:
            for item in (job.result or {}).get("mailboxes", []):
                email = str(item.get("email") or "").lower()
                if not email:
                    continue
                HostingMailbox.objects.update_or_create(
                    account=account,
                    email=email,
                    defaults={
                        "quota_mb": int(item.get("quota_mb") or 1024),
                        "used_mb": int(item.get("used_mb") or 0),
                        "usage_status": "ok",
                        "status": HostingMailbox.Status.SUSPENDED if item.get("suspended") else HostingMailbox.Status.ACTIVE,
                        "last_usage_at": timezone.now(),
                    },
                )
            return job
        if job.status == AgentJob.Status.FAILED:
            return job
        time.sleep(0.35)
    return job


def collect_mailbox_usage(mailbox):
    mailbox.usage_status = "pending"
    mailbox.save(update_fields=["usage_status", "updated_at"])
    return queue_account_job(mailbox.account, AgentJob.Type.COLLECT_MAILBOX_USAGE, {"email": mailbox.email})


def test_mail_delivery(mailbox, recipient, subject=""):
    mailbox.last_test_status = "pending"
    mailbox.last_test_recipient = recipient
    mailbox.last_test_result = {}
    mailbox.last_test_at = timezone.now()
    mailbox.save(update_fields=["last_test_status", "last_test_recipient", "last_test_result", "last_test_at", "updated_at"])
    return queue_account_job(
        mailbox.account,
        AgentJob.Type.TEST_MAIL_DELIVERY,
        {
            "from": mailbox.email,
            "to": recipient,
            "subject": subject or "EHPanel Web - prueba de correo",
        },
    )


def app_safe_slug(value, fallback="app"):
    slug = re.sub(r"[^a-z0-9-]+", "-", str(value or "").strip().lower()).strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug[:48] or fallback


def app_database_defaults(account, runtime, instance_id):
    suffix = app_safe_slug(instance_id, runtime).replace("-", "_")[:24]
    base = f"{account.username}_{suffix}".lower()[:48]
    user = f"{account.username}_{suffix[:18]}".lower()[:48]
    return {
        "database": base,
        "user": user,
        "password": secrets.token_urlsafe(18),
    }


def app_install_suggestions(hosting_domain, runtime, name=""):
    account = hosting_domain.account
    php_versions = account.plan.allowed_php_versions if account.plan and account.plan.allowed_php_versions else ["8.3", "8.4", "8.5"]
    node_versions = ["system", "20", "22", "24"]
    runtime = str(runtime or "wordpress").lower()
    label = name or {
        HostingApplication.AppType.WORDPRESS: "WordPress",
        HostingApplication.AppType.DJANGO: "Django",
        HostingApplication.AppType.PYTHON: "Python",
        HostingApplication.AppType.NODEJS: "Node.js",
        HostingApplication.AppType.LARAVEL: "Laravel",
        HostingApplication.AppType.MOODLE: "Moodle",
    }.get(runtime, "App")
    if runtime == HostingApplication.AppType.WORDPRESS:
        instance_source = f"wp-{hosting_domain.domain.split('.')[0]}"
    elif runtime == HostingApplication.AppType.MOODLE:
        instance_source = f"moodle-{hosting_domain.domain.split('.')[0]}"
    else:
        instance_source = label
    instance_id = app_safe_slug(instance_source, runtime)
    database = app_database_defaults(account, runtime, instance_id)
    port_seed = secrets.randbelow(20000)
    port = 18000 + port_seed
    working_dir = f"/home/{account.username}/apps/{instance_id}"
    return {
        "runtime": runtime,
        "domain": hosting_domain.id,
        "domain_name": hosting_domain.domain,
        "name": label,
        "instance_id": instance_id,
        "port": port,
        "working_dir": working_dir,
        "database": database,
        "php_versions": php_versions,
        "node_versions": node_versions,
        "wordpress": {
            "site_title": label,
            "admin_user": "admin",
            "admin_password": secrets.token_urlsafe(16),
            "admin_email": account.customer_email or f"admin@{hosting_domain.domain}",
            "language": "es_ES",
            "table_prefix": "wp_",
        },
        "moodle": {
            "site_title": label,
            "site_shortname": hosting_domain.domain.split(".")[0][:20] or "moodle",
            "admin_user": "admin",
            "admin_password": f"{secrets.token_urlsafe(12)}Aa1!",
            "admin_email": account.customer_email or f"admin@{hosting_domain.domain}",
            "language": "es",
            "table_prefix": "mdl_",
            "php_version": account.php_version if account.php_version in php_versions else php_versions[0],
            "database_engine": HostingDatabase.Engine.MARIADB,
        },
        "django": {
            "project_module": "ehpanelapp",
            "django_version": "5.0.*",
            "workers": 2,
            "database_engine": HostingDatabase.Engine.POSTGRESQL,
        },
        "laravel": {
            "php_version": account.php_version if account.php_version in php_versions else php_versions[0],
            "database_engine": HostingDatabase.Engine.MARIADB,
        },
        "nodejs": {
            "script": "server.js",
            "node_version": "",
            "database_engine": HostingDatabase.Engine.MARIADB,
            "create_database": False,
        },
        "python": {
            "wsgi_module": "app:application",
            "workers": 1,
            "database_engine": HostingDatabase.Engine.MARIADB,
            "create_database": False,
        },
        "security": {
            "force_https": True,
            "secure_permissions": True,
            "disable_debug": True,
            "auto_backup_after_install": False,
        },
    }


def register_app_database(account, engine, db_name, db_user, db_password, access=None):
    access = access or HostingDatabaseUser.Access.ADMIN
    database, _ = HostingDatabase.objects.update_or_create(
        account=account,
        name=db_name,
        defaults={"engine": engine, "username": db_user, "status": HostingDatabase.Status.PENDING},
    )
    user, _ = HostingDatabaseUser.objects.update_or_create(
        account=account,
        engine=engine,
        username=db_user,
        defaults={"access": access, "hosts": ["localhost"], "status": HostingDatabaseUser.Status.PENDING},
    )
    store_database_credential(user, db_password)
    HostingDatabaseGrant.objects.update_or_create(
        database=database,
        user=user,
        defaults={"access": access, "privileges": privileges_for_access(access)},
    )
    return database


def install_catalog_app(runtime, hosting_domain, payload):
    runtime = str(runtime or "").lower()
    if runtime == HostingApplication.AppType.WORDPRESS:
        return install_wordpress(
            hosting_domain,
            payload.get("site_title") or payload.get("name") or "WordPress",
            payload["db_name"],
            payload["db_user"],
            payload["db_password"],
            payload["admin_user"],
            payload["admin_password"],
            payload["admin_email"],
            payload.get("table_prefix", "wp_"),
            payload.get("force", False),
            payload.get("language", "es_ES"),
        )
    if runtime == HostingApplication.AppType.MOODLE:
        return install_moodle(
            hosting_domain,
            payload.get("site_title") or payload.get("name") or "Moodle",
            payload["db_name"],
            payload["db_user"],
            payload["db_password"],
            payload["admin_user"],
            payload["admin_password"],
            payload["admin_email"],
            payload.get("table_prefix", "mdl_"),
            payload.get("force", False),
            payload.get("language", "es"),
            payload.get("php_version", ""),
        )
    if runtime == HostingApplication.AppType.DJANGO:
        return deploy_django_app(
            hosting_domain,
            payload["name"],
            payload["instance_id"],
            payload["port"],
            payload["working_dir"],
            payload.get("project_module", "ehpanelapp"),
            payload.get("django_version", ""),
            payload.get("workers", 2),
            payload.get("database_engine", HostingDatabase.Engine.POSTGRESQL),
            payload.get("db_name", ""),
            payload.get("db_user", ""),
            payload.get("db_password", ""),
        )
    if runtime == HostingApplication.AppType.LARAVEL:
        return deploy_laravel_app(
            hosting_domain,
            payload["name"],
            payload["instance_id"],
            payload["port"],
            payload["working_dir"],
            payload.get("php_version", ""),
            payload.get("database_engine", HostingDatabase.Engine.MARIADB),
            payload.get("db_name", ""),
            payload.get("db_user", ""),
            payload.get("db_password", ""),
        )
    if runtime == HostingApplication.AppType.NODEJS:
        return deploy_node_app(
            hosting_domain,
            payload["name"],
            payload["instance_id"],
            payload["port"],
            payload["working_dir"],
            payload.get("script", "server.js"),
            payload.get("node_version", ""),
        )
    return deploy_python_app(
        hosting_domain,
        payload["name"],
        payload["instance_id"],
        payload["port"],
        payload["working_dir"],
        payload.get("wsgi_module", "app:application"),
        payload.get("workers", 1),
    )


def hosting_domain_base_url(hosting_domain, path=""):
    scheme = "https" if hosting_domain.ssl_status == HostingDomain.Status.ACTIVE else "http"
    return f"{scheme}://{hosting_domain.domain}{path}"


def install_wordpress(hosting_domain, site_title, db_name, db_user, db_password, admin_user, admin_password, admin_email, table_prefix="wp_", force=False, language="es_ES"):
    account = hosting_domain.account
    document_root = hosting_domain.document_root or "public_html"
    install_path = f"/home/{account.username}/{document_root.strip('/')}"
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.WORDPRESS,
            defaults={
                "account": account,
                "name": site_title or f"WordPress - {hosting_domain.domain}",
                "install_path": install_path,
                "url": hosting_domain_base_url(hosting_domain),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "database": db_name,
                    "db_user": db_user,
                    "admin_user": admin_user,
                    "admin_email": admin_email,
                    "language": language,
                    "table_prefix": table_prefix,
                    "instance_id": f"wp-{hosting_domain.id}",
                    "port": 0,
                },
            },
        )
        register_app_database(account, HostingDatabase.Engine.MARIADB, db_name, db_user, db_password)
        job = queue_account_job(
            account,
            AgentJob.Type.INSTALL_WORDPRESS,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "working_dir": document_root,
                "document_root": document_root,
                "database": db_name,
                "db_user": db_user,
                "db_password": db_password,
                "site_title": site_title,
                "admin_user": admin_user,
                "admin_password": admin_password,
                "admin_email": admin_email,
                "language": language,
                "table_prefix": table_prefix,
                "force": bool(force),
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def install_moodle(hosting_domain, site_title, db_name, db_user, db_password, admin_user, admin_password, admin_email, table_prefix="mdl_", force=False, language="es", php_version=""):
    account = hosting_domain.account
    document_root = hosting_domain.document_root or "public_html"
    install_path = f"/home/{account.username}/{document_root.strip('/')}"
    moodledata_path = f"/home/{account.username}/moodledata/{hosting_domain.domain}"
    php_version = php_version or account.php_version or "8.3"
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.MOODLE,
            defaults={
                "account": account,
                "name": site_title or f"Moodle - {hosting_domain.domain}",
                "install_path": install_path,
                "url": hosting_domain_base_url(hosting_domain),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "database": db_name,
                    "db_user": db_user,
                    "admin_user": admin_user,
                    "admin_email": admin_email,
                    "language": language,
                    "table_prefix": table_prefix,
                    "php_version": php_version,
                    "moodledata_path": moodledata_path,
                    "instance_id": f"moodle-{hosting_domain.id}",
                    "port": 0,
                    "runtime": "moodle",
                },
            },
        )
        register_app_database(account, HostingDatabase.Engine.MARIADB, db_name, db_user, db_password)
        job = queue_account_job(
            account,
            AgentJob.Type.INSTALL_MOODLE,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "working_dir": document_root,
                "document_root": document_root,
                "database": db_name,
                "db_user": db_user,
                "db_password": db_password,
                "site_title": site_title,
                "site_shortname": hosting_domain.domain.split(".")[0][:20] or "moodle",
                "admin_user": admin_user,
                "admin_password": admin_password,
                "admin_email": admin_email,
                "language": language,
                "table_prefix": table_prefix,
                "php_version": php_version,
                "moodledata_path": moodledata_path,
                "force": bool(force),
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def queue_wordpress_update(app):
    if app.app_type != HostingApplication.AppType.WORDPRESS:
        raise ValueError("Solo WordPress puede actualizarse con esta accion.")
    app.status = HostingApplication.Status.PENDING
    app.save(update_fields=["status", "updated_at"])
    job = queue_account_job(
        app.account,
        AgentJob.Type.UPDATE_WORDPRESS,
        {
            "app_id": app.id,
            "username": app.account.username,
            "domain": app.domain.domain,
            "path": app.install_path,
        },
    )
    app.last_job = job
    app.save(update_fields=["last_job", "updated_at"])
    return job


def queue_wordpress_delete(app, delete_files=True, delete_database=True):
    if app.app_type != HostingApplication.AppType.WORDPRESS:
        raise ValueError("Solo WordPress puede eliminarse con esta accion.")
    metadata = app.metadata or {}
    app.status = HostingApplication.Status.PENDING
    app.save(update_fields=["status", "updated_at"])
    job = queue_account_job(
        app.account,
        AgentJob.Type.DELETE_WORDPRESS,
        {
            "app_id": app.id,
            "username": app.account.username,
            "domain": app.domain.domain,
            "path": app.install_path,
            "database": metadata.get("database", ""),
            "db_user": metadata.get("db_user", ""),
            "delete_files": bool(delete_files),
            "delete_database": bool(delete_database),
        },
    )
    app.last_job = job
    app.save(update_fields=["last_job", "updated_at"])
    return job


def run_wordpress_toolkit(app, action="summary", target_type="", target="", value="", timeout=12):
    if app.app_type != HostingApplication.AppType.WORDPRESS:
        raise ValueError("Solo WordPress soporta EHPanel WP Toolkit.")
    payload = {
        "app_id": app.id,
        "username": app.account.username,
        "domain": app.domain.domain,
        "path": app.install_path,
        "action": action or "summary",
        "target_type": target_type or "",
        "target": target or "",
        "value": value or "",
    }
    job = AgentJob.objects.create(node=app.account.node, job_type=AgentJob.Type.WORDPRESS_TOOLKIT, payload=payload)
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    app.last_job = job
    if job.status == AgentJob.Status.SUCCESS and payload["action"] != "autologin":
        metadata = {key: value for key, value in (app.metadata or {}).items() if key not in ["error_code", "error_detail"]}
        app.metadata = {**metadata, "wordpress_toolkit": job.result or {}}
        if (job.result or {}).get("wp_version"):
            app.version = job.result["wp_version"]
        app.save(update_fields=["last_job", "metadata", "version", "updated_at"])
    else:
        app.save(update_fields=["last_job", "updated_at"])
    return job


def run_wordpress_autologin(app, target="", timeout=12):
    return run_wordpress_toolkit(app, action="autologin", target=target, timeout=timeout)


def run_python_toolkit(app, action="summary", repo_url="", branch="", timeout=12):
    if app.app_type not in [HostingApplication.AppType.PYTHON, HostingApplication.AppType.DJANGO]:
        raise ValueError("Solo Python/Django soporta EHPanel Python Tool.")
    metadata = app.metadata or {}
    git_config = metadata.get("git") if isinstance(metadata.get("git"), dict) else {}
    payload = {
        "app_id": app.id,
        "username": app.account.username,
        "domain": app.domain.domain,
        "path": app.install_path or metadata.get("working_dir", ""),
        "instance_id": metadata.get("instance_id") or f"{app.app_type}-{app.id}",
        "project_module": metadata.get("project_module", ""),
        "action": action or "summary",
        "repo_url": repo_url or git_config.get("repo_url", ""),
        "branch": branch or git_config.get("branch", "main"),
    }
    job = AgentJob.objects.create(node=app.account.node, job_type=AgentJob.Type.PYTHON_TOOLKIT, payload=payload)
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    app.last_job = job
    if job.status == AgentJob.Status.SUCCESS:
        metadata = {key: value for key, value in (app.metadata or {}).items() if key not in ["error_code", "error_detail"]}
        app.metadata = {**metadata, "python_toolkit": job.result or {}}
        django_version = (job.result or {}).get("django_version")
        python_version = (job.result or {}).get("python_version")
        if django_version:
            app.version = f"Django {django_version}"
        elif python_version:
            app.version = str(python_version)
        app.save(update_fields=["last_job", "metadata", "version", "updated_at"])
    else:
        app.save(update_fields=["last_job", "updated_at"])
    return job


def run_node_toolkit(app, action="summary", repo_url="", branch="", timeout=12):
    if app.app_type != HostingApplication.AppType.NODEJS:
        raise ValueError("Solo Node.js soporta EHPanel Node Tool.")
    metadata = app.metadata or {}
    git_config = metadata.get("git") if isinstance(metadata.get("git"), dict) else {}
    payload = {
        "app_id": app.id,
        "username": app.account.username,
        "domain": app.domain.domain,
        "path": app.install_path or metadata.get("working_dir", ""),
        "instance_id": metadata.get("instance_id") or f"{app.app_type}-{app.id}",
        "script": metadata.get("script", "server.js"),
        "action": action or "summary",
        "repo_url": repo_url or git_config.get("repo_url", ""),
        "branch": branch or git_config.get("branch", "main"),
    }
    job = AgentJob.objects.create(node=app.account.node, job_type=AgentJob.Type.NODE_TOOLKIT, payload=payload)
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    app.last_job = job
    if job.status == AgentJob.Status.SUCCESS:
        metadata = {key: value for key, value in (app.metadata or {}).items() if key not in ["error_code", "error_detail"]}
        app.metadata = {**metadata, "node_toolkit": job.result or {}}
        node_version = (job.result or {}).get("node_version")
        package_version = (job.result or {}).get("package_version")
        if node_version and package_version:
            app.version = f"{node_version} / {package_version}"
        elif node_version:
            app.version = str(node_version)
        app.save(update_fields=["last_job", "metadata", "version", "updated_at"])
    else:
        app.save(update_fields=["last_job", "updated_at"])
    return job


def run_laravel_toolkit(app, action="summary", repo_url="", branch="", timeout=12):
    if app.app_type != HostingApplication.AppType.LARAVEL:
        raise ValueError("Solo Laravel soporta EHPanel Laravel Tool.")
    metadata = app.metadata or {}
    git_config = metadata.get("git") if isinstance(metadata.get("git"), dict) else {}
    payload = {
        "app_id": app.id,
        "username": app.account.username,
        "domain": app.domain.domain,
        "path": app.install_path or metadata.get("working_dir", ""),
        "instance_id": metadata.get("instance_id") or f"{app.app_type}-{app.id}",
        "action": action or "summary",
        "repo_url": repo_url or git_config.get("repo_url", ""),
        "branch": branch or git_config.get("branch", "main"),
    }
    job = AgentJob.objects.create(node=app.account.node, job_type=AgentJob.Type.LARAVEL_TOOLKIT, payload=payload)
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            break
        time.sleep(0.25)
    app.last_job = job
    if job.status == AgentJob.Status.SUCCESS:
        metadata = {key: value for key, value in (app.metadata or {}).items() if key not in ["error_code", "error_detail"]}
        app.metadata = {**metadata, "laravel_toolkit": job.result or {}}
        laravel_version = (job.result or {}).get("laravel_version")
        php_version = (job.result or {}).get("php_version")
        if laravel_version:
            app.version = str(laravel_version)
        elif php_version:
            app.version = str(php_version)
        app.save(update_fields=["last_job", "metadata", "version", "updated_at"])
    else:
        app.save(update_fields=["last_job", "updated_at"])
    return job


def deploy_python_app(hosting_domain, name, instance_id, port, working_dir, wsgi_module, workers=1):
    account = hosting_domain.account
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.PYTHON,
            defaults={
                "account": account,
                "name": name,
                "install_path": working_dir,
                "url": hosting_domain_base_url(hosting_domain, f"/__apps/{instance_id}/"),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "instance_id": instance_id,
                    "port": port,
                    "working_dir": working_dir,
                    "wsgi_module": wsgi_module,
                    "workers": workers,
                    "runtime": "python",
                },
            },
        )
        job = queue_account_job(
            account,
            AgentJob.Type.DEPLOY_PYTHON_APP,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "name": name,
                "instance_id": instance_id,
                "port": port,
                "working_dir": working_dir,
                "wsgi_module": wsgi_module,
                "workers": workers,
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def deploy_node_app(hosting_domain, name, instance_id, port, working_dir, script="server.js", node_version=""):
    account = hosting_domain.account
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.NODEJS,
            defaults={
                "account": account,
                "name": name,
                "install_path": working_dir,
                "url": hosting_domain_base_url(hosting_domain, f"/__apps/{instance_id}/"),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "instance_id": instance_id,
                    "port": port,
                    "working_dir": working_dir,
                    "script": script,
                    "node_version": node_version,
                    "runtime": "nodejs",
                },
            },
        )
        job = queue_account_job(
            account,
            AgentJob.Type.DEPLOY_NODE_APP,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "name": name,
                "instance_id": instance_id,
                "port": port,
                "working_dir": working_dir,
                "script": script,
                "node_version": node_version,
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def deploy_django_app(hosting_domain, name, instance_id, port, working_dir, project_module="ehpanelapp", django_version="", workers=2, database_engine="", db_name="", db_user="", db_password=""):
    account = hosting_domain.account
    database_payload = {}
    if db_name and db_user and db_password:
        database_engine = database_engine or HostingDatabase.Engine.POSTGRESQL
        register_app_database(account, database_engine, db_name, db_user, db_password)
        database_payload = {
            "database_engine": database_engine,
            "database": db_name,
            "db_user": db_user,
            "db_password": db_password,
        }
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.DJANGO,
            defaults={
                "account": account,
                "name": name,
                "install_path": working_dir,
                "url": hosting_domain_base_url(hosting_domain, f"/__apps/{instance_id}/"),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "instance_id": instance_id,
                    "port": port,
                    "working_dir": working_dir,
                    "project_module": project_module,
                    "django_version": django_version,
                    "workers": workers,
                    "runtime": "django",
                    **{k: v for k, v in database_payload.items() if k != "db_password"},
                },
            },
        )
        job = queue_account_job(
            account,
            AgentJob.Type.DEPLOY_DJANGO_APP,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "name": name,
                "instance_id": instance_id,
                "port": port,
                "working_dir": working_dir,
                "project_module": project_module,
                "django_version": django_version,
                "workers": workers,
                **database_payload,
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def deploy_laravel_app(hosting_domain, name, instance_id, port, working_dir, php_version="", database_engine="", db_name="", db_user="", db_password=""):
    account = hosting_domain.account
    database_payload = {}
    if db_name and db_user and db_password:
        database_engine = database_engine or HostingDatabase.Engine.MARIADB
        register_app_database(account, database_engine, db_name, db_user, db_password)
        database_payload = {
            "database_engine": database_engine,
            "database": db_name,
            "db_user": db_user,
            "db_password": db_password,
        }
    with transaction.atomic():
        app, _created = HostingApplication.objects.update_or_create(
            domain=hosting_domain,
            app_type=HostingApplication.AppType.LARAVEL,
            defaults={
                "account": account,
                "name": name,
                "install_path": working_dir,
                "url": hosting_domain_base_url(hosting_domain, f"/__apps/{instance_id}/"),
                "status": HostingApplication.Status.INSTALLING,
                "metadata": {
                    "instance_id": instance_id,
                    "port": port,
                    "working_dir": working_dir,
                    "php_version": php_version,
                    "runtime": "laravel",
                    **{k: v for k, v in database_payload.items() if k != "db_password"},
                },
            },
        )
        job = queue_account_job(
            account,
            AgentJob.Type.DEPLOY_LARAVEL_APP,
            {
                "app_id": app.id,
                "username": account.username,
                "domain": hosting_domain.domain,
                "ssl_active": hosting_domain.ssl_status == HostingDomain.Status.ACTIVE,
                "name": name,
                "instance_id": instance_id,
                "port": port,
                "working_dir": working_dir,
                "php_version": php_version,
                **database_payload,
            },
        )
        app.last_job = job
        app.save(update_fields=["last_job", "updated_at"])
    return app


def queue_app_action(app, action):
    if action not in ["start", "stop", "restart"]:
        raise ValueError("Unsupported app action")
    app.status = HostingApplication.Status.PENDING
    app.save(update_fields=["status", "updated_at"])
    return queue_account_job(
        app.account,
        AgentJob.Type.APP_ACTION,
        {
            "app_id": app.id,
            "username": app.account.username,
            "instance_id": app.metadata.get("instance_id"),
            "runtime": app.app_type,
            "action": action,
        },
    )


def collect_app_logs(app, limit=120):
    job = AgentJob.objects.create(
        node=app.account.node,
        job_type=AgentJob.Type.COLLECT_APP_LOGS,
        payload={
            "app_id": app.id,
            "username": app.account.username,
            "instance_id": app.metadata.get("instance_id"),
            "runtime": app.app_type,
            "limit": limit,
        },
    )
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + 6
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status == AgentJob.Status.SUCCESS:
            return job.result.get("lines", [])
        if job.status == AgentJob.Status.FAILED:
            return [job.error_detail or job.error_code or "No se pudieron obtener logs."]
        time.sleep(0.25)
    return ["La solicitud de logs sigue en proceso. Actualiza nuevamente en unos segundos."]


DEFAULT_APP_CATALOG = [
    {"slug": "wordpress", "name": "WordPress", "type": "CMS", "runtime": "wordpress", "detail": "Blog, web corporativa, WooCommerce", "status": "available", "requirements": ["PHP 8.1+", "MariaDB", "WP-CLI opcional"]},
    {"slug": "moodle", "name": "Moodle", "type": "LMS", "runtime": "moodle", "detail": "Campus virtual y cursos online", "status": "available", "requirements": ["PHP 8.3+", "MariaDB 10.11+", "Cron cada 5 minutos", "moodledata fuera del webroot"]},
    {"slug": "laravel", "name": "Laravel", "type": "Framework PHP", "runtime": "laravel", "detail": "Aplicacion PHP moderna", "status": "available", "requirements": ["PHP 8.2+", "Composer", "MariaDB o PostgreSQL"]},
    {"slug": "django", "name": "Django", "type": "Python", "runtime": "django", "detail": "Aplicacion WSGI/ASGI", "status": "available", "requirements": ["Python 3.12", "pip/venv", "MariaDB o PostgreSQL"]},
    {"slug": "nodejs", "name": "Node.js", "type": "Runtime", "runtime": "nodejs", "detail": "SSR, API o app web", "status": "available", "requirements": ["Node.js", "pnpm/npm", "Puerto interno disponible"]},
]


def app_catalog():
    catalog_path = getattr(settings, "EHPANEL_APP_CATALOG_PATH", "/opt/server0/app-catalog.json")
    try:
        with open(catalog_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        apps = payload.get("apps", payload) if isinstance(payload, dict) else payload
        if isinstance(apps, list):
            return apps
    except (OSError, json.JSONDecodeError):
        pass
    return DEFAULT_APP_CATALOG


def detect_account_apps(account):
    domains = [
        {"id": domain.id, "domain": domain.domain, "document_root": domain.document_root or "public_html"}
        for domain in account.domains.all()
    ]
    job = queue_account_job(
        account,
        AgentJob.Type.DETECT_APPS,
        {"username": account.username, "domains": domains},
    )
    deadline = timezone.now().timestamp() + 10
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status == AgentJob.Status.SUCCESS:
            return upsert_detected_apps(account, job.result.get("apps", []), job)
        if job.status == AgentJob.Status.FAILED:
            return []
        time.sleep(0.25)
    return []


def upsert_detected_apps(account, apps, job=None):
    synced = []
    domains_by_name = {domain.domain: domain for domain in account.domains.all()}
    for item in apps or []:
        domain = domains_by_name.get(item.get("domain"))
        if not domain:
            continue
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        app, _created = HostingApplication.objects.update_or_create(
            domain=domain,
            app_type=item.get("app_type") or HostingApplication.AppType.WORDPRESS,
            defaults={
                "account": account,
                "name": item.get("name") or f"WordPress - {domain.domain}",
                "install_path": item.get("install_path") or f"/home/{account.username}/{domain.document_root or 'public_html'}",
                "url": item.get("url") or f"https://{domain.domain}",
                "status": HostingApplication.Status.ACTIVE,
                "version": item.get("version") or "",
                "metadata": {**metadata, "detected": True},
                "last_job": job,
            },
        )
        synced.append(app)
    return synced


def detect_all_apps_for_user(user):
    apps = []
    for account in scoped_accounts(HostingAccount.objects.prefetch_related("domains"), user):
        apps.extend(detect_account_apps(account))
    return apps


def queue_app_update_check(app):
    job = queue_account_job(
        app.account,
        AgentJob.Type.CHECK_APP_UPDATES,
        {"app_id": app.id, "app_type": app.app_type, "version": app.version, "install_path": app.install_path},
    )
    app.last_job = job
    app.save(update_fields=["last_job", "updated_at"])
    return job


def queue_app_backup(app):
    backup = HostingApplicationBackup.objects.create(app=app, status=HostingApplicationBackup.Status.PENDING)
    metadata = app.metadata or {}
    instance_id = metadata.get("instance_id") or f"{app.app_type}-{app.id}"
    job = queue_account_job(
        app.account,
        AgentJob.Type.BACKUP_APP,
        {
            "app_id": app.id,
            "backup_id": backup.id,
            "username": app.account.username,
            "instance_id": instance_id,
            "install_path": app.install_path,
            "app_type": app.app_type,
        },
    )
    backup.last_job = job
    backup.status = HostingApplicationBackup.Status.RUNNING
    backup.save(update_fields=["last_job", "status", "updated_at"])
    return backup


def queue_app_delete(app, delete_files=True):
    if app.app_type == HostingApplication.AppType.WORDPRESS:
        return queue_wordpress_delete(app, delete_files=delete_files, delete_database=True)
    metadata = app.metadata or {}
    instance_id = metadata.get("instance_id") or f"{app.app_type}-{app.id}"
    app.status = HostingApplication.Status.PENDING
    app.save(update_fields=["status", "updated_at"])
    job = queue_account_job(
        app.account,
        AgentJob.Type.DELETE_APP,
        {
            "app_id": app.id,
            "username": app.account.username,
            "domain": app.domain.domain,
            "instance_id": instance_id,
            "runtime": app.app_type,
            "install_path": app.install_path,
            "delete_files": bool(delete_files),
        },
    )
    app.last_job = job
    app.save(update_fields=["last_job", "updated_at"])
    return job


def sftp_connection_info(account):
    host = account.node.hostname
    user = account.username
    root = f"/home/{user}"
    webroot = f"{root}/public_html"
    return {
        "host": host,
        "port": 21,
        "username": user,
        "root": root,
        "webroot": webroot,
        "protocol": "FTPES / explicit TLS",
        "command": f"ftpes://{user}@{host}:21",
        "ftps": {
            "host": host,
            "port": 21,
            "protocol": "FTPES / explicit TLS",
            "passive_ports": "30000-30100",
        },
        "isolation": "Cuenta FTP/FTPS aislada por /home/<usuario>; el panel no publica acceso por SSH.",
    }


def run_account_file_job(account, job_type, payload, timeout=10):
    job = AgentJob.objects.create(
        node=account.node,
        job_type=job_type,
        payload={"username": account.username, **payload},
    )
    dispatch_or_execute_local(job)
    deadline = timezone.now().timestamp() + timeout
    while timezone.now().timestamp() < deadline:
        job.refresh_from_db()
        if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED]:
            return job
        time.sleep(0.25)
    return job


def sync_job_side_effects(job):
    if job.job_type == AgentJob.Type.BACKUP_ACCOUNT:
        if sync_account_export_from_job(job):
            return

    if job.job_type in [AgentJob.Type.MIGRATION_DISCOVER, AgentJob.Type.MIGRATE_ACCOUNT]:
        if sync_migration_from_job(job):
            return

    if job.job_type == AgentJob.Type.COLLECT_ACCOUNT_USAGE and job.status == AgentJob.Status.SUCCESS:
        account_id = (job.payload or {}).get("account_id")
        account = HostingAccount.objects.filter(id=account_id).first()
        if account:
            account.last_usage = normalize_account_usage(account, job.result or {})
            account.last_usage_at = timezone.now()
            account.save(update_fields=["last_usage", "last_usage_at", "updated_at"])
        return

    if job.job_type in [AgentJob.Type.PROVISION_HOSTING, AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING]:
        username = (job.payload or {}).get("username")
        account = HostingAccount.objects.filter(node=job.node, username=username).first()
        if account and job.status == AgentJob.Status.SUCCESS:
            account.status = HostingAccount.Status.ACTIVE
            account.save(update_fields=["status", "updated_at"])
        elif account and job.status == AgentJob.Status.FAILED:
            account.status = HostingAccount.Status.FAILED
            account.save(update_fields=["status", "updated_at"])
        return

    if job.job_type == AgentJob.Type.COLLECT_ACCOUNT_MONITORING and job.status == AgentJob.Status.SUCCESS:
        account_id = (job.payload or {}).get("account_id")
        account = HostingAccount.objects.filter(id=account_id).first()
        if account:
            sync_account_monitoring_from_result(account, job.result or {})
        return

    if job.job_type == AgentJob.Type.RUN_WEB_PERFORMANCE_AUDIT:
        audit_id = (job.payload or {}).get("audit_id")
        performance = HostingPerformanceAudit.objects.filter(id=audit_id).first()
        if performance:
            performance.job = job
            performance.finished_at = timezone.now() if job.status in [AgentJob.Status.SUCCESS, AgentJob.Status.FAILED] else performance.finished_at
            if job.status == AgentJob.Status.SUCCESS:
                performance.status = HostingPerformanceAudit.Status.COMPLETED
                performance.result = job.result or {}
                performance.error_code = ""
                performance.error_detail = ""
            elif job.status == AgentJob.Status.FAILED:
                performance.status = HostingPerformanceAudit.Status.FAILED
                performance.result = job.result or {}
                performance.error_code = job.error_code
                performance.error_detail = job.error_detail
            performance.save(update_fields=["job", "status", "result", "error_code", "error_detail", "finished_at", "updated_at"])
        return

    if job.job_type == AgentJob.Type.SERVICE_ACTION and (job.payload or {}).get("action") == "apply_advanced_item":
        item_id = (job.payload or {}).get("item_id")
        item = HostingAdvancedItem.objects.filter(id=item_id).first()
        if item:
            item.last_job = job
            if job.status == AgentJob.Status.SUCCESS:
                item.status = HostingAdvancedItem.Status.DISABLED if not (job.payload or {}).get("enabled", True) else HostingAdvancedItem.Status.ACTIVE
            elif job.status == AgentJob.Status.FAILED:
                item.status = HostingAdvancedItem.Status.FAILED
            item.save(update_fields=["status", "last_job", "updated_at"])
        return

    scan_id = (job.payload or {}).get("scan_id")
    if scan_id and job.job_type == AgentJob.Type.SECURITY_SCAN:
        scan = HostingSecurityScan.objects.filter(id=scan_id).first()
        if scan:
            sync_security_scan_from_job(scan, job)

    app_id = (job.payload or {}).get("app_id")
    if app_id:
        app = HostingApplication.objects.filter(id=app_id).first()
        if app:
            if job.status == AgentJob.Status.SUCCESS:
                if job.job_type in [AgentJob.Type.DELETE_WORDPRESS, AgentJob.Type.DELETE_APP]:
                    database_name = (job.payload or {}).get("database") or (app.metadata or {}).get("database")
                    if database_name and job.job_type == AgentJob.Type.DELETE_WORDPRESS:
                        HostingDatabase.objects.filter(account=app.account, name=database_name).delete()
                    app.delete()
                    return
                metadata = {key: value for key, value in (app.metadata or {}).items() if key not in ["error_code", "error_detail"]}
                app.metadata = {**metadata, **(job.result or {})}
                app.status = HostingApplication.Status.ACTIVE
                if job.job_type == AgentJob.Type.APP_ACTION:
                    result_status = (job.result or {}).get("status")
                    if result_status == "stopped":
                        app.status = HostingApplication.Status.STOPPED
                    elif result_status == "active":
                        app.status = HostingApplication.Status.ACTIVE
                if (job.result or {}).get("url"):
                    app.url = job.result["url"]
                if (job.result or {}).get("wp_version") or (job.result or {}).get("moodle_version"):
                    app.version = (job.result or {}).get("wp_version") or (job.result or {}).get("moodle_version")
                    app.save(update_fields=["status", "version", "url", "metadata", "updated_at"])
                elif job.job_type == AgentJob.Type.CHECK_APP_UPDATES:
                    app.metadata = {**(app.metadata or {}), "updates": job.result or {}}
                    app.save(update_fields=["status", "metadata", "updated_at"])
                else:
                    app.save(update_fields=["status", "url", "metadata", "updated_at"])
                database_name = (job.payload or {}).get("database")
                if database_name:
                    HostingDatabase.objects.filter(name=database_name).update(status=HostingDatabase.Status.ACTIVE)
                    db_username = (job.payload or {}).get("db_user") or (job.payload or {}).get("user")
                    if db_username:
                        HostingDatabaseUser.objects.filter(account=app.account, username=db_username).update(status=HostingDatabaseUser.Status.ACTIVE)
            elif job.status == AgentJob.Status.FAILED:
                app.status = HostingApplication.Status.FAILED
                app.metadata = {**(app.metadata or {}), "error_code": job.error_code, "error_detail": job.error_detail}
                app.save(update_fields=["status", "metadata", "updated_at"])

    backup_id = (job.payload or {}).get("backup_id")
    if backup_id and job.job_type == AgentJob.Type.BACKUP_APP:
        backup = HostingApplicationBackup.objects.filter(id=backup_id).first()
        if backup:
            if job.status == AgentJob.Status.SUCCESS:
                backup.status = HostingApplicationBackup.Status.COMPLETED
                backup.archive_path = (job.result or {}).get("archive_path", "")
                backup.filename = (job.result or {}).get("filename", "")
                backup.size_bytes = int((job.result or {}).get("size_bytes") or 0)
                backup.error_code = ""
                backup.error_detail = ""
                backup.save(update_fields=["status", "archive_path", "filename", "size_bytes", "error_code", "error_detail", "updated_at"])
            elif job.status == AgentJob.Status.FAILED:
                backup.status = HostingApplicationBackup.Status.FAILED
                backup.error_code = job.error_code
                backup.error_detail = job.error_detail
                backup.save(update_fields=["status", "error_code", "error_detail", "updated_at"])

    job_domain = (job.payload or {}).get("domain")
    job_zone = (job.payload or {}).get("zone")
    if job_domain or job_zone:
        hosting_domain = HostingDomain.objects.filter(domain=job_domain or job_zone).first()
        if hosting_domain:
            if job.status == AgentJob.Status.SUCCESS:
                if job.job_type in [AgentJob.Type.PROVISION_HOSTING, AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING]:
                    # The vhost exists; DNS/SSL have their own status columns.
                    hosting_domain.save(update_fields=["updated_at"])
                elif job.job_type == AgentJob.Type.CREATE_DNS_ZONE:
                    hosting_domain.dns_status = HostingDomain.Status.ACTIVE
                    hosting_domain.save(update_fields=["dns_status", "updated_at"])
                elif job.job_type in [AgentJob.Type.CREATE_MAIL_DOMAIN, AgentJob.Type.ENABLE_DKIM]:
                    if apply_dkim_result(hosting_domain, job.result or {}):
                        sync_domain_dns(hosting_domain)
                elif job.job_type == AgentJob.Type.ISSUE_SSL:
                    apply_ssl_success(hosting_domain, job.result or {})
                elif job.job_type == AgentJob.Type.APPLY_WEB_PROTECTION:
                    hosting_domain.web_protection_status = HostingDomain.Status.ACTIVE
                    hosting_domain.web_protection_error = ""
                    hosting_domain.save(update_fields=["web_protection_status", "web_protection_error", "updated_at"])
                elif job.job_type == AgentJob.Type.APPLY_PROTECTED_DIRECTORIES:
                    hosting_domain.protected_directories.update(status=HostingProtectedDirectory.Status.ACTIVE)
                    hosting_domain.protected_directories.filter(enabled=False).update(status=HostingProtectedDirectory.Status.DISABLED)
                elif job.job_type == AgentJob.Type.APPLY_WAF:
                    config = getattr(hosting_domain, "waf_configuration", None)
                    if config:
                        config.status = HostingWafConfiguration.Status.ACTIVE
                        config.error = ""
                        config.save(update_fields=["status", "error", "updated_at"])
                elif job.job_type == AgentJob.Type.APPLY_IP_BLOCKS:
                    today = timezone.localdate()
                    hosting_domain.ip_blocks.filter(enabled=True, expires_on__lt=today).update(status=HostingIPBlock.Status.EXPIRED)
                    hosting_domain.ip_blocks.filter(enabled=False).update(status=HostingIPBlock.Status.DISABLED)
                    hosting_domain.ip_blocks.filter(enabled=True, expires_on__isnull=True).update(status=HostingIPBlock.Status.ACTIVE)
                    hosting_domain.ip_blocks.filter(enabled=True, expires_on__gte=today).update(status=HostingIPBlock.Status.ACTIVE)
            elif job.status == AgentJob.Status.FAILED and job.job_type in [
                AgentJob.Type.PROVISION_HOSTING,
                AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING,
                AgentJob.Type.CREATE_DNS_ZONE,
                AgentJob.Type.ISSUE_SSL,
                AgentJob.Type.APPLY_WEB_PROTECTION,
                AgentJob.Type.APPLY_PROTECTED_DIRECTORIES,
                AgentJob.Type.APPLY_WAF,
                AgentJob.Type.APPLY_IP_BLOCKS,
            ]:
                if job.job_type == AgentJob.Type.CREATE_DNS_ZONE:
                    hosting_domain.dns_status = HostingDomain.Status.FAILED
                    hosting_domain.save(update_fields=["dns_status", "updated_at"])
                elif job.job_type == AgentJob.Type.ISSUE_SSL:
                    apply_ssl_failure(hosting_domain, job)
                elif job.job_type == AgentJob.Type.APPLY_WEB_PROTECTION:
                    hosting_domain.web_protection_status = HostingDomain.Status.FAILED
                    hosting_domain.web_protection_error = job.error_detail or job.error_code or "No se pudo aplicar la proteccion web."
                    hosting_domain.save(update_fields=["web_protection_status", "web_protection_error", "updated_at"])
                elif job.job_type == AgentJob.Type.APPLY_PROTECTED_DIRECTORIES:
                    hosting_domain.protected_directories.update(status=HostingProtectedDirectory.Status.FAILED)
                elif job.job_type == AgentJob.Type.APPLY_WAF:
                    config = getattr(hosting_domain, "waf_configuration", None)
                    if config:
                        config.status = HostingWafConfiguration.Status.FAILED
                        config.error = job.error_detail or job.error_code or "No se pudo aplicar el WAF."
                        config.save(update_fields=["status", "error", "updated_at"])
                elif job.job_type == AgentJob.Type.APPLY_IP_BLOCKS:
                    hosting_domain.ip_blocks.exclude(status=HostingIPBlock.Status.EXPIRED).update(status=HostingIPBlock.Status.FAILED)

    database_name = (job.payload or {}).get("database")
    if database_name and database_name != "_":
        database = HostingDatabase.objects.filter(name=database_name).first()
        if database:
            if job.status == AgentJob.Status.SUCCESS:
                if job.job_type in [
                    AgentJob.Type.CREATE_DATABASE,
                    AgentJob.Type.CHANGE_DATABASE_PASSWORD,
                    AgentJob.Type.CLONE_DATABASE,
                    AgentJob.Type.CHECK_REPAIR_DATABASE,
                    AgentJob.Type.IMPORT_DATABASE,
                ]:
                    database.status = HostingDatabase.Status.ACTIVE
                    database.save(update_fields=["status", "updated_at"])
                elif job.job_type == AgentJob.Type.DELETE_DATABASE:
                    database.delete()
                elif job.job_type == AgentJob.Type.COLLECT_DATABASE_SIZE:
                    database.size_mb = max(0, int((job.result or {}).get("size_mb") or 0))
                    database.size_status = "ok"
                    database.last_size_at = timezone.now()
                    database.save(update_fields=["size_mb", "size_status", "last_size_at", "updated_at"])
            elif job.status == AgentJob.Status.FAILED and job.job_type in [
                AgentJob.Type.CREATE_DATABASE,
                AgentJob.Type.CHANGE_DATABASE_PASSWORD,
                AgentJob.Type.DELETE_DATABASE,
                AgentJob.Type.COLLECT_DATABASE_SIZE,
                AgentJob.Type.CLONE_DATABASE,
                AgentJob.Type.CHECK_REPAIR_DATABASE,
                AgentJob.Type.IMPORT_DATABASE,
            ]:
                if job.job_type == AgentJob.Type.COLLECT_DATABASE_SIZE:
                    database.size_status = "failed"
                    database.save(update_fields=["size_status", "updated_at"])
                else:
                    database.status = HostingDatabase.Status.FAILED
                    database.save(update_fields=["status", "updated_at"])

    db_username = (job.payload or {}).get("user")
    if db_username and job.job_type in [
        AgentJob.Type.CREATE_DATABASE,
        AgentJob.Type.CREATE_DATABASE_USER,
        AgentJob.Type.CHANGE_DATABASE_PASSWORD,
        AgentJob.Type.DELETE_DATABASE_USER,
    ]:
        db_user = HostingDatabaseUser.objects.filter(username=db_username).first()
        if db_user:
            if job.status == AgentJob.Status.SUCCESS and job.job_type == AgentJob.Type.DELETE_DATABASE_USER:
                db_user.delete()
                return
            db_user.status = HostingDatabaseUser.Status.ACTIVE if job.status == AgentJob.Status.SUCCESS else HostingDatabaseUser.Status.FAILED
            db_user.save(update_fields=["status", "updated_at"])

    if hasattr(job, "provisioning_step"):
        run = job.provisioning_step.run
        run.sync_from_jobs()

    ftp_username = (job.payload or {}).get("username")
    if ftp_username and job.job_type in [
        AgentJob.Type.CREATE_FTP_USER,
        AgentJob.Type.DELETE_FTP_USER,
        AgentJob.Type.SUSPEND_FTP_USER,
        AgentJob.Type.UNSUSPEND_FTP_USER,
        AgentJob.Type.CREATE_SFTP_USER,
    ]:
        ftp_user = HostingFtpUser.objects.filter(username=ftp_username).first()
        if ftp_user:
            if job.status == AgentJob.Status.SUCCESS and job.job_type == AgentJob.Type.DELETE_FTP_USER:
                ftp_user.delete()
                return
            if job.status == AgentJob.Status.SUCCESS and job.job_type == AgentJob.Type.SUSPEND_FTP_USER:
                ftp_user.status = HostingFtpUser.Status.SUSPENDED
            elif job.status == AgentJob.Status.SUCCESS:
                ftp_user.status = HostingFtpUser.Status.ACTIVE
            else:
                ftp_user.status = HostingFtpUser.Status.FAILED
            ftp_user.save(update_fields=["status", "updated_at"])

    email = (job.payload or {}).get("email") or (job.payload or {}).get("from")
    if not email:
        return

    mailbox = HostingMailbox.objects.filter(email=email).first()
    if not mailbox:
        return

    if job.status == AgentJob.Status.SUCCESS:
        if job.job_type in [AgentJob.Type.CREATE_MAILBOX, AgentJob.Type.UNSUSPEND_MAILBOX, AgentJob.Type.CHANGE_MAILBOX_PASSWORD, AgentJob.Type.SET_MAILBOX_QUOTA]:
            mailbox.status = HostingMailbox.Status.ACTIVE
            mailbox.save(update_fields=["status", "updated_at"])
        elif job.job_type == AgentJob.Type.SUSPEND_MAILBOX:
            mailbox.status = HostingMailbox.Status.SUSPENDED
            mailbox.save(update_fields=["status", "updated_at"])
        elif job.job_type == AgentJob.Type.DELETE_MAILBOX:
            mailbox.delete()
        elif job.job_type == AgentJob.Type.COLLECT_MAILBOX_USAGE:
            used_mb = int((job.result or {}).get("used_mb") or 0)
            mailbox.used_mb = max(0, used_mb)
            mailbox.usage_status = "ok"
            mailbox.last_usage_at = timezone.now()
            mailbox.save(update_fields=["used_mb", "usage_status", "last_usage_at", "updated_at"])
        elif job.job_type == AgentJob.Type.TEST_MAIL_DELIVERY:
            mailbox.last_test_status = "success"
            mailbox.last_test_result = job.result or {}
            mailbox.last_test_at = timezone.now()
            mailbox.save(update_fields=["last_test_status", "last_test_result", "last_test_at", "updated_at"])
    elif job.status == AgentJob.Status.FAILED and job.job_type in [
        AgentJob.Type.CREATE_MAILBOX,
        AgentJob.Type.CHANGE_MAILBOX_PASSWORD,
        AgentJob.Type.SUSPEND_MAILBOX,
        AgentJob.Type.UNSUSPEND_MAILBOX,
        AgentJob.Type.DELETE_MAILBOX,
        AgentJob.Type.SET_MAILBOX_QUOTA,
        AgentJob.Type.COLLECT_MAILBOX_USAGE,
        AgentJob.Type.TEST_MAIL_DELIVERY,
    ]:
        if job.job_type == AgentJob.Type.COLLECT_MAILBOX_USAGE:
            mailbox.usage_status = "failed"
            mailbox.save(update_fields=["usage_status", "updated_at"])
        elif job.job_type == AgentJob.Type.TEST_MAIL_DELIVERY:
            mailbox.last_test_status = "failed"
            mailbox.last_test_result = {
                "error_code": job.error_code,
                "error_detail": job.error_detail,
                "result": job.result or {},
            }
            mailbox.last_test_at = timezone.now()
            mailbox.save(update_fields=["last_test_status", "last_test_result", "last_test_at", "updated_at"])
        else:
            mailbox.status = HostingMailbox.Status.FAILED
            mailbox.save(update_fields=["status", "updated_at"])


def provision_hosting_account(account, options):
    ensure_account_panel_user(account, options["account_password"])
    run = ProvisioningRun.objects.create(account=account, status=ProvisioningRun.Status.RUNNING)
    domain = account.primary_domain
    public_ip = options.get("public_ip") or node_public_ip(account.node)
    ssl_email = options.get("ssl_email") or account.customer_email or f"admin@{domain}"
    order = 1
    hosting_domain = HostingDomain.objects.create(account=account, domain=domain, is_primary=True)
    hosting_domain.domain_type = HostingDomain.DomainType.PRIMARY
    hosting_domain.document_root = "public_html"
    hosting_domain.save(update_fields=["domain_type", "document_root"])
    sync_domain_dns_from_template(hosting_domain, public_ip)
    for record in options.get("dns_records", []):
        update_or_create_dns_record(
            hosting_domain,
            record.get("name", "@"),
            record.get("type") or record.get("record_type"),
            {
                "content": record.get("content") or record.get("value", ""),
                "ttl": record.get("ttl", 300),
                "priority": record.get("priority"),
            },
        )

    queue_agent_job(
        run,
        order,
        "provision_hosting",
        AgentJob.Type.PROVISION_OPENLITESPEED_HOSTING
        if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED
        else AgentJob.Type.PROVISION_HOSTING,
        {
            "username": account.username,
            "password": options["account_password"],
            "domain": domain,
            "php_version": account.php_version,
            "write_default_index": True,
            "limits": {
                "disk_mb": account.disk_mb,
                "bandwidth_mb": account.bandwidth_mb,
                "memory_mb": account.memory_mb,
                "cpu_pct": account.cpu_pct,
                "global": effective_global_limits_for_account(account),
            },
        },
    )
    order += 1

    queue_agent_job(
        run,
        order,
        "enable_sftp",
        AgentJob.Type.CREATE_SFTP_USER,
        {
            "username": account.username,
            "password": options["account_password"],
        },
    )
    order += 1

    queue_agent_job(
        run,
        order,
        "create_dns_zone",
        AgentJob.Type.CREATE_DNS_ZONE,
        {
            "zone": domain,
            "ip": public_ip,
            "nameserver": f"ns1.{domain}",
            "records": dns_records_payload(hosting_domain),
        },
    )
    order += 1

    queue_agent_job(
        run,
        order,
        "create_mail_domain",
        AgentJob.Type.CREATE_MAIL_DOMAIN,
        {"domain": domain},
    )
    order += 1

    queue_agent_job(
        run,
        order,
        "configure_webmail",
        "configure_webmail_domain",
        {
            "domain": domain,
            "username": account.username,
            "ssl_active": False,
        },
    )
    order += 1

    queue_agent_job(
        run,
        order,
        "issue_ssl",
        AgentJob.Type.ISSUE_SSL,
        {
            "domain": domain,
            "username": account.username,
            "email": ssl_email,
            "aliases": [f"www.{domain}", f"webmail.{domain}", f"autoconfig.{domain}", f"autodiscover.{domain}"],
            "staging": bool(options.get("ssl_staging", False)),
            "force_renewal": bool(options.get("ssl_force_renewal", False)),
            "backend_port": getattr(settings, "LOCAL_OLS_BACKEND_PORT", 8088),
        },
    )
    order += 1

    database = options.get("database")
    if database:
        HostingDatabase.objects.create(
            account=account,
            engine=database.get("engine", HostingDatabase.Engine.MARIADB),
            name=database["name"],
            username=database["username"],
        )
        queue_agent_job(
            run,
            order,
            "create_database",
            AgentJob.Type.CREATE_DATABASE,
            {
                "engine": database.get("engine", HostingDatabase.Engine.MARIADB),
                "database": database["name"],
                "user": database["username"],
                "password": database["password"],
            },
        )
        order += 1

    mailbox = options.get("mailbox")
    if mailbox:
        hosting_mailbox = HostingMailbox.objects.create(
            account=account,
            email=mailbox["email"],
            quota_mb=mailbox.get("quota_mb", 1024),
        )
        store_mailbox_credential(hosting_mailbox, mailbox["password"])
        queue_agent_job(
            run,
            order,
            "create_mailbox",
            AgentJob.Type.CREATE_MAILBOX,
            {
                "email": mailbox["email"],
                "password": mailbox["password"],
                "quota_mb": mailbox.get("quota_mb", 1024),
            },
        )

    account.status = HostingAccount.Status.PROVISIONING
    account.save(update_fields=["status", "updated_at"])
    return run

