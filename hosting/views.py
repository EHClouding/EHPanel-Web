from django.conf import settings
from django.db.models import Prefetch, Q
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from datetime import timedelta
import hashlib
import hmac
import plistlib
import json
import os
import re
import secrets
from pathlib import Path
from urllib import request as urllib_request
from urllib import parse as urllib_parse
from urllib.error import URLError, HTTPError
from rest_framework import mixins, pagination, permissions, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
import uuid
from xml.sax.saxutils import escape

from agents.models import AgentJob
from agents.serializers import AgentJobSerializer
from .billing_client import BillingClientError, billing_client
from .models import ApiKeyCredential, AuditLog, BackupPolicy, BackupRestoreRun, BackupStorageDestination, DNSTemplateRecord, GlobalAnnouncement, GlobalConfiguration, GlobalNameserver, HostingAccount, HostingAccountExport, HostingAdvancedItem, HostingApplication, HostingApplicationBackup, HostingDatabase, HostingDatabaseUser, HostingDNSRecord, HostingDomain, HostingFtpUser, HostingIPBlock, HostingMailbox, HostingMonitorAlertRule, HostingMonitorCheck, HostingMonitorIncident, HostingPerformanceAudit, HostingPlan, HostingProtectedDirectory, HostingResellerProfile, HostingSecurityScan, HostingWafConfiguration, MigrationAccount, MigrationLog, MigrationRun, MigrationSource, ProvisioningRun, ProvisioningTemplate, ResellerTeamMember, SupportTicket, SupportTicketAttachment, SupportTicketMessage
from .permissions import IsAdminOrScopedUser, is_admin_user, is_reseller_team_user, reseller_profile_for_user, scoped_accounts
from .serializers import (
    AuditLogSerializer,
    BackupPolicySerializer,
    BackupRestoreRunSerializer,
    BackupStorageDestinationSerializer,
    AccountFileChmodSerializer,
    AccountFileCompressSerializer,
    AccountFileDeleteSerializer,
    AccountFileExtractSerializer,
    AccountFileImportUrlSerializer,
    AccountFileMkdirSerializer,
    AccountFilePathSerializer,
    AccountFileRenameSerializer,
    AccountFileTransferSerializer,
    AccountFileUploadSerializer,
    AccountFileWriteSerializer,
    ActivateDomainWebmailSerializer,
    AppInstallSuggestionSerializer,
    ApiKeyCredentialSerializer,
    ChangeAccountPasswordSerializer,
    ChangeOwnPasswordSerializer,
    ChangeMailboxPasswordSerializer,
    CreateHostingAccountExportSerializer,
    CreateHostingResellerProfileSerializer,
    CreateResellerTeamMemberSerializer,
    CreateImportRunSerializer,
    CreateMigrationRunSerializer,
    CreateFtpUserSerializer,
    ChangeDatabasePasswordSerializer,
    CreateDatabaseUserSerializer,
    CreateDomainSerializer,
    CreateDatabaseSerializer,
    CreateMailboxSerializer,
    DatabaseCloneSerializer,
    DatabaseImportSerializer,
    DatabaseSsoConsumeSerializer,
    DNSTemplateRecordSerializer,
    DeployDjangoAppSerializer,
    DeployLaravelAppSerializer,
    DeployNodeAppSerializer,
    DeployPythonAppSerializer,
    GlobalConfigurationSerializer,
    GlobalNameserverSerializer,
    GlobalAnnouncementSerializer,
    HostingAccountSerializer,
    HostingAccountExportSerializer,
    HostingAdvancedItemSerializer,
    HostingDatabaseSerializer,
    HostingDatabaseUserSerializer,
    HostingDNSRecordSerializer,
    HostingDomainSerializer,
    HostingFtpUserSerializer,
    HostingMailboxSerializer,
    HostingMonitorAlertRuleSerializer,
    HostingMonitorCheckSerializer,
    HostingMonitorIncidentSerializer,
    HostingPerformanceAuditSerializer,
    SupportTicketAttachmentSerializer,
    SupportTicketSerializer,
    MailboxSsoConsumeSerializer,
    HostingPlanSerializer,
    HostingProtectedDirectorySerializer,
    HostingResellerProfileSerializer,
    MigrationAccountSerializer,
    MigrationLogSerializer,
    MigrationRunSerializer,
    MigrationSourceSerializer,
    HostingIPBlockSerializer,
    HostingSecurityScanSerializer,
    HostingWafConfigurationSerializer,
    HostingApplicationBackupSerializer,
    HostingApplicationSerializer,
    InstallWordPressSerializer,
    InstallCatalogAppSerializer,
    IssueDomainSSLSerializer,
    ProvisionHostingAccountSerializer,
    ProvisioningRunSerializer,
    ProvisioningTemplateSerializer,
    SetMailboxQuotaSerializer,
    StartMigrationRunSerializer,
    SyncDomainDNSSerializer,
    WebProtectionSerializer,
    TestMailboxDeliverySerializer,
    ResellerBrandSerializer,
    ResellerSecuritySerializer,
    ResellerTeamMemberSerializer,
    UpdateResellerTeamMemberSerializer,
    UpdateMailboxSerializer,
    UpdateDatabaseUserSerializer,
    UpdateFtpUserSerializer,
)
from .services import (
    change_account_password,
    collect_mailbox_usage,
    collect_database_size,
    clone_database,
    configure_domain_webmail,
    consume_database_sso,
    consume_webmail_sso,
    create_domain,
    change_database_password,
    check_repair_database,
    change_mailbox_password,
    collect_software_info,
    create_import_run,
    create_account_export,
    create_migration_run,
    ensure_default_nameservers_for_all_nodes,
    create_database,
    create_database_with_user,
    create_database_user,
    create_database_sso,
    create_webmail_sso,
    create_ftp_user,
    create_mailbox,
    collect_app_logs,
    app_catalog,
    app_install_suggestions,
    build_account_monitoring,
    collect_account_usage,
    collect_account_monitoring,
    detect_account_apps,
    detect_all_apps_for_user,
    deploy_django_app,
    deploy_laravel_app,
    deploy_node_app,
    deploy_python_app,
    delete_database,
    delete_database_user,
    delete_ftp_user,
    export_database,
    import_database,
    issue_domain_ssl,
    sync_global_nameserver_template,
    collect_waf_events,
    queue_web_protection_apply,
    queue_protected_directories_apply,
    queue_waf_apply,
    queue_ip_blocks_apply,
    web_protection_ai_mock,
    install_wordpress,
    install_catalog_app,
    apply_account_software,
    apply_software_settings,
    queue_app_action,
    queue_app_backup,
    queue_app_delete,
    queue_app_update_check,
    run_laravel_toolkit,
    run_node_toolkit,
    run_python_toolkit,
    run_wordpress_autologin,
    run_wordpress_toolkit,
    queue_security_remediation,
    queue_security_scan,
    sync_security_scan_from_job,
    queue_wordpress_delete,
    queue_wordpress_update,
    delete_mailbox,
    retry_failed_provisioning_run,
    retry_provisioning_step,
    run_web_performance_audit,
    set_mailbox_quota,
    sync_mailboxes,
    start_migration_run,
    run_account_file_job,
    node_public_ip,
    sftp_connection_info,
    test_mail_delivery,
    update_mailbox,
    update_database_user,
    dns_template_records_preview,
    sync_domain_dns,
    suspend_account,
    suspend_ftp_user,
    suspend_mailbox,
    unsuspend_account,
    unsuspend_ftp_user,
    unsuspend_mailbox,
)


class AuditPagination(pagination.PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    remote_addr = request.META.get("REMOTE_ADDR") or None
    if forwarded_for and remote_addr in getattr(settings, "TRUSTED_PROXY_IPS", []):
        return forwarded_for.split(",")[0].strip() or None
    return remote_addr


def audit_action(request, action, account=None, target=None, metadata=None):
    target_obj = target or account
    AuditLog.objects.create(
        user=request.user if request.user and request.user.is_authenticated else None,
        action=action,
        account=account,
        target_type=target_obj.__class__.__name__ if target_obj else "",
        target_id=str(getattr(target_obj, "pk", "")) if target_obj else "",
        target_label=str(target_obj) if target_obj else "",
        ip=client_ip(request),
        metadata={
            "method": request.method,
            "path": request.path,
            "status_code": 200,
            **(metadata or {}),
        },
    )


ALLOWED_TICKET_ATTACHMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".log", ".csv", ".zip"}
ALLOWED_TICKET_ATTACHMENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/x-zip-compressed",
}


def validate_ticket_attachments(files):
    max_files = getattr(settings, "SUPPORT_ATTACHMENT_MAX_FILES", 5)
    max_size = getattr(settings, "SUPPORT_ATTACHMENT_MAX_SIZE", 10 * 1024 * 1024)
    if len(files) > max_files:
        return f"Puedes adjuntar hasta {max_files} archivos por mensaje."
    for item in files:
        name = str(getattr(item, "name", "") or "")
        suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
        content_type = str(getattr(item, "content_type", "") or "").lower()
        if suffix not in ALLOWED_TICKET_ATTACHMENT_EXTENSIONS or content_type not in ALLOWED_TICKET_ATTACHMENT_TYPES:
            return "Tipo de archivo no permitido. Usa imagenes, PDF, TXT, CSV, LOG o ZIP."
        if item.size > max_size:
            return f"Cada archivo debe pesar maximo {round(max_size / 1024 / 1024)} MB."
    return ""


def save_ticket_attachments(message, files, user):
    for item in files:
        SupportTicketAttachment.objects.create(
            message=message,
            file=item,
            original_name=str(item.name)[:180],
            content_type=str(item.content_type or "")[:120],
            size=item.size,
            uploaded_by=user if user and user.is_authenticated else None,
        )


def save_account_upload_file(uploaded_file):
    upload_root = Path(settings.LOCAL_FILE_MANAGER_TEMP_ROOT) / "uploads" / uuid.uuid4().hex
    upload_root.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", uploaded_file.name or "upload.bin")[:180] or "upload.bin"
    target = upload_root / safe_name
    with target.open("wb") as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)
    return target


def account_download_export_path(filename):
    download_root = Path(settings.LOCAL_FILE_MANAGER_TEMP_ROOT) / "downloads" / uuid.uuid4().hex
    download_root.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename or "download.bin")[:180] or "download.bin"
    return download_root / safe_name


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user", "account").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrScopedUser]
    pagination_class = AuditPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        search = self.request.query_params.get("search")
        action_value = self.request.query_params.get("action")
        method = self.request.query_params.get("method")
        user_id = self.request.query_params.get("user")
        account_id = self.request.query_params.get("account")

        if search:
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(user__username__icontains=search)
                | Q(account__primary_domain__icontains=search)
                | Q(target_label__icontains=search)
                | Q(metadata__path__icontains=search)
            )
        if action_value:
            queryset = queryset.filter(action=action_value)
        if method:
            queryset = queryset.filter(metadata__method=method)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset


class HostingPlanViewSet(viewsets.ModelViewSet):
    queryset = HostingPlan.objects.all()
    serializer_class = HostingPlanSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not (self.request.user and (self.request.user.is_staff or self.request.user.is_superuser)):
            queryset = queryset.filter(is_active=True)
        return queryset


class HostingResellerProfileViewSet(viewsets.ModelViewSet):
    queryset = HostingResellerProfile.objects.select_related("user", "plan", "primary_node").prefetch_related(
        Prefetch("user__reseller_accounts", queryset=HostingAccount.objects.select_related("plan", "node"), to_attr="accounts_for_summary")
    )
    serializer_class = HostingResellerProfileSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateHostingResellerProfileSerializer
        return HostingResellerProfileSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        if search:
            queryset = queryset.filter(
                Q(company_name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(plan__name__icontains=search)
                | Q(primary_node__hostname__icontains=search)
            )
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        audit_action(
            request,
            AuditLog.Action.USER_CREATED,
            target=profile.user,
            metadata={"role": "reseller", "plan": profile.plan_id, "primary_node": str(profile.primary_node_id or "")},
        )
        return Response(HostingResellerProfileSerializer(profile, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        profile = self.get_object()
        profile.status = HostingResellerProfile.Status.SUSPENDED
        profile.user.is_active = False
        profile.user.save(update_fields=["is_active"])
        profile.save(update_fields=["status", "updated_at"])
        audit_action(request, AuditLog.Action.USER_UPDATED, target=profile.user, metadata={"action": "suspend_reseller"})
        return Response(HostingResellerProfileSerializer(profile, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="unsuspend")
    def unsuspend(self, request, pk=None):
        profile = self.get_object()
        profile.status = HostingResellerProfile.Status.ACTIVE
        profile.user.is_active = True
        profile.user.save(update_fields=["is_active"])
        profile.save(update_fields=["status", "updated_at"])
        audit_action(request, AuditLog.Action.USER_UPDATED, target=profile.user, metadata={"action": "unsuspend_reseller"})
        return Response(HostingResellerProfileSerializer(profile, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)


class ResellerSelfViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        profile = reseller_profile_for_user(request.user)
        if profile is None:
            return Response({"detail": "El usuario no tiene perfil revendedor."}, status=status.HTTP_404_NOT_FOUND)
        return Response(HostingResellerProfileSerializer(profile, context={"request": request}).data)

    def partial_update(self, request, pk=None):
        profile = reseller_profile_for_user(request.user)
        if profile is None:
            return Response({"detail": "El usuario no tiene perfil revendedor."}, status=status.HTTP_404_NOT_FOUND)
        if is_reseller_team_user(request.user):
            return Response({"detail": "Solo el revendedor principal puede modificar la marca."}, status=status.HTTP_403_FORBIDDEN)
        serializer = ResellerBrandSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(HostingResellerProfileSerializer(profile, context={"request": request}).data)


class ResellerTeamMemberViewSet(viewsets.ModelViewSet):
    serializer_class = ResellerTeamMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_reseller(self):
        profile = reseller_profile_for_user(self.request.user)
        if profile is None:
            return None
        return profile

    def get_queryset(self):
        profile = self.get_reseller()
        if profile is None:
            return ResellerTeamMember.objects.none()
        return ResellerTeamMember.objects.select_related("user", "reseller").filter(reseller=profile)

    def get_serializer_class(self):
        if self.action == "create":
            return CreateResellerTeamMemberSerializer
        if self.action in {"update", "partial_update"}:
            return UpdateResellerTeamMemberSerializer
        return ResellerTeamMemberSerializer

    def create(self, request, *args, **kwargs):
        profile = self.get_reseller()
        if profile is None:
            return Response({"detail": "El usuario no tiene perfil revendedor."}, status=status.HTTP_404_NOT_FOUND)
        if is_reseller_team_user(request.user):
            return Response({"detail": "Solo el revendedor principal puede invitar usuarios."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data, context={"reseller": profile})
        serializer.is_valid(raise_exception=True)
        member = serializer.save()
        audit_action(request, AuditLog.Action.USER_CREATED, target=member.user, metadata={"role": "reseller_team", "team_role": member.role})
        return Response(ResellerTeamMemberSerializer(member, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        if is_reseller_team_user(request.user):
            return Response({"detail": "Solo el revendedor principal puede modificar usuarios."}, status=status.HTTP_403_FORBIDDEN)
        member = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field in ["role", "status"]:
            if field in serializer.validated_data:
                setattr(member, field, serializer.validated_data[field])
        if "is_active" in serializer.validated_data:
            member.user.is_active = serializer.validated_data["is_active"]
        if member.status == ResellerTeamMember.Status.SUSPENDED:
            member.user.is_active = False
        member.user.save(update_fields=["is_active"])
        member.save(update_fields=["role", "status", "updated_at"])
        audit_action(request, AuditLog.Action.USER_UPDATED, target=member.user, metadata={"role": member.role, "status": member.status})
        return Response(ResellerTeamMemberSerializer(member, context=self.get_serializer_context()).data)


class ResellerSecurityViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        profile = reseller_profile_for_user(request.user)
        if profile is None:
            return Response({"detail": "El usuario no tiene perfil revendedor."}, status=status.HTTP_404_NOT_FOUND)
        sessions = request.user.access_sessions.order_by("-created_at")[:20]
        return Response({
            "security": ResellerSecuritySerializer(profile).data,
            "sessions": [
                {
                    "id": session.id,
                    "ip_address": session.ip_address,
                    "device": session.device,
                    "role": session.role,
                    "status": session.status,
                    "last_seen_at": session.last_seen_at,
                    "created_at": session.created_at,
                }
                for session in sessions
            ],
        })

    def create(self, request):
        profile = reseller_profile_for_user(request.user)
        if profile is None:
            return Response({"detail": "El usuario no tiene perfil revendedor."}, status=status.HTTP_404_NOT_FOUND)
        if "current_password" in request.data or "new_password" in request.data:
            serializer = ChangeOwnPasswordSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            if not request.user.check_password(serializer.validated_data["current_password"]):
                return Response({"current_password": "La contrasena actual no es correcta."}, status=status.HTTP_400_BAD_REQUEST)
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save(update_fields=["password"])
            audit_action(request, AuditLog.Action.USER_UPDATED, target=request.user, metadata={"action": "own_password_changed"})
            return Response({"ok": True})
        serializer = ResellerSecuritySerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="close-session")
    def close_session(self, request):
        session_id = request.data.get("id")
        session = request.user.access_sessions.filter(id=session_id).first()
        if not session:
            return Response({"detail": "Sesion no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        session.status = "closed"
        session.closed_at = timezone.now()
        session.save(update_fields=["status", "closed_at", "updated_at"])
        return Response({"ok": True})


def reseller_team_write_forbidden(request):
    if is_reseller_team_user(request.user):
        return Response({"detail": "El equipo del revendedor solo tiene permisos de vista y soporte."}, status=status.HTTP_403_FORBIDDEN)
    return None


class MigrationSourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MigrationSource.objects.select_related("created_by").all()
    serializer_class = MigrationSourceSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        provider = self.request.query_params.get("provider")
        search = self.request.query_params.get("search")
        if provider:
            queryset = queryset.filter(provider=provider)
        if search:
            queryset = queryset.filter(Q(host__icontains=search) | Q(username__icontains=search))
        return queryset


class MigrationRunViewSet(viewsets.ModelViewSet):
    queryset = MigrationRun.objects.select_related("source", "destination_node").prefetch_related("accounts", "steps", "logs")
    serializer_class = MigrationRunSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_serializer_class(self):
        if self.action == "import_backup":
            return CreateImportRunSerializer
        if self.action == "create":
            return CreateMigrationRunSerializer
        return MigrationRunSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin_user(self.request.user):
            allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
            queryset = queryset.filter(Q(created_by=self.request.user) | Q(accounts__destination_account__in=allowed_accounts)).distinct()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        provider = self.request.query_params.get("provider")
        import_flow = self.request.query_params.get("import_flow")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if provider:
            queryset = queryset.filter(source__provider=provider)
        if import_flow in {"1", "true", "yes"}:
            queryset = queryset.filter(options__import_flow=True)
        elif import_flow in {"0", "false", "no"}:
            queryset = queryset.exclude(options__import_flow=True)
        if search:
            queryset = queryset.filter(
                Q(source__host__icontains=search)
                | Q(source__username__icontains=search)
                | Q(destination_node__hostname__icontains=search)
                | Q(accounts__primary_domain__icontains=search)
            )
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run = create_migration_run(serializer.validated_data, user=request.user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            target=run,
            metadata={"action": "migration_created", "provider": run.source.provider, "destination_node": str(run.destination_node_id)},
        )
        return Response(MigrationRunSerializer(run, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="import-backup", parser_classes=[MultiPartParser, FormParser])
    def import_backup(self, request):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run = create_import_run(serializer.validated_data, user=request.user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            target=run,
            metadata={"action": "import_created", "provider": run.source.provider, "destination_node": str(run.destination_node_id)},
        )
        return Response(MigrationRunSerializer(run, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        run = self.get_object()
        serializer = StartMigrationRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        jobs = start_migration_run(
            run,
            selected_accounts=serializer.validated_data.get("selected_accounts") or None,
            concurrency=serializer.validated_data.get("concurrency"),
        )
        run.refresh_from_db()
        return Response({"queued": len(jobs), "run": MigrationRunSerializer(run, context=self.get_serializer_context()).data}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="rediscover")
    def rediscover(self, request, pk=None):
        from .services import queue_migration_discovery

        run = self.get_object()
        job = queue_migration_discovery(run)
        run.refresh_from_db()
        return Response({"job": str(job.id), "run": MigrationRunSerializer(run, context=self.get_serializer_context()).data}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        run = self.get_object()
        run.status = MigrationRun.Status.PAUSED
        run.current_step = "Pausada por administrador"
        run.save(update_fields=["status", "current_step", "updated_at"])
        MigrationLog.objects.create(run=run, level="warning", message="Migracion pausada por administrador.")
        return Response(MigrationRunSerializer(run, context=self.get_serializer_context()).data)


class MigrationAccountViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MigrationAccount.objects.select_related("run", "destination_account", "last_job").all()
    serializer_class = MigrationAccountSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        run_id = self.request.query_params.get("run")
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        if run_id:
            queryset = queryset.filter(run_id=run_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(Q(primary_domain__icontains=search) | Q(source_username__icontains=search) | Q(customer_email__icontains=search))
        return queryset


class MigrationLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MigrationLog.objects.select_related("run", "account").all()
    serializer_class = MigrationLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        run_id = self.request.query_params.get("run")
        account_id = self.request.query_params.get("account")
        if run_id:
            queryset = queryset.filter(run_id=run_id)
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset


class HostingAccountExportViewSet(viewsets.ModelViewSet):
    queryset = HostingAccountExport.objects.select_related("account", "account__node", "last_job").all()
    serializer_class = HostingAccountExportSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_serializer_class(self):
        if self.action == "create":
            return CreateHostingAccountExportSerializer
        return HostingAccountExportSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(
                Q(account__primary_domain__icontains=search)
                | Q(account__username__icontains=search)
                | Q(account__node__hostname__icontains=search)
                | Q(filename__icontains=search)
            )
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not is_admin_user(request.user) and not scoped_accounts(HostingAccount.objects.all(), request.user).filter(pk=serializer.validated_data["account"].pk).exists():
            return Response({"account": "Cuenta hosting no permitida."}, status=status.HTTP_403_FORBIDDEN)
        export = create_account_export(serializer.validated_data, user=request.user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=export.account,
            target=export,
            metadata={"action": "account_export_created", "job": str(export.last_job_id)},
        )
        return Response(HostingAccountExportSerializer(export, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, _request, pk=None):
        export = self.get_object()
        if export.status != HostingAccountExport.Status.COMPLETED:
            return Response({"detail": "La exportacion aun no esta completada."}, status=status.HTTP_409_CONFLICT)
        if not export.archive_path:
            return Response({"detail": "El agente no reporto una ruta de archivo."}, status=status.HTTP_404_NOT_FOUND)
        import os

        archive_path = os.path.realpath(export.archive_path)
        allowed_prefixes = [os.path.realpath(str(settings.MEDIA_ROOT)), os.path.realpath("/var/backups/ehpanel/")]
        try:
            allowed_path = any(os.path.commonpath([archive_path, prefix]) == prefix for prefix in allowed_prefixes)
        except ValueError:
            allowed_path = False
        if not allowed_path:
            return Response({"detail": "Ruta de exportacion no permitida.", "node_path": export.archive_path}, status=status.HTTP_409_CONFLICT)
        if not os.path.exists(archive_path):
            return Response({"detail": "El archivo fue generado en el nodo, pero no esta disponible localmente para descarga desde el panel.", "node_path": archive_path}, status=status.HTTP_409_CONFLICT)
        filename = export.filename or os.path.basename(archive_path)
        return FileResponse(open(archive_path, "rb"), as_attachment=True, filename=filename)


def ensure_default_backup_records():
    local_storage = first_or_create_backup_record(
        BackupStorageDestination,
        {"name": "Local del nodo"},
        {"storage_type": BackupStorageDestination.Type.LOCAL, "path": "/var/backups/ehpanel", "capacity_gb": 0},
    )
    first_or_create_backup_record(
        BackupStorageDestination,
        {"name": "EHPanel Drive"},
        {"storage_type": BackupStorageDestination.Type.EHPANEL_DRIVE, "endpoint": "api-pendiente", "status": BackupStorageDestination.Status.PAUSED},
    )
    defaults = [
        ("Politica global estandar", BackupPolicy.PolicyType.INCREMENTAL, "daily_02", True, True, True, True, True, 30, 14, BackupPolicy.Status.ACTIVE),
        ("Full semanal clientes", BackupPolicy.PolicyType.FULL, "weekly_sun_03", True, True, True, True, True, 90, 12, BackupPolicy.Status.ACTIVE),
        ("Bases criticas", BackupPolicy.PolicyType.INCREMENTAL, "every_6h", False, True, False, False, False, 15, 40, BackupPolicy.Status.ACTIVE),
        ("Correo bajo demanda", BackupPolicy.PolicyType.PARTIAL, "manual", False, False, True, False, False, 60, 8, BackupPolicy.Status.PAUSED),
    ]
    for name, policy_type, frequency, files, databases, mail, config, full_account, days, copies, status_value in defaults:
        first_or_create_backup_record(
            BackupPolicy,
            {"name": name},
            {
                "policy_type": policy_type,
                "frequency": frequency,
                "include_files": files,
                "include_databases": databases,
                "include_mail": mail,
                "include_config": config,
                "full_account": full_account,
                "storage": local_storage,
                "retention_days": days,
                "retention_copies": copies,
                "status": status_value,
            },
        )


def first_or_create_backup_record(model, lookup, defaults):
    existing = model.objects.filter(**lookup).order_by("id").first()
    if existing:
        return existing
    return model.objects.create(**lookup, **defaults)


class BackupStorageDestinationViewSet(viewsets.ModelViewSet):
    queryset = BackupStorageDestination.objects.all()
    serializer_class = BackupStorageDestinationSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def list(self, request, *args, **kwargs):
        ensure_default_backup_records()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        type_value = self.request.query_params.get("type")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(endpoint__icontains=search) | Q(path__icontains=search) | Q(bucket__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        if type_value:
            queryset = queryset.filter(storage_type=type_value)
        return queryset

    @action(detail=True, methods=["post"], url_path="test")
    def test(self, request, pk=None):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        destination = self.get_object()
        destination.status = BackupStorageDestination.Status.TESTING
        destination.last_test_at = timezone.now()
        destination.last_test_result = {"status": "queued", "detail": "Prueba registrada para el destino."}
        destination.save(update_fields=["status", "last_test_at", "last_test_result", "updated_at"])
        return Response(self.get_serializer(destination).data, status=status.HTTP_202_ACCEPTED)


class BackupPolicyViewSet(viewsets.ModelViewSet):
    queryset = BackupPolicy.objects.select_related("storage").all()
    serializer_class = BackupPolicySerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def list(self, request, *args, **kwargs):
        ensure_default_backup_records()
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        type_value = self.request.query_params.get("type")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(frequency__icontains=search) | Q(storage__name__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        if type_value:
            queryset = queryset.filter(policy_type=type_value)
        return queryset.distinct()

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        source = self.get_object()
        duplicate = BackupPolicy.objects.create(
            name=request.data.get("name") or f"{source.name} copia",
            policy_type=source.policy_type,
            frequency=source.frequency,
            include_files=source.include_files,
            include_databases=source.include_databases,
            include_mail=source.include_mail,
            include_config=source.include_config,
            full_account=source.full_account,
            storage=source.storage,
            retention_days=source.retention_days,
            retention_copies=source.retention_copies,
            status=source.status,
            notes=source.notes,
        )
        return Response(self.get_serializer(duplicate).data, status=status.HTTP_201_CREATED)


class BackupRestoreRunViewSet(viewsets.ModelViewSet):
    queryset = BackupRestoreRun.objects.select_related("backup", "destination_node", "last_job", "created_by", "reseller").prefetch_related("accounts").all()
    serializer_class = BackupRestoreRunSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not is_admin_user(self.request.user):
            queryset = queryset.filter(accounts__in=scoped_accounts(HostingAccount.objects.all(), self.request.user)).distinct()
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        type_value = self.request.query_params.get("type")
        if search:
            queryset = queryset.filter(Q(accounts__primary_domain__icontains=search) | Q(accounts__username__icontains=search) | Q(destination_node__hostname__icontains=search) | Q(notes__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        if type_value:
            queryset = queryset.filter(restore_type=type_value)
        return queryset.distinct()

    def perform_create(self, serializer):
        restore = serializer.save(created_by=self.request.user, reseller=getattr(self.request.user, "hosting_reseller_profile", None))
        from .local_provisioning import dispatch_or_execute_local

        node = restore.destination_node or (restore.accounts.first().node if restore.accounts.exists() else None)
        if node:
            job = AgentJob.objects.create(
                node=node,
                job_type=AgentJob.Type.SERVICE_ACTION,
                payload={
                    "service": "backup",
                    "action": "restore_backup",
                    "restore_id": restore.id,
                    "accounts": [str(account.id) for account in restore.accounts.all()],
                    "backup": restore.backup_id,
                    "include_files": restore.include_files,
                    "include_databases": restore.include_databases,
                    "include_mail": restore.include_mail,
                },
            )
            dispatch_or_execute_local(job)
            restore.last_job = job
            restore.status = BackupRestoreRun.Status.QUEUED
            restore.save(update_fields=["last_job", "status", "updated_at"])

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, _request, pk=None):
        restore = self.get_object()
        from .local_provisioning import dispatch_or_execute_local

        node = restore.destination_node or (restore.accounts.first().node if restore.accounts.exists() else None)
        if not node:
            return Response({"detail": "Restauracion sin nodo destino."}, status=status.HTTP_400_BAD_REQUEST)
        job = AgentJob.objects.create(node=node, job_type=AgentJob.Type.SERVICE_ACTION, payload={"service": "backup", "action": "restore_backup", "restore_id": restore.id})
        dispatch_or_execute_local(job)
        restore.last_job = job
        restore.status = BackupRestoreRun.Status.QUEUED
        restore.error_code = ""
        restore.error_detail = ""
        restore.save(update_fields=["last_job", "status", "error_code", "error_detail", "updated_at"])
        return Response(self.get_serializer(restore).data, status=status.HTTP_202_ACCEPTED)


class GlobalConfigurationViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAdminUser]

    def list(self, request):
        config = GlobalConfiguration.current()
        return Response(GlobalConfigurationSerializer(config, context={"request": request}).data)

    def partial_update(self, request, pk=None):
        config = GlobalConfiguration.current()
        serializer = GlobalConfigurationSerializer(config, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="maintenance-notify")
    def maintenance_notify(self, request):
        config = GlobalConfiguration.current()
        policies = config.policies if isinstance(config.policies, dict) else {}
        maintenance = policies.get("maintenance") if isinstance(policies.get("maintenance"), dict) else {}
        telegram = maintenance.get("telegram") if isinstance(maintenance.get("telegram"), dict) else {}
        bot_token = str(telegram.get("bot_token") or "").strip()
        chat_id = str(request.data.get("chat_id") or telegram.get("chat_id") or "").strip()
        task = request.data.get("task") if isinstance(request.data.get("task"), dict) else {}
        if not bot_token or not chat_id:
            return Response({"detail": "Falta configurar bot_token y chat_id de Telegram."}, status=status.HTTP_400_BAD_REQUEST)
        if not task:
            return Response({"detail": "No se recibio la tarea de mantenimiento."}, status=status.HTTP_400_BAD_REQUEST)
        message = maintenance_telegram_message(task)
        payload = urllib_parse.urlencode({"chat_id": chat_id, "text": message, "parse_mode": "HTML"}).encode("utf-8")
        try:
            req = urllib_request.Request(f"https://api.telegram.org/bot{bot_token}/sendMessage", data=payload, method="POST")
            with urllib_request.urlopen(req, timeout=15) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            return Response({"detail": f"No se pudo enviar Telegram: {exc}"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"status": "sent", "telegram": data})

    @action(detail=False, methods=["get"], url_path="billing-integration")
    def billing_integration(self, _request):
        web_token_configured = bool(getattr(settings, "INTERNAL_BILLING_API_TOKEN", "") or getattr(settings, "BILLING_WEBHOOK_TOKEN", ""))
        client = billing_client()
        health = {"status": "not_configured", "detail": "BILLING_API_TOKEN no esta configurado."}
        if client.is_configured():
            try:
                health = client.health()
            except BillingClientError as exc:
                health = {"status": "error", "detail": str(exc)}
        linked = HostingAccount.objects.exclude(billing_service_id="").count()
        total = HostingAccount.objects.count()
        return Response(
            {
                "web_token_configured": web_token_configured,
                "billing_api_configured": client.is_configured(),
                "billing_api_base": client.base_url,
                "linked_accounts": linked,
                "unlinked_accounts": max(total - linked, 0),
                "total_accounts": total,
                "health": health,
            }
        )


def generate_api_credential_token():
    token = f"ehp_live_{secrets.token_urlsafe(32)}"
    return token, token[:18], hashlib.sha256(token.encode("utf-8")).hexdigest()


class ApiKeyCredentialViewSet(viewsets.ModelViewSet):
    serializer_class = ApiKeyCredentialSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = ApiKeyCredential.objects.all()
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(owner__icontains=search)
                | Q(route__icontains=search)
                | Q(key_prefix__icontains=search)
                | Q(notes__icontains=search)
            )
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token, prefix, token_hash = generate_api_credential_token()
        while ApiKeyCredential.objects.filter(key_hash=token_hash).exists():
            token, prefix, token_hash = generate_api_credential_token()
        credential = serializer.save(
            created_by=request.user if request.user.is_authenticated else None,
            key_hash=token_hash,
            key_prefix=prefix,
        )
        data = self.get_serializer(credential).data
        data["api_key"] = token
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"])
    def rotate(self, request, pk=None):
        credential = self.get_object()
        token, prefix, token_hash = generate_api_credential_token()
        while ApiKeyCredential.objects.filter(key_hash=token_hash).exclude(pk=credential.pk).exists():
            token, prefix, token_hash = generate_api_credential_token()
        credential.key_hash = token_hash
        credential.key_prefix = prefix
        credential.status = ApiKeyCredential.Status.ACTIVE
        credential.save(update_fields=["key_hash", "key_prefix", "status", "updated_at"])
        data = self.get_serializer(credential).data
        data["api_key"] = token
        return Response(data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        credential = self.get_object()
        credential.status = ApiKeyCredential.Status.REVOKED
        credential.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(credential).data)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        credential = self.get_object()
        credential.status = ApiKeyCredential.Status.PAUSED
        credential.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(credential).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        credential = self.get_object()
        credential.status = ApiKeyCredential.Status.ACTIVE
        credential.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(credential).data)

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        credential = self.get_object()
        credential.last_used_at = timezone.now()
        credential.save(update_fields=["last_used_at", "updated_at"])
        return Response(self.get_serializer(credential).data)


def maintenance_telegram_message(task):
    hostname = escape(str(task.get("hostname") or task.get("node_hostname") or "Servidor N/D"))
    maintenance_type = escape(str(task.get("type") or "Mantenimiento"))
    difficulty = escape(str(task.get("difficulty") or "Media"))
    scheduled_at = escape(str(task.get("scheduled_at") or "Fecha N/D"))
    duration = escape(str(task.get("duration_label") or task.get("window") or "Duracion N/D"))
    status_value = escape(str(task.get("status") or "Programado"))
    impact = escape(str(task.get("impact") or "Impacto por confirmar"))
    reason = escape(str(task.get("reason") or "Revision programada"))
    return "\n".join(
        [
            "\U0001f527 <b>Mantenimiento programado</b>",
            f"\U0001f5a5 Servidor: <b>{hostname}</b>",
            f"\U0001f4cc Tipo: {maintenance_type}",
            f"\U0001f4c5 Fecha: {scheduled_at}",
            f"\u23f1 Duracion: {duration}",
            f"\U0001f6a6 Estado: {status_value}",
            f"\u26a0 Dificultad: {difficulty}",
            f"\U0001f4e3 Impacto: {impact}",
            f"\U0001f4dd Motivo: {reason}",
        ]
    )


class DNSTemplateRecordViewSet(viewsets.ModelViewSet):
    queryset = DNSTemplateRecord.objects.all()
    serializer_class = DNSTemplateRecordSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        record_type = self.request.query_params.get("type")
        active = self.request.query_params.get("is_active")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(content__icontains=search) | Q(description__icontains=search))
        if record_type:
            queryset = queryset.filter(record_type=record_type)
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        return queryset.order_by("order", "name", "record_type")

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        record = self.get_object()
        copy = DNSTemplateRecord.objects.create(
            name=record.name,
            record_type=record.record_type,
            content=record.content,
            ttl=record.ttl,
            priority=record.priority,
            order=record.order + 1,
            is_active=record.is_active,
            description=request.data.get("description", record.description),
        )
        return Response(self.get_serializer(copy).data, status=status.HTTP_201_CREATED)


class ProvisioningTemplateViewSet(viewsets.ModelViewSet):
    queryset = ProvisioningTemplate.objects.select_related("target_plan").all()
    serializer_class = ProvisioningTemplateSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get("category")
        active = self.request.query_params.get("is_active")
        search = self.request.query_params.get("search")
        if category:
            queryset = queryset.filter(category=category)
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(slug__icontains=search)
                | Q(description__icontains=search)
                | Q(target_plan__name__icontains=search)
            )
        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        template = self.get_object()
        name = str(request.data.get("name") or "").strip()
        if not name:
            return Response({"name": ["Este campo es requerido."]}, status=status.HTTP_400_BAD_REQUEST)
        copy = ProvisioningTemplate.objects.create(
            name=name,
            category=template.category,
            description=template.description,
            target_plan=template.target_plan,
            resources=template.resources,
            actions=template.actions,
            variables=template.variables,
            automation=template.automation,
            is_active=template.is_active,
            created_by=request.user if request.user.is_authenticated else None,
        )
        return Response(self.get_serializer(copy).data, status=status.HTTP_201_CREATED)


class GlobalNameserverViewSet(viewsets.ModelViewSet):
    queryset = GlobalNameserver.objects.select_related("node").all()
    serializer_class = GlobalNameserverSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        node = self.request.query_params.get("node")
        status_value = self.request.query_params.get("status")
        role = self.request.query_params.get("role")
        if search:
            queryset = queryset.filter(
                Q(hostname__icontains=search)
                | Q(short_name__icontains=search)
                | Q(ip_address__icontains=search)
                | Q(node__hostname__icontains=search)
                | Q(zone__icontains=search)
                | Q(role__icontains=search)
            )
        if node:
            queryset = queryset.filter(node_id=node)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if role:
            queryset = queryset.filter(role__iexact=role)
        return queryset.order_by("sequence", "hostname")

    def perform_create(self, serializer):
        instance = serializer.save()
        sync_global_nameserver_template()
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        sync_global_nameserver_template()
        return instance

    def perform_destroy(self, instance):
        instance.delete()
        sync_global_nameserver_template()

    @action(detail=False, methods=["post"], url_path="sync-defaults")
    def sync_defaults(self, _request):
        created = ensure_default_nameservers_for_all_nodes()
        queryset = self.filter_queryset(self.get_queryset())
        return Response({"created": len(created), "results": self.get_serializer(queryset, many=True).data})

    @action(detail=True, methods=["post"], url_path="sync-template")
    def sync_template(self, _request, pk=None):
        self.get_object()
        sync_global_nameserver_template()
        return Response({"status": "synced"})


class HostingAccountViewSet(viewsets.ModelViewSet):
    queryset = HostingAccount.objects.select_related("node", "plan").prefetch_related(
        "domains",
        "databases",
        "mailboxes",
        "provisioning_runs__steps__job",
    )
    serializer_class = HostingAccountSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = scoped_accounts(super().get_queryset(), self.request.user)
        node_id = self.request.query_params.get("node")
        status_value = self.request.query_params.get("status")
        if node_id:
            queryset = queryset.filter(node_id=node_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def perform_update(self, serializer):
        account = self.get_object()
        tracked_fields = ["plan", "owner", "reseller", "customer_name", "customer_email", "web_engine", "php_version", "disk_mb", "bandwidth_mb", "memory_mb", "cpu_pct"]
        before = {field: getattr(account, f"{field}_id", None) if field in ["plan", "owner", "reseller"] else getattr(account, field, None) for field in tracked_fields}
        updated = serializer.save()
        after = {field: getattr(updated, f"{field}_id", None) if field in ["plan", "owner", "reseller"] else getattr(updated, field, None) for field in tracked_fields}
        changes = {field: {"from": before[field], "to": after[field]} for field in tracked_fields if before[field] != after[field]}
        audit_action(
            self.request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=updated,
            metadata={"changes": changes},
        )

    @action(detail=False, methods=["post"], url_path="provision")
    def provision(self, request):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        serializer = ProvisionHostingAccountSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_CREATED,
            account=account,
            metadata={
                "plan": account.plan_id,
                "node": str(account.node_id),
                "username": account.username,
                "domain": account.primary_domain,
            },
        )
        return Response(HostingAccountSerializer(account, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="sync-status")
    def sync_status(self, request, pk=None):
        account = self.get_object()
        for run in account.provisioning_runs.order_by("created_at"):
            run.sync_from_jobs()
        account = self.get_queryset().get(pk=account.pk)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_SYNCED,
            account=account,
            metadata={"status": account.status},
        )
        return Response(HostingAccountSerializer(account, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="retry-failed")
    def retry_failed(self, request, pk=None):
        account = self.get_object()
        run = account.provisioning_runs.first()
        if not run:
            return Response({"detail": "La cuenta no tiene procesos de provisionamiento."}, status=status.HTTP_400_BAD_REQUEST)
        retried = retry_failed_provisioning_run(run)
        if retried == 0:
            return Response({"detail": "No hay jobs fallidos para reintentar."}, status=status.HTTP_400_BAD_REQUEST)
        account = self.get_queryset().get(pk=account.pk)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_RETRY_FAILED,
            account=account,
            target=run,
            metadata={"retried": retried, "run": str(run.id)},
        )
        return Response(
            {
                "retried": retried,
                "account": HostingAccountSerializer(account, context=self.get_serializer_context()).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="apply-software")
    def apply_software(self, request, pk=None):
        account = self.get_object()
        serializer = self.get_serializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        run = apply_account_software(account)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target=run,
            metadata={
                "job": "apply_software",
                "run": str(run.id),
                "web_engine": account.web_engine,
                "php_version": account.php_version,
            },
        )
        account = self.get_queryset().get(pk=account.pk)
        return Response(HostingAccountSerializer(account, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="software-info")
    def software_info(self, request, pk=None):
        account = self.get_object()
        job = collect_software_info(account)
        if job.status == AgentJob.Status.FAILED:
            return Response(
                {"detail": job.error_detail or job.error_code or "No se pudo consultar el software.", "job": str(job.id)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

    @action(detail=True, methods=["post"], url_path="software-settings")
    def software_settings(self, request, pk=None):
        account = self.get_object()
        job = apply_software_settings(account, request.data)
        if job.status == AgentJob.Status.FAILED:
            return Response(
                {"detail": job.error_detail or job.error_code or "No se pudieron aplicar los ajustes.", "job": str(job.id), "result": job.result or {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="openlitespeed/restart")
    def restart_openlitespeed(self, request, pk=None):
        account = self.get_object()
        if account.web_engine != HostingAccount.WebEngine.OPENLITESPEED:
            return Response({"detail": "La cuenta no usa OpenLiteSpeed."}, status=status.HTTP_400_BAD_REQUEST)

        recent_window = timezone.now() - timedelta(minutes=2)
        recent_job = AgentJob.objects.filter(
            node=account.node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload__source="client_openlitespeed_restart",
            payload__account_id=str(account.id),
            queued_at__gte=recent_window,
        ).exclude(status__in=[AgentJob.Status.FAILED, AgentJob.Status.CANCELED, AgentJob.Status.EXPIRED]).first()
        if recent_job:
            return Response(
                {
                    "detail": "OpenLiteSpeed ya fue reiniciado recientemente para esta cuenta. Espera unos minutos antes de intentarlo otra vez.",
                    "job": str(recent_job.id),
                    "status": recent_job.status,
                    "result": recent_job.result or {},
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        from .local_provisioning import dispatch_or_execute_local

        job = AgentJob.objects.create(
            node=account.node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload={
                "service": "lshttpd",
                "action": "restart",
                "source": "client_openlitespeed_restart",
                "account_id": str(account.id),
                "username": account.username,
                "domain": account.primary_domain,
            },
        )
        dispatch_or_execute_local(job)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target=job,
            metadata={"software_action": "restart_openlitespeed", "job": str(job.id)},
        )
        if job.status == AgentJob.Status.FAILED:
            return Response(
                {
                    "detail": job.error_detail or job.error_code or "No se pudo reiniciar OpenLiteSpeed.",
                    "job": str(job.id),
                    "status": job.status,
                    "result": job.result or {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        response_status = status.HTTP_200_OK if job.status == AgentJob.Status.SUCCESS else status.HTTP_202_ACCEPTED
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}}, status=response_status)

    @action(detail=True, methods=["get", "post"], url_path="software-performance-audit")
    def software_performance_audit(self, request, pk=None):
        account = self.get_object()
        if request.method == "GET":
            audits = HostingPerformanceAudit.objects.filter(account=account).select_related("job", "requested_by")[:10]
            return Response({"results": HostingPerformanceAuditSerializer(audits, many=True).data})
        try:
            audit = run_web_performance_audit(
                account,
                target_url=request.data.get("target_url") or "",
                duration_seconds=request.data.get("duration_seconds") or 15,
                samples=request.data.get("samples") or 6,
                requested_by=request.user,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(HostingPerformanceAuditSerializer(audit).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, pk=None):
        account = self.get_object()
        serializer = ChangeAccountPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = change_account_password(account, serializer.validated_data["password"])
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_PASSWORD_CHANGED,
            account=account,
            target=job,
            metadata={"job": str(job.id), "username": account.username},
        )
        return Response({"status": "queued", "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        account = self.get_object()
        job = suspend_account(account)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target=job,
            metadata={"action": "suspend", "job": str(job.id), "username": account.username},
        )
        return Response(HostingAccountSerializer(account, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="unsuspend")
    def unsuspend(self, request, pk=None):
        forbidden = reseller_team_write_forbidden(request)
        if forbidden:
            return forbidden
        account = self.get_object()
        job = unsuspend_account(account)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target=job,
            metadata={"action": "unsuspend", "job": str(job.id), "username": account.username},
        )
        return Response(HostingAccountSerializer(account, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get", "post"], url_path="usage")
    def usage(self, request, pk=None):
        account = self.get_object()
        if request.method == "POST" or request.query_params.get("refresh") in ["1", "true", "yes"]:
            job = collect_account_usage(account, wait=True)
            account.refresh_from_db()
            if job.status == "failed":
                return Response(
                    {
                        "status": "failed",
                        "job": str(job.id),
                        "error_code": job.error_code,
                        "error_detail": job.error_detail,
                        "usage": account.last_usage or {},
                        "last_usage_at": account.last_usage_at,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            return Response(
                {
                    "status": job.status,
                    "job": str(job.id),
                    "usage": account.last_usage or {},
                    "last_usage_at": account.last_usage_at,
                }
            )
        return Response({"status": "cached", "usage": account.last_usage or {}, "last_usage_at": account.last_usage_at})

    @action(detail=True, methods=["get", "post"], url_path="monitoring")
    def monitoring(self, request, pk=None):
        account = self.get_object()
        refresh = request.method == "POST" or request.query_params.get("refresh") in ["1", "true", "yes"]
        data = build_account_monitoring(account, refresh=refresh)
        if data.get("status") == "failed":
            return Response(data, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)

    @action(detail=True, methods=["get"], url_path="profile")
    def profile(self, request, pk=None):
        account = self.get_object()
        primary_domain = account.domains.filter(is_primary=True).first() or account.domains.filter(domain=account.primary_domain).first()
        latest_scan = account.security_scans.first()
        open_ticket_statuses = [
            SupportTicket.Status.OPEN,
            SupportTicket.Status.ANSWERED,
            SupportTicket.Status.CUSTOMER_REPLY,
        ]
        open_tickets = account.support_tickets.filter(status__in=open_ticket_statuses).count()
        apps = account.applications.all()
        monitor_snapshot = account.monitor_snapshots.first()
        node = account.node
        node_last_seen = node.last_seen_at
        node_age_seconds = int((timezone.now() - node_last_seen).total_seconds()) if node_last_seen else None
        usage = account.last_usage or {}
        waf_configuration = None
        if primary_domain:
            try:
                waf_configuration = primary_domain.waf_configuration
            except HostingWafConfiguration.DoesNotExist:
                waf_configuration = None
        security_summary = {
            "ssl_status": primary_domain.ssl_status if primary_domain else "pending",
            "ssl_issuer": primary_domain.ssl_issuer if primary_domain else "",
            "ssl_expires_at": primary_domain.ssl_expires_at if primary_domain else None,
            "web_protection_status": primary_domain.web_protection_status if primary_domain else "pending",
            "waf_status": waf_configuration.status if waf_configuration else "",
            "waf_mode": waf_configuration.mode if waf_configuration else "",
            "last_scan_status": latest_scan.status if latest_scan else "",
            "last_scan_at": latest_scan.updated_at if latest_scan else None,
        }
        data = {
            "account": HostingAccountSerializer(account, context=self.get_serializer_context()).data,
            "node": {
                "hostname": node.hostname,
                "public_ip": node_public_ip(node),
                "state": node.effective_state,
                "agent_version": node.agent_version,
                "os_name": node.os_name,
                "arch": node.arch,
                "last_seen_at": node_last_seen,
                "last_seen_age_seconds": node_age_seconds,
            },
            "usage": {
                "disk_used_mb": usage.get("disk_used_mb") or usage.get("storage", {}).get("total_mb"),
                "disk_quota_mb": usage.get("disk_quota_mb") or account.disk_mb,
                "bandwidth_used_mb": usage.get("bandwidth_used_mb", 0),
                "bandwidth_quota_mb": account.bandwidth_mb,
                "ram_used_mb": usage.get("ram_used_mb") or usage.get("memory_used_mb"),
                "memory_limit_mb": usage.get("memory_limit_mb") or account.memory_mb,
                "cpu_pct": usage.get("cpu_pct"),
                "cpu_limit_pct": account.cpu_pct,
                "last_usage_at": account.last_usage_at,
            },
            "services": {
                "domains": account.domains.count(),
                "databases": account.databases.count(),
                "mailboxes": account.mailboxes.count(),
                "applications": apps.count(),
                "ftp_users": account.ftp_users.count(),
                "protected_directories": HostingProtectedDirectory.objects.filter(domain__account=account).count(),
                "ip_blocks": HostingIPBlock.objects.filter(domain__account=account, enabled=True).count(),
                "open_tickets": open_tickets,
            },
            "security": security_summary,
            "monitoring": {
                "status": monitor_snapshot.status if monitor_snapshot else "unknown",
                "uptime_pct": monitor_snapshot.uptime_pct if monitor_snapshot else 0,
                "response_ms": monitor_snapshot.response_ms if monitor_snapshot else 0,
                "incidents_open": monitor_snapshot.incidents_open if monitor_snapshot else 0,
                "collected_at": monitor_snapshot.collected_at if monitor_snapshot else None,
            },
            "applications": [
                {
                    "id": app.id,
                    "name": app.name,
                    "type": app.app_type,
                    "status": app.status,
                    "version": app.version,
                    "url": app.url,
                    "updated_at": app.updated_at,
                }
                for app in apps[:8]
            ],
            "tickets": {
                "open": open_tickets,
                "latest": [
                    {
                        "id": ticket.id,
                        "display_id": ticket.display_id,
                        "subject": ticket.subject,
                        "status": ticket.status,
                        "priority": ticket.priority,
                        "updated_at": ticket.updated_at,
                    }
                    for ticket in account.support_tickets.all()[:5]
                ],
            },
            "provisioning": account.provisioning_runs.first()
            and ProvisioningRunSerializer(account.provisioning_runs.first(), context=self.get_serializer_context()).data,
        }
        return Response(data)

    @action(detail=True, methods=["get"], url_path="advanced-summary")
    def advanced_summary(self, request, pk=None):
        account = self.get_object()
        advanced_items = account.advanced_items.all()
        item_counts = {}
        for kind in HostingAdvancedItem.Kind.values:
            item_counts[kind] = advanced_items.filter(kind=kind).count()

        related_jobs = AgentJob.objects.filter(node=account.node).filter(
            Q(payload__username=account.username)
            | Q(payload__account_id=str(account.id))
            | Q(payload__domain=account.primary_domain)
        )[:20]
        apps_with_git = []
        for app in account.applications.all():
            git_config = app.metadata.get("git") if isinstance(app.metadata, dict) else None
            if isinstance(git_config, dict) and git_config.get("repo_url"):
                apps_with_git.append({
                    "app_id": app.id,
                    "app_name": app.name,
                    "app_type": app.app_type,
                    "repo_url": git_config.get("repo_url", ""),
                    "branch": git_config.get("branch", "main"),
                    "strategy": git_config.get("strategy", ""),
                    "updated_at": app.updated_at,
                })
        return Response({
            "account": HostingAccountSerializer(account, context=self.get_serializer_context()).data,
            "counts": item_counts,
            "items": HostingAdvancedItemSerializer(advanced_items, many=True, context=self.get_serializer_context()).data,
            "apps_with_git": apps_with_git,
            "recent_jobs": AgentJobSerializer(related_jobs, many=True).data,
            "recent_audit": AuditLogSerializer(account.audit_logs.all()[:20], many=True).data,
        })

    @action(detail=False, methods=["get"], url_path="dashboard-summary")
    def dashboard_summary(self, request):
        accounts = list(self.get_queryset())
        account_ids = [account.id for account in accounts]
        domains = list(HostingDomain.objects.filter(account_id__in=account_ids))
        databases = list(HostingDatabase.objects.filter(account_id__in=account_ids))
        mailboxes = list(HostingMailbox.objects.filter(account_id__in=account_ids))
        jobs = AgentJob.objects.filter(node_id__in=[account.node_id for account in accounts])[:12]
        audits = AuditLog.objects.filter(account_id__in=account_ids)[:12]

        def number(value, default=0):
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        def mb_from_bytes(value):
            return round(number(value) / 1024 / 1024, 2) if value is not None else 0

        def usage_value(account, *keys):
            usage = account.last_usage or {}
            current = usage
            for key in keys:
                if not isinstance(current, dict):
                    return None
                current = current.get(key)
            return current

        disk_used = sum(number(usage_value(account, "disk_used_mb") or usage_value(account, "storage", "total_mb")) for account in accounts)
        disk_quota = sum(number(account.disk_mb) for account in accounts)
        mail_storage = sum(number(usage_value(account, "storage", "mail_mb") or usage_value(account, "storage", "mailboxes_mb")) for account in accounts)
        database_storage = sum(number(usage_value(account, "storage", "databases_mb")) for account in accounts)
        backup_storage = sum(number(usage_value(account, "storage", "backups_mb")) for account in accounts)
        traffic_used = sum(number(usage_value(account, "bandwidth_used_mb")) or mb_from_bytes(usage_value(account, "bandwidth_bytes")) for account in accounts)
        traffic_quota = sum(number(account.bandwidth_mb) for account in accounts)
        cpu_values = [number(usage_value(account, "cpu_pct")) for account in accounts if usage_value(account, "cpu_pct") is not None]
        cpu_pct = round(sum(cpu_values) / len(cpu_values)) if cpu_values else 0
        memory_used = sum(number(usage_value(account, "ram_used_mb")) or mb_from_bytes(usage_value(account, "ram_used_bytes")) for account in accounts)
        memory_limit = sum(number(usage_value(account, "memory_limit_mb")) or number(account.memory_mb) for account in accounts)
        mail_rejected = sum(number(usage_value(account, "mail", "rejected")) for account in accounts)
        ssl_active = len([domain for domain in domains if domain.ssl_status == HostingDomain.Status.ACTIVE])
        ssl_failed = len([domain for domain in domains if domain.ssl_status == HostingDomain.Status.FAILED])
        active_accounts = len([account for account in accounts if account.status == HostingAccount.Status.ACTIVE])
        total_accounts = max(len(accounts), 1)

        hourly = []
        for account in accounts:
            values = usage_value(account, "http", "hourly")
            if isinstance(values, list):
                hourly.append([number(item) for item in values[-9:]])
        if hourly:
            size = max(len(row) for row in hourly)
            source = [sum(row[index] if index < len(row) else 0 for row in hourly) for index in range(size)]
        else:
            source = [0] * 9
        max_source = max(source) if source else 0
        traffic_values = [
            {
                "down": round((value / max_source) * 86, 2) if max_source else 0,
                "up": round((value / max_source) * 42, 2) if max_source else 0,
            }
            for value in source
        ]

        def pct(value, total):
            return max(0, min(100, round((value / total) * 100))) if total else 0

        events = []
        for account in accounts:
            for item in (usage_value(account, "http", "recent_errors") or [])[:3]:
                if isinstance(item, dict):
                    label = item.get("raw") or f"HTTP {item.get('status', '')} {item.get('url', '')}".strip()
                    if label:
                        events.append({"label": label, "tone": "amber"})
            for item in (usage_value(account, "mail", "events") or [])[:4]:
                if isinstance(item, dict):
                    label = item.get("detail") or item.get("status") or f"Correo {item.get('direction', 'procesado')} {item.get('to', '')}".strip()
                    if label:
                        events.append({"label": label, "tone": "red" if str(item.get("status", "")).lower() in ["rejected", "failed", "spam"] else "emerald"})
        for job in jobs[:4]:
            events.append({"label": f"{job.get_job_type_display()}: {job.get_status_display()}", "tone": "red" if job.status == AgentJob.Status.FAILED else "emerald"})
        for audit in audits[:4]:
            events.append({"label": f"{audit.action} · {audit.target_label or audit.target_id or audit.account}", "tone": "emerald"})
        if not events:
            events.append({"label": "Sin eventos recientes registrados por el backend.", "tone": "emerald"})

        alerts = []
        web_errors = sum(len(usage_value(account, "http", "recent_errors") or []) for account in accounts)
        if web_errors:
            alerts.append({"label": f"{web_errors} errores web recientes", "tone": "amber"})
        if mail_rejected:
            alerts.append({"label": f"{round(mail_rejected)} correos rechazados", "tone": "red"})
        if ssl_failed:
            alerts.append({"label": f"{ssl_failed} SSL requiere revision", "tone": "red"})
        if not alerts:
            alerts.append({"label": "Servicios principales saludables", "tone": "emerald"})

        plan_mail_limit = sum(number(account.plan.max_mailboxes if account.plan else account.mailboxes.count() or 10) for account in accounts)
        plan_db_limit = sum(number(account.plan.max_databases if account.plan else account.databases.count() or 10) for account in accounts)
        health_pct = max(0, min(100, round((active_accounts / total_accounts) * 100) - min(40, round(mail_rejected * 3 + ssl_failed * 12 + web_errors * 2))))
        response = {
            "activeSites": active_accounts,
            "alerts": alerts[:3],
            "backupPct": pct(backup_storage, disk_quota),
            "cpuLimitPct": round(sum(number(account.cpu_pct) for account in accounts) / total_accounts) if accounts else 100,
            "cpuPct": max(0, min(100, cpu_pct)),
            "criticalMailboxes": len([mailbox for mailbox in mailboxes if mailbox.usage_status == "critical" or mailbox.status != HostingMailbox.Status.ACTIVE]),
            "databaseDetail": f"{len([db for db in databases if db.engine == HostingDatabase.Engine.MARIADB])} MariaDB / {len([db for db in databases if db.engine == HostingDatabase.Engine.POSTGRESQL])} PostgreSQL",
            "databasePct": pct(len(databases), plan_db_limit),
            "diskPct": pct(disk_used, disk_quota),
            "diskQuota": round(disk_quota, 2),
            "diskUsed": round(disk_used, 2),
            "events": events[:6],
            "healthPct": health_pct,
            "healthSub": f"{len(accounts)} cuenta(s) / {len(domains)} dominio(s)",
            "mailPct": pct(len(mailboxes), plan_mail_limit),
            "primarySites": len([domain for domain in domains if domain.is_primary]) or (1 if accounts else 0),
            "ramPct": pct(memory_used, memory_limit),
            "ramSub": f"{round(memory_used, 1)} MB / {round(memory_limit, 1)} MB",
            "sslDetail": f"{ssl_failed} con error" if ssl_failed else f"{ssl_active} dominios protegidos",
            "sslValue": "Revisar" if ssl_failed else "Activo" if ssl_active else "Pendiente",
            "storagePct": pct(mail_storage + database_storage, disk_quota),
            "storageUsed": round(mail_storage + database_storage, 2),
            "totalReceived": round(traffic_used, 2),
            "totalSent": round(sum(number(usage_value(account, "mail", "sent")) for account in accounts), 2),
            "trafficValues": traffic_values,
            "upstreamNow": traffic_values[-1]["up"] if traffic_values else 0,
            "downstreamNow": traffic_values[-1]["down"] if traffic_values else 0,
            "trafficPct": pct(traffic_used, traffic_quota),
            "totalCounts": {
                "accounts": len(accounts),
                "domains": len(domains),
                "mailboxes": len(mailboxes),
                "databases": len(databases),
            },
        }
        return Response(response)

    @action(detail=False, methods=["get"], url_path="sites-overview")
    def sites_overview(self, request):
        accounts = list(self.get_queryset())
        account_ids = [account.id for account in accounts]
        apps = list(HostingApplication.objects.select_related("domain", "account").filter(account_id__in=account_ids))

        def number(value, default=0):
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        def mb_from_bytes(value):
            return round(number(value) / 1024 / 1024, 2) if value is not None else 0

        def usage_value(account, *keys):
            current = account.last_usage or {}
            for key in keys:
                if not isinstance(current, dict):
                    return None
                current = current.get(key)
            return current

        def pct(value, total):
            return max(0, min(100, round((value / total) * 100))) if total else 0

        def runtime_for(account, app):
            if app:
                return app.app_type
            software = usage_value(account, "software") or {}
            if isinstance(software, dict):
                if software.get("node_version"):
                    return "nodejs"
                if software.get("django_version"):
                    return "django"
                if software.get("python_version"):
                    return "python"
                if software.get("composer_version") or software.get("laravel_version"):
                    return "laravel"
            return "unknown"

        sites = []
        for account in accounts:
            account_apps = [app for app in apps if app.account_id == account.id]
            app = account_apps[0] if account_apps else None
            primary_domain = account.domains.filter(is_primary=True).first() or account.domains.filter(domain=account.primary_domain).first()
            disk_used = number(usage_value(account, "disk_used_mb") or usage_value(account, "storage", "total_mb"))
            disk_quota = number(usage_value(account, "disk_quota_mb") or account.disk_mb)
            traffic_used = number(usage_value(account, "bandwidth_used_mb")) or mb_from_bytes(usage_value(account, "bandwidth_bytes"))
            traffic_quota = number(usage_value(account, "bandwidth_mb") or account.bandwidth_mb)
            http_errors = usage_value(account, "http", "recent_errors") or []
            mail_events = usage_value(account, "mail", "events") or []
            mail_rejected = number(usage_value(account, "mail", "rejected"))
            hourly = usage_value(account, "http", "hourly") or []
            runtime = runtime_for(account, app)
            health = "ok"
            health_reason = "Sin incidencias recientes"
            if account.status == HostingAccount.Status.FAILED:
                health = "danger"
                health_reason = "La cuenta esta en estado fallido"
            elif account.status == HostingAccount.Status.SUSPENDED:
                health = "danger"
                health_reason = "La cuenta esta suspendida"
            elif primary_domain and primary_domain.ssl_status == HostingDomain.Status.FAILED:
                health = "warning"
                health_reason = "El SSL del dominio requiere revision"
            elif account.status != HostingAccount.Status.ACTIVE:
                health = "warning"
                health_reason = "La cuenta aun no esta activa"
            elif http_errors:
                health = "warning"
                health_reason = "Hay errores HTTP recientes"
            elif mail_rejected:
                health = "warning"
                health_reason = "Hay correos rechazados recientes"
            sites.append({
                "account": HostingAccountSerializer(account, context=self.get_serializer_context()).data,
                "app": HostingApplicationSerializer(app, context=self.get_serializer_context()).data if app else None,
                "apps_count": len(account_apps),
                "domain": account.primary_domain,
                "document_root": primary_domain.document_root if primary_domain else "public_html",
                "engine": "OpenLiteSpeed" if account.web_engine == HostingAccount.WebEngine.OPENLITESPEED else "Nginx + PHP-FPM",
                "runtime": runtime,
                "status": account.status,
                "health": health,
                "health_reason": health_reason,
                "disk": {"used_mb": round(disk_used, 2), "quota_mb": round(disk_quota, 2), "percent": pct(disk_used, disk_quota)},
                "traffic": {"used_mb": round(traffic_used, 2), "quota_mb": round(traffic_quota, 2), "percent": pct(traffic_used, traffic_quota), "hourly": [number(item) for item in hourly[-12:]]},
                "http": {
                    "requests": int(number(usage_value(account, "http", "requests"))),
                    "unique_ips": int(number(usage_value(account, "http", "unique_ips"))),
                    "recent_errors": http_errors[:5] if isinstance(http_errors, list) else [],
                },
                "mail": {
                    "sent": int(number(usage_value(account, "mail", "sent"))),
                    "received": int(number(usage_value(account, "mail", "received"))),
                    "rejected": int(mail_rejected),
                    "spam": int(number(usage_value(account, "mail", "spam"))),
                    "events": mail_events[:6] if isinstance(mail_events, list) else [],
                },
                "security": {
                    "ssl_status": primary_domain.ssl_status if primary_domain else "pending",
                    "ssl_expires_at": primary_domain.ssl_expires_at if primary_domain else None,
                    "web_protection_status": primary_domain.web_protection_status if primary_domain else "pending",
                },
                "quick_actions": [
                    {"key": "open_site", "label": "Abrir sitio", "url": f"https://{account.primary_domain}", "enabled": True},
                    {"key": "wp_admin", "label": "Acceder a wp-admin", "url": f"https://{account.primary_domain}/wp-admin/", "enabled": runtime == "wordpress"},
                    {"key": "restart", "label": "Reiniciar servicio", "enabled": bool(app and runtime in ["nodejs", "python", "django", "laravel"])},
                    {"key": "deploy", "label": "Deploy update", "enabled": bool(app and runtime in ["nodejs", "python", "django", "laravel"])},
                    {"key": "backup", "label": "Crear backup", "enabled": bool(app)},
                    {"key": "check_updates", "label": "Buscar actualizaciones", "enabled": bool(app)},
                ],
            })

        disk_used_total = sum(item["disk"]["used_mb"] for item in sites)
        disk_quota_total = sum(item["disk"]["quota_mb"] for item in sites)
        traffic_used_total = sum(item["traffic"]["used_mb"] for item in sites)
        traffic_quota_total = sum(item["traffic"]["quota_mb"] for item in sites)
        mail_events_total = sum(len(item["mail"]["events"]) for item in sites)
        response = {
            "overview": {
                "total": len(sites),
                "active": len([site for site in sites if site["status"] == HostingAccount.Status.ACTIVE]),
                "apps": len([site for site in sites if site["app"]]),
                "wordpress": len([site for site in sites if site["runtime"] == "wordpress"]),
                "moodle": len([site for site in sites if site["runtime"] == "moodle"]),
                "alerts": len([site for site in sites if site["health"] != "ok"]),
                "diskUsed": round(disk_used_total, 2),
                "diskPct": pct(disk_used_total, disk_quota_total),
                "trafficUsed": round(traffic_used_total, 2),
                "trafficPct": pct(traffic_used_total, traffic_quota_total),
                "requests": sum(site["http"]["requests"] for site in sites),
                "mailEvents": mail_events_total,
                "mailRejected": sum(site["mail"]["rejected"] for site in sites),
                "diskSeries": [site["disk"]["percent"] for site in sites][-10:],
                "trafficSeries": [site["traffic"]["percent"] for site in sites][-10:],
                "requestSeries": [value for site in sites for value in site["traffic"]["hourly"]][-10:],
                "mailSeries": [len(site["mail"]["events"]) + site["mail"]["rejected"] for site in sites][-10:],
            },
            "sites": sites,
            "mail_events": [
                {**event, "domain": site["domain"]}
                for site in sites
                for event in site["mail"]["events"]
                if isinstance(event, dict)
            ][:12],
        }
        return Response(response)

    def _file_job_response(self, account, job_type, payload):
        job = run_account_file_job(account, job_type, payload)
        if job.status == AgentJob.Status.SUCCESS:
            return Response({"status": "success", "job": str(job.id), **(job.result or {})})
        if job.status == AgentJob.Status.FAILED:
            return Response(
                {
                    "status": "failed",
                    "job": str(job.id),
                    "error_code": job.error_code,
                    "error_detail": job.error_detail,
                    "result": job.result or {},
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"status": job.status, "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="security-scan")
    def security_scan(self, request, pk=None):
        account = self.get_object()
        scan_type = str(request.data.get("scan_type") or "quick").strip()
        path = str(request.data.get("path") or "").strip()
        job = queue_security_scan(account, scan_type=scan_type, path=path)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            target=job,
            metadata={"security_action": "scan", "scan_type": scan_type, "path": path or None, "job": str(job.id)},
        )
        return Response({"status": "queued", "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="sftp-info")
    def sftp_info(self, request, pk=None):
        account = self.get_object()
        return Response(sftp_connection_info(account))

    @action(detail=True, methods=["post"], url_path="sftp-password")
    def sftp_password(self, request, pk=None):
        return self.change_password(request, pk)

    @action(detail=True, methods=["get"], url_path="files")
    def files(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFilePathSerializer(data={"path": request.query_params.get("path", "/")})
        serializer.is_valid(raise_exception=True)
        return self._file_job_response(account, AgentJob.Type.FILE_LIST, serializer.validated_data)

    @action(detail=True, methods=["get"], url_path="files/read")
    def file_read(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFilePathSerializer(data={"path": request.query_params.get("path", "")})
        serializer.is_valid(raise_exception=True)
        return self._file_job_response(account, AgentJob.Type.FILE_READ, serializer.validated_data)

    @action(detail=True, methods=["post"], url_path="files/write")
    def file_write(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_WRITE, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "write", "path": serializer.validated_data["path"]})
        return response

    @action(detail=True, methods=["post"], url_path="files/upload", parser_classes=[MultiPartParser, FormParser])
    def file_upload(self, request, pk=None):
        account = self.get_object()
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "Archivo requerido."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = AccountFileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_path = save_account_upload_file(uploaded_file)
        payload = {
            "path": serializer.validated_data["path"],
            "source_path": str(source_path),
            "overwrite": serializer.validated_data["overwrite"],
        }
        response = self._file_job_response(account, AgentJob.Type.FILE_UPLOAD, payload)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "upload", "path": serializer.validated_data["path"], "size": uploaded_file.size})
        return response

    @action(detail=True, methods=["post"], url_path="files/import-url")
    def file_import_url(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileImportUrlSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_IMPORT_URL, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "import_url", "path": serializer.validated_data.get("path", ""), "url": serializer.validated_data["url"]})
        return response

    @action(detail=True, methods=["post"], url_path="files/delete")
    def file_delete(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_DELETE, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "delete", "path": serializer.validated_data["path"]})
        return response

    @action(detail=True, methods=["post"], url_path="files/mkdir")
    def file_mkdir(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileMkdirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_MKDIR, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "mkdir", "path": serializer.validated_data["path"]})
        return response

    @action(detail=True, methods=["post"], url_path="files/chmod")
    def file_chmod(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileChmodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_CHMOD, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "chmod", "path": serializer.validated_data["path"], "mode": serializer.validated_data["mode"]})
        return response

    @action(detail=True, methods=["post"], url_path="files/compress")
    def file_compress(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileCompressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_COMPRESS, serializer.validated_data)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            metadata={
                "file_action": "compress",
                "paths": serializer.validated_data["paths"],
                "archive_name": serializer.validated_data["archive_name"],
                "format": serializer.validated_data["format"],
                "destination_path": serializer.validated_data.get("destination_path", ""),
            },
        )
        return response

    @action(detail=True, methods=["post"], url_path="files/extract")
    def file_extract(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileExtractSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_EXTRACT, serializer.validated_data)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=account,
            metadata={
                "file_action": "extract",
                "path": serializer.validated_data["path"],
                "destination_path": serializer.validated_data.get("destination_path", ""),
            },
        )
        return response

    @action(detail=True, methods=["post"], url_path="files/copy")
    def file_copy(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_COPY, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "copy", **serializer.validated_data})
        return response

    @action(detail=True, methods=["post"], url_path="files/move")
    def file_move(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = self._file_job_response(account, AgentJob.Type.FILE_MOVE, serializer.validated_data)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "move", **serializer.validated_data})
        return response

    @action(detail=True, methods=["post"], url_path="files/rename")
    def file_rename(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFileRenameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_path = serializer.validated_data["path"].rstrip("/") or "/"
        parent = "/" + "/".join(source_path.strip("/").split("/")[:-1])
        if parent == "/":
            destination_path = f"/{serializer.validated_data['name']}"
        else:
            destination_path = f"{parent}/{serializer.validated_data['name']}"
        payload = {"path": source_path, "destination_path": destination_path, "overwrite": serializer.validated_data["overwrite"]}
        response = self._file_job_response(account, AgentJob.Type.FILE_MOVE, payload)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"file_action": "rename", **payload})
        return response

    @action(detail=True, methods=["get"], url_path="files/download")
    def file_download(self, request, pk=None):
        account = self.get_object()
        serializer = AccountFilePathSerializer(data={"path": request.query_params.get("path", "")})
        serializer.is_valid(raise_exception=True)
        filename = os.path.basename(serializer.validated_data["path"].rstrip("/")) or "download.bin"
        export_path = account_download_export_path(filename)
        job = run_account_file_job(account, AgentJob.Type.FILE_DOWNLOAD, {"path": serializer.validated_data["path"], "export_path": str(export_path)}, timeout=20)
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo preparar la descarga."}, status=status.HTTP_502_BAD_GATEWAY)
        if not export_path.exists():
            return Response({"detail": "La descarga aun no esta lista."}, status=status.HTTP_202_ACCEPTED)
        response = FileResponse(export_path.open("rb"), as_attachment=True, filename=filename)
        response["X-Content-Type-Options"] = "nosniff"
        return response


class HostingMailboxViewSet(viewsets.ModelViewSet):
    queryset = HostingMailbox.objects.select_related("account", "account__node", "account__plan").all()
    serializer_class = HostingMailboxSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if search:
            queryset = queryset.filter(email__icontains=search)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CreateMailboxSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        metadata = {
            key: serializer.validated_data[key]
            for key in [
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
            if key in serializer.validated_data
        }
        mailbox = create_mailbox(
            serializer.validated_data["account"],
            serializer.validated_data["email"],
            serializer.validated_data["password"],
            serializer.validated_data["quota_mb"],
            metadata,
        )
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        mailbox = self.get_object()
        serializer = UpdateMailboxSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mailbox = update_mailbox(mailbox, dict(serializer.validated_data))
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    def destroy(self, request, *args, **kwargs):
        mailbox = self.get_object()
        delete_mailbox(mailbox)
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, pk=None):
        mailbox = self.get_object()
        serializer = ChangeMailboxPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_mailbox_password(mailbox, serializer.validated_data["password"])
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, _request, pk=None):
        mailbox = self.get_object()
        suspend_mailbox(mailbox)
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="unsuspend")
    def unsuspend(self, _request, pk=None):
        mailbox = self.get_object()
        unsuspend_mailbox(mailbox)
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="set-quota")
    def set_quota(self, request, pk=None):
        mailbox = self.get_object()
        serializer = SetMailboxQuotaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_mailbox_quota(mailbox, serializer.validated_data["quota_mb"])
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="refresh-usage")
    def refresh_usage(self, _request, pk=None):
        mailbox = self.get_object()
        collect_mailbox_usage(mailbox)
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="test-delivery")
    def test_delivery(self, request, pk=None):
        mailbox = self.get_object()
        serializer = TestMailboxDeliverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        test_mail_delivery(
            mailbox,
            serializer.validated_data["to"],
            serializer.validated_data.get("subject", ""),
        )
        return Response(HostingMailboxSerializer(mailbox, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="webmail-url")
    def webmail_url(self, request, pk=None):
        mailbox = self.get_object()
        try:
            url = create_webmail_sso(mailbox, request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"url": url})

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        account_id = request.data.get("account") or request.query_params.get("account")
        allowed_accounts = scoped_accounts(HostingAccount.objects.select_related("node"), request.user)
        account = allowed_accounts.filter(id=account_id).first() if account_id else allowed_accounts.first()
        if not account:
            return Response({"detail": "Cuenta hosting no encontrada."}, status=status.HTTP_404_NOT_FOUND)
        job = sync_mailboxes(account)
        queryset = self.get_queryset().filter(account=account)
        return Response({"status": job.status, "job": str(job.id), "results": HostingMailboxSerializer(queryset, many=True, context=self.get_serializer_context()).data})


class HostingFtpUserViewSet(viewsets.ModelViewSet):
    queryset = HostingFtpUser.objects.select_related("account", "account__node", "last_job").all()
    serializer_class = HostingFtpUserSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if search:
            queryset = queryset.filter(Q(username__icontains=search) | Q(root__icontains=search))
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CreateFtpUserSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        ftp_user = create_ftp_user(
            serializer.validated_data["account"],
            serializer.validated_data["username"],
            serializer.validated_data["password"],
            serializer.validated_data["root"],
            serializer.validated_data["quota_mb"],
        )
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=ftp_user.account,
            target=ftp_user,
            metadata={"ftp_action": "create", "username": ftp_user.username, "root": ftp_user.root, "quota_mb": ftp_user.quota_mb},
        )
        return Response(HostingFtpUserSerializer(ftp_user, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        ftp_user = self.get_object()
        serializer = UpdateFtpUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data.get("quota_mb", 0) and ftp_user.account.disk_mb and serializer.validated_data["quota_mb"] > ftp_user.account.disk_mb:
            return Response({"quota_mb": ["La cuota FTP no puede superar la cuota de disco de la cuenta."]}, status=status.HTTP_400_BAD_REQUEST)

        root = serializer.validated_data.get("root")
        if root:
            ftp_user.root = root
            ftp_user.save(update_fields=["root", "updated_at"])

        if "quota_mb" in serializer.validated_data:
            ftp_user.quota_mb = serializer.validated_data["quota_mb"]
            ftp_user.save(update_fields=["quota_mb", "updated_at"])

        password = serializer.validated_data.get("password")
        if password or "quota_mb" in serializer.validated_data:
            ftp_user.status = HostingFtpUser.Status.PENDING
            ftp_user.save(update_fields=["status", "updated_at"])
            ftp_user = create_ftp_user(ftp_user.account, ftp_user.username, password or "", ftp_user.root, ftp_user.quota_mb, ftp_user=ftp_user)

        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=ftp_user.account,
            target=ftp_user,
            metadata={"ftp_action": "update", "username": ftp_user.username, "root": ftp_user.root, "quota_mb": ftp_user.quota_mb, "password_changed": bool(password)},
        )
        return Response(HostingFtpUserSerializer(ftp_user, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        ftp_user = self.get_object()
        delete_ftp_user(ftp_user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=ftp_user.account,
            target=ftp_user,
            metadata={"ftp_action": "delete", "username": ftp_user.username, "root": ftp_user.root},
        )
        return Response(HostingFtpUserSerializer(ftp_user, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        ftp_user = self.get_object()
        suspend_ftp_user(ftp_user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=ftp_user.account,
            target=ftp_user,
            metadata={"ftp_action": "suspend", "username": ftp_user.username, "root": ftp_user.root},
        )
        return Response(HostingFtpUserSerializer(ftp_user, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="unsuspend")
    def unsuspend(self, request, pk=None):
        ftp_user = self.get_object()
        unsuspend_ftp_user(ftp_user)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=ftp_user.account,
            target=ftp_user,
            metadata={"ftp_action": "unsuspend", "username": ftp_user.username, "root": ftp_user.root},
        )
        return Response(HostingFtpUserSerializer(ftp_user, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)


class HostingProtectedDirectoryViewSet(viewsets.ModelViewSet):
    queryset = HostingProtectedDirectory.objects.select_related("domain", "domain__account", "domain__account__node").all()
    serializer_class = HostingProtectedDirectorySerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(domain__account__in=allowed_accounts)
        domain_id = self.request.query_params.get("domain")
        account_id = self.request.query_params.get("account")
        if domain_id:
            queryset = queryset.filter(domain_id=domain_id)
        if account_id:
            queryset = queryset.filter(domain__account_id=account_id)
        return queryset

    def perform_create(self, serializer):
        password = serializer.validated_data.pop("password")
        item = serializer.save(status=HostingProtectedDirectory.Status.PENDING)
        queue_protected_directories_apply(item.domain, {item.id: password})

    def perform_update(self, serializer):
        password = serializer.validated_data.pop("password", "")
        item = serializer.save(status=HostingProtectedDirectory.Status.PENDING)
        queue_protected_directories_apply(item.domain, {item.id: password} if password else {})

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        domain = item.domain
        self.perform_destroy(item)
        queue_protected_directories_apply(domain)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle(self, request, pk=None):
        item = self.get_object()
        item.enabled = not item.enabled
        item.status = HostingProtectedDirectory.Status.PENDING
        item.save(update_fields=["enabled", "status", "updated_at"])
        queue_protected_directories_apply(item.domain)
        return Response(HostingProtectedDirectorySerializer(item, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="password")
    def password(self, request, pk=None):
        item = self.get_object()
        password = str(request.data.get("password") or "")
        if len(password) < 8:
            return Response({"password": "La contrasena debe tener al menos 8 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
        item.status = HostingProtectedDirectory.Status.PENDING
        item.save(update_fields=["status", "updated_at"])
        queue_protected_directories_apply(item.domain, {item.id: password})
        return Response(HostingProtectedDirectorySerializer(item, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)


class HostingIPBlockViewSet(viewsets.ModelViewSet):
    queryset = HostingIPBlock.objects.select_related("domain", "domain__account", "domain__account__node").all()
    serializer_class = HostingIPBlockSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(domain__account__in=allowed_accounts)
        domain_id = self.request.query_params.get("domain")
        account_id = self.request.query_params.get("account")
        if domain_id:
            queryset = queryset.filter(domain_id=domain_id)
        if account_id:
            queryset = queryset.filter(domain__account_id=account_id)
        return queryset

    def perform_create(self, serializer):
        item = serializer.save(status=HostingIPBlock.Status.PENDING)
        queue_ip_blocks_apply(item.domain)

    def perform_update(self, serializer):
        item = serializer.save(status=HostingIPBlock.Status.PENDING)
        queue_ip_blocks_apply(item.domain)

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        domain = item.domain
        self.perform_destroy(item)
        queue_ip_blocks_apply(domain)
        return Response(status=status.HTTP_204_NO_CONTENT)


class HostingSecurityScanViewSet(viewsets.ModelViewSet):
    queryset = HostingSecurityScan.objects.select_related("account", "account__node", "last_job").all()
    serializer_class = HostingSecurityScanSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        status_value = self.request.query_params.get("status")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def _sync_scan(self, scan):
        if scan.last_job_id:
            scan.last_job.refresh_from_db()
            sync_security_scan_from_job(scan, scan.last_job)
            scan.refresh_from_db()
        return scan

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        for scan in queryset[:25]:
            self._sync_scan(scan)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        scan = self._sync_scan(self.get_object())
        return Response(self.get_serializer(scan).data)

    def perform_create(self, serializer):
        scan = serializer.save(status=HostingSecurityScan.Status.QUEUED, progress=5)
        queue_security_scan(scan.account, scan.scan_type, scan.path, scan)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):
        scan = self.get_object()
        if scan.status in [HostingSecurityScan.Status.QUEUED, HostingSecurityScan.Status.RUNNING]:
            return Response({"detail": "El escaneo ya esta en cola o en proceso."}, status=status.HTTP_400_BAD_REQUEST)
        queue_security_scan(scan.account, scan.scan_type, scan.path, scan)
        scan.refresh_from_db()
        return Response(self.get_serializer(scan).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="remediate")
    def remediate(self, request, pk=None):
        scan = self.get_object()
        action_value = request.data.get("action") or "quarantine"
        if action_value not in ["clean", "quarantine", "delete"]:
            return Response({"detail": "Accion de limpieza no valida."}, status=status.HTTP_400_BAD_REQUEST)
        if scan.status != HostingSecurityScan.Status.THREAT and scan.infected_files == 0:
            return Response({"detail": "El escaneo no tiene amenazas registradas para limpiar."}, status=status.HTTP_400_BAD_REQUEST)
        targets = request.data.get("targets")
        if not isinstance(targets, list) or not targets:
            targets = (scan.report or {}).get("infected_files") or []
        queue_security_remediation(scan, action_value, targets, request.user.get_username())
        scan.refresh_from_db()
        return Response(self.get_serializer(scan).data, status=status.HTTP_202_ACCEPTED)


class HostingMonitorCheckViewSet(viewsets.ModelViewSet):
    queryset = HostingMonitorCheck.objects.select_related("account", "account__node").all()
    serializer_class = HostingMonitorCheckSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset


class HostingMonitorIncidentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HostingMonitorIncident.objects.select_related("account", "monitor_check").all()
    serializer_class = HostingMonitorIncidentSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        incident = self.get_object()
        incident.status = HostingMonitorIncident.Status.ACKNOWLEDGED
        incident.acknowledged_at = timezone.now()
        incident.save(update_fields=["status", "acknowledged_at", "updated_at"])
        return Response(self.get_serializer(incident).data)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        incident = self.get_object()
        incident.status = HostingMonitorIncident.Status.RESOLVED
        incident.resolved_at = timezone.now()
        incident.save(update_fields=["status", "resolved_at", "updated_at"])
        return Response(self.get_serializer(incident).data)


class HostingMonitorAlertRuleViewSet(viewsets.ModelViewSet):
    queryset = HostingMonitorAlertRule.objects.select_related("account").all()
    serializer_class = HostingMonitorAlertRuleSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset

    @action(detail=True, methods=["post"], url_path="test")
    def test(self, request, pk=None):
        rule = self.get_object()
        if not rule.enabled:
            return Response({"detail": "La alerta esta desactivada."}, status=status.HTTP_400_BAD_REQUEST)
        if rule.channel == HostingMonitorAlertRule.Channel.EMAIL and not rule.target:
            rule.last_test_at = timezone.now()
            rule.last_test_status = "failed: sin destino"
            rule.save(update_fields=["last_test_at", "last_test_status", "updated_at"])
            return Response({"detail": "La alerta por email no tiene destinatario configurado."}, status=status.HTTP_400_BAD_REQUEST)
        rule.last_test_at = timezone.now()
        rule.last_test_status = "sent" if rule.channel == HostingMonitorAlertRule.Channel.EMAIL else "ok"
        rule.save(update_fields=["last_test_at", "last_test_status", "updated_at"])
        return Response(self.get_serializer(rule).data)


class HostingAdvancedItemViewSet(viewsets.ModelViewSet):
    queryset = HostingAdvancedItem.objects.select_related("account", "account__node", "last_job").all()
    serializer_class = HostingAdvancedItemSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        kind = self.request.query_params.get("kind")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset

    def _queue_apply(self, item, *, delete=False):
        from .local_provisioning import dispatch_or_execute_local

        item.status = HostingAdvancedItem.Status.PENDING
        item.save(update_fields=["status", "updated_at"])
        job = AgentJob.objects.create(
            node=item.account.node,
            job_type=AgentJob.Type.SERVICE_ACTION,
            payload={
                "action": "apply_advanced_item",
                "item_id": item.id,
                "account_id": str(item.account_id),
                "username": item.account.username,
                "domain": item.account.primary_domain,
                "kind": item.kind,
                "name": item.name,
                "enabled": bool(item.enabled) and not delete,
                "delete": bool(delete),
                "config": item.config if isinstance(item.config, dict) else {},
            },
        )
        item.last_job = job
        item.save(update_fields=["last_job", "updated_at"])
        dispatch_or_execute_local(job)
        item.refresh_from_db(fields=["status", "last_job", "updated_at"])
        return job

    def perform_create(self, serializer):
        item = serializer.save(status=HostingAdvancedItem.Status.PENDING)
        self._queue_apply(item)
        audit_action(
            self.request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=item.account,
            target=item,
            metadata={"advanced_action": "create", "kind": item.kind, "name": item.name},
        )

    def perform_update(self, serializer):
        item = serializer.save(status=HostingAdvancedItem.Status.PENDING)
        self._queue_apply(item)
        audit_action(
            self.request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=item.account,
            target=item,
            metadata={"advanced_action": "update", "kind": item.kind, "name": item.name},
        )

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        account = item.account
        metadata = {"advanced_action": "delete", "kind": item.kind, "name": item.name}
        self._queue_apply(item, delete=True)
        self.perform_destroy(item)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata=metadata)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle")
    def toggle(self, request, pk=None):
        item = self.get_object()
        item.enabled = not item.enabled
        item.status = HostingAdvancedItem.Status.PENDING
        item.save(update_fields=["enabled", "status", "updated_at"])
        self._queue_apply(item)
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_UPDATED,
            account=item.account,
            target=item,
            metadata={"advanced_action": "toggle", "kind": item.kind, "enabled": item.enabled},
        )
        return Response(self.get_serializer(item).data)


class SupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.select_related("account", "requester").prefetch_related("messages__attachments", "messages__author").all()
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAdminOrScopedUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset().filter(account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))
        account_id = self.request.query_params.get("account")
        audience = self.request.query_params.get("audience")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if audience == "resellers":
            queryset = queryset.filter(Q(account__reseller__isnull=False) | Q(requester__hosting_reseller_profile__isnull=False)).distinct()
        elif audience == "clients":
            queryset = queryset.filter(account__reseller__isnull=True).exclude(requester__hosting_reseller_profile__isnull=False)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(
                Q(subject__icontains=search)
                | Q(messages__body__icontains=search)
                | Q(account__primary_domain__icontains=search)
                | Q(account__username__icontains=search)
                | Q(account__customer_name__icontains=search)
                | Q(account__customer_email__icontains=search)
                | Q(requester__username__icontains=search)
            ).distinct()
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data
        account_id = data.get("account")
        account_qs = scoped_accounts(HostingAccount.objects.all(), request.user)
        account = account_qs.filter(id=account_id).first() if account_id else account_qs.first()
        if not account:
            return Response({"account": "No hay una cuenta valida para crear el ticket."}, status=status.HTTP_400_BAD_REQUEST)
        subject = str(data.get("subject") or "").strip()
        body = str(data.get("body") or "").strip()
        if len(subject) < 5:
            return Response({"subject": "El asunto debe tener al menos 5 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
        if len(body) < 10:
            return Response({"body": "La descripcion debe tener al menos 10 caracteres."}, status=status.HTTP_400_BAD_REQUEST)
        department = data.get("department") or SupportTicket.Department.TECHNICAL
        priority = data.get("priority") or SupportTicket.Priority.MEDIUM
        if department not in dict(SupportTicket.Department.choices):
            return Response({"department": "Departamento no valido."}, status=status.HTTP_400_BAD_REQUEST)
        if priority not in dict(SupportTicket.Priority.choices):
            return Response({"priority": "Prioridad no valida."}, status=status.HTTP_400_BAD_REQUEST)
        files = request.FILES.getlist("attachments")
        attachment_error = validate_ticket_attachments(files)
        if attachment_error:
            return Response({"attachments": attachment_error}, status=status.HTTP_400_BAD_REQUEST)
        ticket = SupportTicket.objects.create(
            account=account,
            requester=request.user,
            subject=subject[:180],
            department=department,
            priority=priority,
            status=SupportTicket.Status.OPEN,
            last_reply_at=timezone.now(),
        )
        message = SupportTicketMessage.objects.create(
            ticket=ticket,
            author=request.user,
            author_type=SupportTicketMessage.AuthorType.CUSTOMER if not request.user.is_staff else SupportTicketMessage.AuthorType.STAFF,
            body=body,
        )
        save_ticket_attachments(message, files, request.user)
        audit_action(request, "support.ticket_created", account=account, target=ticket, metadata={"attachments": len(files)})
        return Response(self.get_serializer(ticket).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reply")
    def reply(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status == SupportTicket.Status.CLOSED:
            return Response({"detail": "No se puede responder un ticket cerrado."}, status=status.HTTP_400_BAD_REQUEST)
        body = str(request.data.get("body") or "").strip()
        if len(body) < 2:
            return Response({"body": "Escribe una respuesta."}, status=status.HTTP_400_BAD_REQUEST)
        files = request.FILES.getlist("attachments")
        attachment_error = validate_ticket_attachments(files)
        if attachment_error:
            return Response({"attachments": attachment_error}, status=status.HTTP_400_BAD_REQUEST)
        author_type = SupportTicketMessage.AuthorType.CUSTOMER
        if request.user.is_staff:
            author_type = SupportTicketMessage.AuthorType.STAFF
        elif ticket.account.reseller_id == request.user.id:
            author_type = SupportTicketMessage.AuthorType.RESELLER
        message = SupportTicketMessage.objects.create(ticket=ticket, author=request.user, author_type=author_type, body=body)
        save_ticket_attachments(message, files, request.user)
        ticket.status = SupportTicket.Status.ANSWERED if author_type in [SupportTicketMessage.AuthorType.RESELLER, SupportTicketMessage.AuthorType.STAFF] else SupportTicket.Status.CUSTOMER_REPLY
        ticket.last_reply_at = timezone.now()
        ticket.save(update_fields=["status", "last_reply_at", "updated_at"])
        audit_action(request, "support.ticket_replied", account=ticket.account, target=ticket, metadata={"attachments": len(files)})
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = SupportTicket.Status.CLOSED
        ticket.closed_at = timezone.now()
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
        audit_action(request, "support.ticket_closed", account=ticket.account, target=ticket)
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        ticket = self.get_object()
        next_status = request.data.get("status")
        if next_status not in dict(SupportTicket.Status.choices):
            return Response({"status": "Estado no valido."}, status=status.HTTP_400_BAD_REQUEST)
        ticket.status = next_status
        ticket.closed_at = timezone.now() if next_status == SupportTicket.Status.CLOSED else None
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
        audit_action(request, "support.ticket_status_changed", account=ticket.account, target=ticket, metadata={"status": next_status})
        return Response(self.get_serializer(ticket).data)


class SupportTicketAttachmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SupportTicketAttachment.objects.select_related("message", "message__ticket", "message__ticket__account").all()
    serializer_class = SupportTicketAttachmentSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        return super().get_queryset().filter(message__ticket__account__in=scoped_accounts(HostingAccount.objects.all(), self.request.user))

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        attachment = self.get_object()
        response = FileResponse(attachment.file.open("rb"), as_attachment=True, filename=attachment.original_name)
        response["Content-Type"] = attachment.content_type or "application/octet-stream"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class GlobalAnnouncementViewSet(viewsets.ModelViewSet):
    queryset = GlobalAnnouncement.objects.select_related("created_by").all()
    serializer_class = GlobalAnnouncementSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        search = self.request.query_params.get("search")
        status_value = self.request.query_params.get("status")
        audience = self.request.query_params.get("audience")
        visible = self.request.query_params.get("visible")

        if not user.is_staff:
            now = timezone.now()
            audiences = [GlobalAnnouncement.Audience.ALL]
            if hasattr(user, "hosting_reseller_profile"):
                audiences.append(GlobalAnnouncement.Audience.RESELLERS)
            else:
                audiences.append(GlobalAnnouncement.Audience.CLIENTS)
            queryset = queryset.filter(audience__in=audiences, status=GlobalAnnouncement.Status.PUBLISHED)
            queryset = queryset.filter(Q(publish_at__isnull=True) | Q(publish_at__lte=now))
            queryset = queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now))
        else:
            if search:
                queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search))
            if status_value:
                queryset = queryset.filter(status=status_value)
            if audience:
                queryset = queryset.filter(audience=audience)
            if visible == "1":
                now = timezone.now()
                queryset = queryset.filter(status=GlobalAnnouncement.Status.PUBLISHED)
                queryset = queryset.filter(Q(publish_at__isnull=True) | Q(publish_at__lte=now))
                queryset = queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now))
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class HostingDomainViewSet(viewsets.ModelViewSet):
    queryset = HostingDomain.objects.select_related("account", "account__node", "account__plan").all()
    serializer_class = HostingDomainSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if status_value == "dns_failed":
            queryset = queryset.filter(dns_status=HostingDomain.Status.FAILED)
        elif status_value == "ssl_failed":
            queryset = queryset.filter(ssl_status=HostingDomain.Status.FAILED)
        if search:
            queryset = queryset.filter(domain__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CreateDomainSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        hosting_domain = create_domain(
            serializer.validated_data["account"],
            serializer.validated_data["domain"],
            str(serializer.validated_data.get("public_ip") or ""),
            serializer.validated_data.get("domain_type"),
            serializer.validated_data.get("document_root", ""),
        )
        return Response(HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        hosting_domain = self.get_object()
        if hosting_domain.is_primary:
            return Response({"detail": "No se puede eliminar el dominio principal de la cuenta."}, status=status.HTTP_400_BAD_REQUEST)

        account = hosting_domain.account
        domain_label = hosting_domain.domain
        parent_domain = None
        parent_record_name = ""
        parent_record_type = ""

        if hosting_domain.domain_type == HostingDomain.DomainType.SUBDOMAIN and hosting_domain.domain.endswith("." + account.primary_domain):
            parent_domain = account.domains.filter(is_primary=True).first() or account.domains.filter(domain=account.primary_domain).first()
            label = hosting_domain.domain[: -(len(account.primary_domain) + 1)]
            if parent_domain:
                parent_record = parent_domain.records.filter(name=label, record_type=HostingDNSRecord.RecordType.A).first()
                if parent_record:
                    parent_record_name = parent_record.name
                    parent_record_type = parent_record.record_type
                    parent_record.delete()

        self.perform_destroy(hosting_domain)

        if parent_domain and parent_record_name and parent_record_type:
            sync_domain_dns(parent_domain, delete_records=[{"name": parent_record_name, "type": parent_record_type}])

        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=account, metadata={"domain_action": "delete", "domain": domain_label})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="sync-dns")
    def sync_dns(self, request, pk=None):
        hosting_domain = self.get_object()
        serializer = SyncDomainDNSSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sync_domain_dns(
            hosting_domain,
            str(serializer.validated_data.get("public_ip") or ""),
            apply_template=True,
        )
        return Response(HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="dns-template-preview")
    def dns_template_preview(self, request, pk=None):
        hosting_domain = self.get_object()
        return Response(
            {
                "domain": hosting_domain.domain,
                "records": dns_template_records_preview(hosting_domain),
            }
        )

    @action(detail=True, methods=["post"], url_path="apply-dns-template")
    def apply_dns_template(self, request, pk=None):
        hosting_domain = self.get_object()
        overwrite_records = request.data.get("overwrite_records", [])
        if not isinstance(overwrite_records, list):
            return Response({"detail": "overwrite_records debe ser una lista."}, status=status.HTTP_400_BAD_REQUEST)
        job = sync_domain_dns(
            hosting_domain,
            apply_template=True,
            overwrite_template_records=overwrite_records,
        )
        return Response(
            {
                "status": "queued",
                "job": str(job.id),
                "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
                "preview": dns_template_records_preview(hosting_domain),
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="issue-ssl")
    def issue_ssl(self, request, pk=None):
        hosting_domain = self.get_object()
        serializer = IssueDomainSSLSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issue_domain_ssl(
            hosting_domain,
            serializer.validated_data.get("email", ""),
            serializer.validated_data["include_www"],
            serializer.validated_data["staging"],
            serializer.validated_data["force_renewal"],
        )
        return Response(HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="activate-webmail")
    def activate_webmail(self, request, pk=None):
        hosting_domain = self.get_object()
        serializer = ActivateDomainWebmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        jobs = configure_domain_webmail(
            hosting_domain,
            email=serializer.validated_data.get("email", ""),
            sync_dns=serializer.validated_data["sync_dns"],
            issue_ssl_certificate=serializer.validated_data["issue_ssl"],
            force_renewal=serializer.validated_data["force_renewal"],
            staging=serializer.validated_data["staging"],
        )
        return Response(
            {
                "status": "queued",
                "webmail_url": f"https://webmail.{hosting_domain.domain}",
                "jobs": {key: str(job.id) for key, job in jobs.items() if job},
                "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="download-ssl")
    def download_ssl(self, _request, pk=None):
        hosting_domain = self.get_object()
        if not hosting_domain.ssl_cert_path:
            return Response({"detail": "Este dominio no tiene un certificado publico registrado para descargar."}, status=status.HTTP_404_NOT_FOUND)
        try:
            with open(hosting_domain.ssl_cert_path, "r", encoding="utf-8") as certificate_file:
                content = certificate_file.read()
        except OSError:
            return Response({"detail": "El certificado no esta disponible localmente en el panel."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"filename": f"{hosting_domain.domain}.fullchain.pem", "content": content})

    @action(detail=True, methods=["post"], url_path="delete-ssl")
    def delete_ssl(self, request, pk=None):
        hosting_domain = self.get_object()
        hosting_domain.ssl_status = HostingDomain.Status.PENDING
        hosting_domain.ssl_issuer = ""
        hosting_domain.ssl_expires_at = None
        hosting_domain.ssl_domains = []
        hosting_domain.ssl_cert_path = ""
        hosting_domain.ssl_privkey_path = ""
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
        audit_action(request, "ssl.delete", hosting_domain.account, hosting_domain, {"domain": hosting_domain.domain})
        return Response(HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get", "patch"], url_path="web-protection")
    def web_protection(self, request, pk=None):
        hosting_domain = self.get_object()
        current = hosting_domain.web_protection or {}
        if request.method == "GET":
            return Response(
                {
                    "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
                    "settings": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data["web_protection"],
                    "status": hosting_domain.web_protection_status,
                    "error": hosting_domain.web_protection_error,
                    "ai_diagnostics": web_protection_ai_mock(hosting_domain),
                }
            )

        serializer = WebProtectionSerializer(data=request.data, context={"current": current})
        serializer.is_valid(raise_exception=True)
        settings = serializer.validated_data
        hosting_domain.web_protection = settings
        hosting_domain.web_protection_status = HostingDomain.Status.PENDING
        hosting_domain.web_protection_error = ""
        hosting_domain.save(update_fields=["web_protection", "web_protection_status", "web_protection_error", "updated_at"])
        job = queue_web_protection_apply(hosting_domain, settings)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=hosting_domain.account, target=hosting_domain, metadata={"web_protection": settings, "job": str(job.id) if job else ""})
        return Response(
            {
                "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
                "settings": settings,
                "status": hosting_domain.web_protection_status,
                "job": str(job.id) if job else None,
                "ai_diagnostics": web_protection_ai_mock(hosting_domain),
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get", "patch"], url_path="waf")
    def waf(self, request, pk=None):
        hosting_domain = self.get_object()
        config, _created = HostingWafConfiguration.objects.get_or_create(domain=hosting_domain)
        if request.method == "GET":
            recent_events = collect_waf_events(hosting_domain)
            return Response(
                {
                    "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
                    "configuration": HostingWafConfigurationSerializer(config, context=self.get_serializer_context()).data,
                    "recent_events": recent_events,
                }
            )

        serializer = HostingWafConfigurationSerializer(config, data=request.data, partial=True, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        config = serializer.save(status=HostingWafConfiguration.Status.PENDING, error="")
        job = queue_waf_apply(hosting_domain, config)
        audit_action(request, AuditLog.Action.ACCOUNT_UPDATED, account=hosting_domain.account, target=hosting_domain, metadata={"waf": serializer.validated_data, "job": str(job.id) if job else ""})
        return Response(
            {
                "domain": HostingDomainSerializer(hosting_domain, context=self.get_serializer_context()).data,
                "configuration": HostingWafConfigurationSerializer(config, context=self.get_serializer_context()).data,
                "recent_events": collect_waf_events(hosting_domain),
                "job": str(job.id) if job else None,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class HostingDNSRecordViewSet(viewsets.ModelViewSet):
    queryset = HostingDNSRecord.objects.select_related("domain", "domain__account", "domain__account__node").all()
    serializer_class = HostingDNSRecordSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(domain__account__in=allowed_accounts)
        domain_id = self.request.query_params.get("domain")
        record_type = self.request.query_params.get("type")
        search = self.request.query_params.get("search")
        if domain_id:
            queryset = queryset.filter(domain_id=domain_id)
        if record_type:
            queryset = queryset.filter(record_type=record_type.upper())
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = HostingDNSRecordSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        sync_domain_dns(record.domain)
        return Response(HostingDNSRecordSerializer(record, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        record = self.get_object()
        old_identity = {"name": record.name, "type": record.record_type}
        serializer = HostingDNSRecordSerializer(record, data=request.data, partial=partial, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        record = serializer.save()
        delete_records = []
        if old_identity["name"] != record.name or old_identity["type"] != record.record_type:
            delete_records.append(old_identity)
        sync_domain_dns(record.domain, delete_records=delete_records)
        return Response(HostingDNSRecordSerializer(record, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        record = self.get_object()
        hosting_domain = record.domain
        delete_records = [{"name": record.name, "type": record.record_type}]
        record.delete()
        sync_domain_dns(hosting_domain, delete_records=delete_records)
        return Response(status=status.HTTP_204_NO_CONTENT)


class HostingDatabaseViewSet(viewsets.ModelViewSet):
    queryset = HostingDatabase.objects.select_related("account", "account__node", "account__plan").prefetch_related("grants__user").all()
    serializer_class = HostingDatabaseSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        engine = self.request.query_params.get("engine")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if engine:
            queryset = queryset.filter(engine=engine)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CreateDatabaseSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        database = create_database_with_user(
            serializer.validated_data["account"],
            serializer.validated_data["engine"],
            serializer.validated_data["name"],
            serializer.validated_data["user_mode"],
            serializer.validated_data.get("database_user"),
            serializer.validated_data.get("username", ""),
            serializer.validated_data.get("password", ""),
            serializer.validated_data.get("access"),
        )
        return Response(HostingDatabaseSerializer(database, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        database = self.get_object()
        delete_database(database)
        return Response(HostingDatabaseSerializer(database, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, pk=None):
        database = self.get_object()
        serializer = ChangeDatabasePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        change_database_password(database, serializer.validated_data["password"])
        return Response(HostingDatabaseSerializer(database, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="refresh-size")
    def refresh_size(self, _request, pk=None):
        database = self.get_object()
        collect_database_size(database)
        return Response(HostingDatabaseSerializer(database, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="manager-url")
    def manager_url(self, request, pk=None):
        database = self.get_object()
        manager = "phpmyadmin" if database.engine == HostingDatabase.Engine.MARIADB else "adminer"
        try:
            url = create_database_sso(database, manager, request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"manager": manager, "url": url, "database": database.name, "username": database.username, "sso": True})

    @action(detail=True, methods=["post"], url_path="clone")
    def clone(self, request, pk=None):
        database = self.get_object()
        serializer = DatabaseCloneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clone = clone_database(database, serializer.validated_data["name"])
        return Response(HostingDatabaseSerializer(clone, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="check-repair")
    def check_repair(self, request, pk=None):
        database = self.get_object()
        job = check_repair_database(database)
        return Response({"status": "queued", "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="export")
    def export(self, request, pk=None):
        database = self.get_object()
        job = export_database(database)
        return Response({"status": "queued", "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="import")
    def import_dump(self, request, pk=None):
        database = self.get_object()
        serializer = DatabaseImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = import_database(database, serializer.validated_data["path"])
        return Response({"status": "queued", "job": str(job.id)}, status=status.HTTP_202_ACCEPTED)


class HostingDatabaseUserViewSet(viewsets.ModelViewSet):
    queryset = HostingDatabaseUser.objects.select_related("account", "account__node").prefetch_related("grants__database").all()
    serializer_class = HostingDatabaseUserSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        engine = self.request.query_params.get("engine")
        search = self.request.query_params.get("search")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        if engine:
            queryset = queryset.filter(engine=engine)
        if search:
            queryset = queryset.filter(username__icontains=search)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CreateDatabaseUserSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        user = create_database_user(
            serializer.validated_data["account"],
            serializer.validated_data["engine"],
            serializer.validated_data["username"],
            serializer.validated_data["password"],
            serializer.validated_data.get("database"),
            serializer.validated_data.get("access"),
        )
        return Response(HostingDatabaseUserSerializer(user, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = UpdateDatabaseUserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_database_user(user, serializer.validated_data.get("password", ""), serializer.validated_data.get("access"))
        return Response(HostingDatabaseUserSerializer(user, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        grants = list(user.grants.select_related("database").all())
        force = request.query_params.get("force") == "true" or request.data.get("force") is True
        if grants and not force:
            return Response(
                {
                    "detail": "Este usuario tiene bases de datos asignadas. Eliminarlo puede dejar aplicaciones sin acceso.",
                    "requires_confirmation": True,
                    "databases": [{"id": grant.database_id, "name": grant.database.name} for grant in grants],
                },
                status=status.HTTP_409_CONFLICT,
            )
        delete_database_user(user)
        return Response(HostingDatabaseUserSerializer(user, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)


class DatabaseSsoConsumeView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-EHPanel-SSO-Secret", "")
        if not secret or not hmac.compare_digest(secret, settings.DBTOOLS_SSO_SECRET):
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
        serializer = DatabaseSsoConsumeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = consume_database_sso(serializer.validated_data["token"], serializer.validated_data["manager"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class WebmailSsoConsumeView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get("X-EHPanel-SSO-Secret", "")
        expected = getattr(settings, "WEBMAIL_SSO_SECRET", settings.DBTOOLS_SSO_SECRET)
        if not secret or not hmac.compare_digest(secret, expected):
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
        serializer = MailboxSsoConsumeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = consume_webmail_sso(serializer.validated_data["token"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class MailAutoconfigView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = (request.GET.get("emailaddress") or request.GET.get("email") or "").strip().lower()
        domain = mail_config_domain(request, email)
        if not domain:
            return Response({"detail": "Dominio no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        content = thunderbird_autoconfig_xml(domain, email or f"usuario@{domain}")
        return HttpResponse(content, content_type="application/xml")


class MailAutodiscoverView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = (request.GET.get("email") or request.GET.get("emailaddress") or "").strip().lower()
        domain = mail_config_domain(request, email)
        if not domain:
            return Response({"detail": "Dominio no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(outlook_autodiscover_xml(domain, email or f"usuario@{domain}"), content_type="application/xml")

    def post(self, request):
        raw = request.body.decode(errors="ignore")
        email = extract_email_from_autodiscover(raw)
        domain = mail_config_domain(request, email)
        if not domain:
            return Response({"detail": "Dominio no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(outlook_autodiscover_xml(domain, email or f"usuario@{domain}"), content_type="application/xml")


class MailMobileconfigView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = (request.GET.get("email") or request.GET.get("emailaddress") or "").strip().lower()
        domain = mail_config_domain(request, email)
        if not domain or "@" not in email:
            return Response({"detail": "Correo no encontrado."}, status=status.HTTP_404_NOT_FOUND)
        payload = ios_mobileconfig(domain, email)
        response = HttpResponse(payload, content_type="application/x-apple-aspen-config")
        response["Content-Disposition"] = f'attachment; filename="{email.replace("@", "-")}.mobileconfig"'
        return response


def mail_config_domain(request, email=""):
    if "@" in email:
        candidate = email.rsplit("@", 1)[1].strip().lower().strip(".")
        if hosting_domain_exists(candidate):
            return candidate
    host = (request.headers.get("X-EHPanel-Mail-Config-Host") or request.get_host() or "").split(":", 1)[0].lower().strip(".")
    for prefix in ["autoconfig.", "autodiscover.", "mail."]:
        if host.startswith(prefix):
            host = host[len(prefix) :]
            break
    if hosting_domain_exists(host):
        return host
    return ""


def hosting_domain_exists(domain):
    return HostingDomain.objects.filter(domain=domain).exists() or HostingAccount.objects.filter(primary_domain=domain).exists()


def extract_email_from_autodiscover(raw):
    marker = "<EMailAddress>"
    end_marker = "</EMailAddress>"
    start = raw.find(marker)
    if start == -1:
        return ""
    start += len(marker)
    end = raw.find(end_marker, start)
    if end == -1:
        return ""
    return raw[start:end].strip().lower()


def thunderbird_autoconfig_xml(domain, email):
    mail_host = f"mail.{domain}"
    display_domain = escape(domain)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="{display_domain}">
    <domain>{display_domain}</domain>
    <displayName>{display_domain}</displayName>
    <displayShortName>{display_domain}</displayShortName>
    <incomingServer type="imap">
      <hostname>{escape(mail_host)}</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <incomingServer type="pop3">
      <hostname>{escape(mail_host)}</hostname>
      <port>995</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>{escape(mail_host)}</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>
"""


def outlook_autodiscover_xml(domain, email):
    mail_host = f"mail.{domain}"
    return f"""<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <AccountType>email</AccountType>
      <Action>settings</Action>
      <Protocol>
        <Type>IMAP</Type>
        <Server>{escape(mail_host)}</Server>
        <Port>993</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>{escape(email)}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>{escape(mail_host)}</Server>
        <Port>587</Port>
        <DomainRequired>off</DomainRequired>
        <LoginName>{escape(email)}</LoginName>
        <SPA>off</SPA>
        <SSL>on</SSL>
        <AuthRequired>on</AuthRequired>
        <UsePOPAuth>off</UsePOPAuth>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>
"""


def ios_mobileconfig(domain, email):
    mail_host = f"mail.{domain}"
    account_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ehpanel-mail-{email}")).upper()
    profile_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ehpanel-profile-{email}")).upper()
    payload = {
        "PayloadContent": [
            {
                "EmailAccountDescription": f"Correo {email}",
                "EmailAccountName": email,
                "EmailAccountType": "EmailTypeIMAP",
                "EmailAddress": email,
                "IncomingMailServerAuthentication": "EmailAuthPassword",
                "IncomingMailServerHostName": mail_host,
                "IncomingMailServerPortNumber": 993,
                "IncomingMailServerUseSSL": True,
                "IncomingMailServerUsername": email,
                "OutgoingMailServerAuthentication": "EmailAuthPassword",
                "OutgoingMailServerHostName": mail_host,
                "OutgoingMailServerPortNumber": 587,
                "OutgoingMailServerUseSSL": True,
                "OutgoingMailServerUsername": email,
                "OutgoingPasswordSameAsIncomingPassword": True,
                "PayloadDescription": f"Configura la cuenta de correo {email}.",
                "PayloadDisplayName": f"Correo {email}",
                "PayloadIdentifier": f"com.ehpanel.mail.{email}",
                "PayloadType": "com.apple.mail.managed",
                "PayloadUUID": account_uuid,
                "PayloadVersion": 1,
                "SMIMEEnabled": False,
            }
        ],
        "PayloadDescription": f"Perfil de correo para {email}.",
        "PayloadDisplayName": f"Correo {email}",
        "PayloadIdentifier": f"com.ehpanel.profile.mail.{email}",
        "PayloadOrganization": "EHPanel",
        "PayloadRemovalDisallowed": False,
        "PayloadType": "Configuration",
        "PayloadUUID": profile_uuid,
        "PayloadVersion": 1,
    }
    return plistlib.dumps(payload, fmt=plistlib.FMT_XML, sort_keys=False)


class HostingApplicationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = HostingApplication.objects.select_related("account", "account__node", "domain", "last_job").all()
    serializer_class = HostingApplicationSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        app_type = self.request.query_params.get("type")
        domain_id = self.request.query_params.get("domain")
        if app_type:
            queryset = queryset.filter(app_type=app_type)
        if domain_id:
            queryset = queryset.filter(domain_id=domain_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="catalog")
    def catalog(self, _request):
        return Response({"apps": app_catalog()})

    @action(detail=False, methods=["post"], url_path="install-suggestions")
    def install_suggestions(self, request):
        serializer = AppInstallSuggestionSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        return Response(app_install_suggestions(
            serializer.validated_data["domain"],
            serializer.validated_data["runtime"],
            serializer.validated_data.get("name", ""),
        ))

    @action(detail=False, methods=["post"], url_path="install")
    def install(self, request):
        serializer = InstallCatalogAppSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = install_catalog_app(
            serializer.validated_data["runtime"],
            serializer.validated_data["domain"],
            serializer.validated_data,
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="detect")
    def detect(self, request):
        account_id = request.data.get("account")
        if account_id:
            account = scoped_accounts(HostingAccount.objects.prefetch_related("domains"), request.user).filter(id=account_id).first()
            if not account:
                return Response({"detail": "No tienes acceso a esta cuenta hosting."}, status=status.HTTP_404_NOT_FOUND)
            apps = detect_account_apps(account)
        else:
            apps = detect_all_apps_for_user(request.user)
        return Response({"results": HostingApplicationSerializer(apps, many=True, context=self.get_serializer_context()).data})

    @action(detail=False, methods=["post"], url_path="wordpress")
    def wordpress(self, request):
        serializer = InstallWordPressSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = install_wordpress(
            serializer.validated_data["domain"],
            serializer.validated_data.get("site_title", ""),
            serializer.validated_data["db_name"],
            serializer.validated_data["db_user"],
            serializer.validated_data["db_password"],
            serializer.validated_data["admin_user"],
            serializer.validated_data["admin_password"],
            serializer.validated_data["admin_email"],
            serializer.validated_data["table_prefix"],
            serializer.validated_data["force"],
            serializer.validated_data.get("language", "es_ES"),
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="python")
    def python(self, request):
        serializer = DeployPythonAppSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = deploy_python_app(
            serializer.validated_data["domain"],
            serializer.validated_data["name"],
            serializer.validated_data["instance_id"],
            serializer.validated_data["port"],
            serializer.validated_data["working_dir"],
            serializer.validated_data["wsgi_module"],
            serializer.validated_data["workers"],
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="nodejs")
    def nodejs(self, request):
        serializer = DeployNodeAppSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = deploy_node_app(
            serializer.validated_data["domain"],
            serializer.validated_data["name"],
            serializer.validated_data["instance_id"],
            serializer.validated_data["port"],
            serializer.validated_data["working_dir"],
            serializer.validated_data["script"],
            serializer.validated_data.get("node_version", ""),
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="django")
    def django(self, request):
        serializer = DeployDjangoAppSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = deploy_django_app(
            serializer.validated_data["domain"],
            serializer.validated_data["name"],
            serializer.validated_data["instance_id"],
            serializer.validated_data["port"],
            serializer.validated_data["working_dir"],
            serializer.validated_data["project_module"],
            serializer.validated_data.get("django_version", ""),
            serializer.validated_data["workers"],
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=["post"], url_path="laravel")
    def laravel(self, request):
        serializer = DeployLaravelAppSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        app = deploy_laravel_app(
            serializer.validated_data["domain"],
            serializer.validated_data["name"],
            serializer.validated_data["instance_id"],
            serializer.validated_data["port"],
            serializer.validated_data["working_dir"],
            serializer.validated_data.get("php_version", ""),
        )
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    def _queue_lifecycle_action(self, action_name):
        app = self.get_object()
        queue_app_action(app, action_name)
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, _request, pk=None):
        return self._queue_lifecycle_action("start")

    @action(detail=True, methods=["post"], url_path="stop")
    def stop(self, _request, pk=None):
        return self._queue_lifecycle_action("stop")

    @action(detail=True, methods=["post"], url_path="restart")
    def restart(self, _request, pk=None):
        return self._queue_lifecycle_action("restart")

    @action(detail=True, methods=["post"], url_path="update")
    def update_wordpress(self, _request, pk=None):
        app = self.get_object()
        if app.app_type != HostingApplication.AppType.WORDPRESS:
            return Response({"detail": "Esta accion solo aplica a WordPress."}, status=status.HTTP_400_BAD_REQUEST)
        queue_wordpress_update(app)
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="check-updates")
    def check_updates(self, _request, pk=None):
        app = self.get_object()
        queue_app_update_check(app)
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["post"], url_path="backup")
    def backup(self, _request, pk=None):
        app = self.get_object()
        backup = queue_app_backup(app)
        return Response(HostingApplicationBackupSerializer(backup, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="backups")
    def backups(self, _request, pk=None):
        app = self.get_object()
        backups = app.backups.select_related("app", "app__domain").all()
        return Response(HostingApplicationBackupSerializer(backups, many=True, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get", "post"], url_path="wordpress-toolkit")
    def wordpress_toolkit(self, request, pk=None):
        app = self.get_object()
        if app.app_type != HostingApplication.AppType.WORDPRESS:
            return Response({"detail": "Esta accion solo aplica a WordPress."}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            job = run_wordpress_toolkit(app)
            if job.status == AgentJob.Status.FAILED:
                return Response({"detail": job.error_detail or job.error_code or "No se pudo consultar WordPress.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

        action_name = str(request.data.get("action") or "summary")
        allowed = {
            "summary",
            "maintenance_on",
            "maintenance_off",
            "cache_flush",
            "set_indexing",
            "set_wp_cron",
            "set_debug",
            "repair_filesystem",
            "plugin_activate",
            "plugin_deactivate",
            "plugin_update",
            "theme_activate",
            "theme_update",
            "integrity_check",
            "search",
        }
        if action_name not in allowed:
            return Response({"detail": "Accion WordPress no soportada."}, status=status.HTTP_400_BAD_REQUEST)
        job = run_wordpress_toolkit(
            app,
            action=action_name,
            target_type=str(request.data.get("target_type") or ""),
            target=str(request.data.get("target") or ""),
            value=str(request.data.get("value") or ""),
            timeout=20,
        )
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo ejecutar la accion.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

    @action(detail=True, methods=["post"], url_path="wordpress-autologin")
    def wordpress_autologin(self, request, pk=None):
        app = self.get_object()
        if app.app_type != HostingApplication.AppType.WORDPRESS:
            return Response({"detail": "Esta accion solo aplica a WordPress."}, status=status.HTTP_400_BAD_REQUEST)
        target = str(request.data.get("user") or "").strip()
        job = run_wordpress_autologin(app, target=target, timeout=20)
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo generar el acceso temporal.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        result = job.result or {}
        login_url = result.get("login_url")
        if not login_url:
            return Response({"detail": "El agente no devolvio una URL de acceso temporal.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "job": str(job.id),
            "status": job.status,
            "login_url": login_url,
            "login_user": result.get("login_user", ""),
            "expires_at": result.get("expires_at", ""),
        })

    @action(detail=True, methods=["get", "post"], url_path="python-tool")
    def python_tool(self, request, pk=None):
        app = self.get_object()
        if app.app_type not in [HostingApplication.AppType.PYTHON, HostingApplication.AppType.DJANGO]:
            return Response({"detail": "Esta accion solo aplica a Python/Django."}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            job = run_python_toolkit(app)
            if job.status == AgentJob.Status.FAILED:
                return Response({"detail": job.error_detail or job.error_code or "No se pudo consultar Python/Django.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

        action_name = str(request.data.get("action") or "summary")
        allowed = {
            "summary",
            "check_deploy",
            "migrate",
            "collectstatic",
            "reinstall_requirements",
            "clear_sessions",
            "restart_service",
            "git_save",
            "git_pull",
            "valkey_ping",
        }
        if action_name not in allowed:
            return Response({"detail": "Accion Python/Django no soportada."}, status=status.HTTP_400_BAD_REQUEST)
        repo_url = str(request.data.get("repo_url") or "").strip()
        branch = str(request.data.get("branch") or "").strip() or "main"
        if action_name == "git_save":
            metadata = app.metadata or {}
            app.metadata = {**metadata, "git": {"repo_url": repo_url, "branch": branch, "strategy": "deploy_key"}}
            app.save(update_fields=["metadata", "updated_at"])
            return Response({"job": "", "status": "saved", "result": app.metadata.get("python_toolkit") or {}})

        job = run_python_toolkit(app, action=action_name, repo_url=repo_url, branch=branch, timeout=30)
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo ejecutar la accion.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

    @action(detail=True, methods=["get", "post"], url_path="node-tool")
    def node_tool(self, request, pk=None):
        app = self.get_object()
        if app.app_type != HostingApplication.AppType.NODEJS:
            return Response({"detail": "Esta accion solo aplica a Node.js."}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            job = run_node_toolkit(app)
            if job.status == AgentJob.Status.FAILED:
                return Response({"detail": job.error_detail or job.error_code or "No se pudo consultar Node.js.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

        action_name = str(request.data.get("action") or "summary")
        allowed = {
            "summary",
            "install_dependencies",
            "build",
            "audit",
            "restart_service",
            "git_save",
            "git_pull",
            "valkey_ping",
        }
        if action_name not in allowed:
            return Response({"detail": "Accion Node.js no soportada."}, status=status.HTTP_400_BAD_REQUEST)
        repo_url = str(request.data.get("repo_url") or "").strip()
        branch = str(request.data.get("branch") or "").strip() or "main"
        if action_name == "git_save":
            metadata = app.metadata or {}
            app.metadata = {**metadata, "git": {"repo_url": repo_url, "branch": branch, "strategy": "deploy_key"}}
            app.save(update_fields=["metadata", "updated_at"])
            return Response({"job": "", "status": "saved", "result": app.metadata.get("node_toolkit") or {}})

        job = run_node_toolkit(app, action=action_name, repo_url=repo_url, branch=branch, timeout=30)
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo ejecutar la accion.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

    @action(detail=True, methods=["get", "post"], url_path="laravel-tool")
    def laravel_tool(self, request, pk=None):
        app = self.get_object()
        if app.app_type != HostingApplication.AppType.LARAVEL:
            return Response({"detail": "Esta accion solo aplica a Laravel."}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            job = run_laravel_toolkit(app)
            if job.status == AgentJob.Status.FAILED:
                return Response({"detail": job.error_detail or job.error_code or "No se pudo consultar Laravel.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

        action_name = str(request.data.get("action") or "summary")
        allowed = {
            "summary",
            "composer_install",
            "composer_update",
            "composer_audit",
            "migrate",
            "storage_link",
            "optimize",
            "cache_clear",
            "key_generate",
            "restart_service",
            "git_save",
            "git_pull",
            "valkey_ping",
        }
        if action_name not in allowed:
            return Response({"detail": "Accion Laravel no soportada."}, status=status.HTTP_400_BAD_REQUEST)
        repo_url = str(request.data.get("repo_url") or "").strip()
        branch = str(request.data.get("branch") or "").strip() or "main"
        if action_name == "git_save":
            metadata = app.metadata or {}
            app.metadata = {**metadata, "git": {"repo_url": repo_url, "branch": branch, "strategy": "deploy_key"}}
            app.save(update_fields=["metadata", "updated_at"])
            return Response({"job": "", "status": "saved", "result": app.metadata.get("laravel_toolkit") or {}})

        job = run_laravel_toolkit(app, action=action_name, repo_url=repo_url, branch=branch, timeout=30)
        if job.status == AgentJob.Status.FAILED:
            return Response({"detail": job.error_detail or job.error_code or "No se pudo ejecutar la accion.", "job": str(job.id)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"job": str(job.id), "status": job.status, "result": job.result or {}})

    @action(detail=False, methods=["get"], url_path="backups")
    def all_backups(self, request):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), request.user)
        backups = HostingApplicationBackup.objects.select_related("app", "app__domain").filter(app__account__in=allowed_accounts)
        return Response(HostingApplicationBackupSerializer(backups, many=True, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        app = self.get_object()
        delete_files = request.data.get("delete_files", True) if hasattr(request, "data") else True
        if app.app_type == HostingApplication.AppType.WORDPRESS:
            delete_database = request.data.get("delete_database", True) if hasattr(request, "data") else True
            queue_wordpress_delete(app, delete_files=delete_files, delete_database=delete_database)
        else:
            queue_app_delete(app, delete_files=delete_files)
        return Response(HostingApplicationSerializer(app, context=self.get_serializer_context()).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        app = self.get_object()
        limit = int(request.query_params.get("limit", 120))
        return Response({"lines": collect_app_logs(app, limit)})


class ProvisioningRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProvisioningRun.objects.select_related("account", "account__node").prefetch_related("steps__job")
    serializer_class = ProvisioningRunSerializer
    permission_classes = [IsAdminOrScopedUser]

    def get_queryset(self):
        allowed_accounts = scoped_accounts(HostingAccount.objects.all(), self.request.user)
        queryset = super().get_queryset().filter(account__in=allowed_accounts)
        account_id = self.request.query_params.get("account")
        if account_id:
            queryset = queryset.filter(account_id=account_id)
        return queryset

    @action(detail=True, methods=["post"], url_path="sync")
    def sync(self, request, pk=None):
        run = self.get_object()
        run.sync_from_jobs()
        audit_action(
            request,
            AuditLog.Action.ACCOUNT_SYNCED,
            account=run.account,
            target=run,
            metadata={"run": str(run.id), "status": run.status},
        )
        return Response(ProvisioningRunSerializer(run, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="retry-step")
    def retry_step(self, request, pk=None):
        run = self.get_object()
        step_id = request.data.get("step_id")
        step = run.steps.select_related("job", "run__account").filter(id=step_id).first()
        if not step:
            return Response({"detail": "Paso no encontrado en este proceso."}, status=status.HTTP_404_NOT_FOUND)
        old_job = step.job
        new_job = retry_provisioning_step(step)
        if new_job is None:
            return Response(
                {"detail": "Solo se pueden reintentar pasos fallidos, cancelados o expirados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        audit_action(
            request,
            AuditLog.Action.PROVISIONING_STEP_RETRIED,
            account=run.account,
            target=step,
            metadata={
                "run": str(run.id),
                "step": step.name,
                "old_job": str(old_job.id),
                "new_job": str(new_job.id),
            },
        )
        run = self.get_queryset().get(pk=run.pk)
        return Response(
            {
                "old_job": str(old_job.id),
                "new_job": str(new_job.id),
                "run": ProvisioningRunSerializer(run, context=self.get_serializer_context()).data,
            },
            status=status.HTTP_202_ACCEPTED,
        )
