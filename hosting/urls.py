from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import ApiKeyCredentialViewSet, BackupPolicyViewSet, BackupRestoreRunViewSet, BackupStorageDestinationViewSet, DatabaseSsoConsumeView, DNSTemplateRecordViewSet, GlobalAnnouncementViewSet, GlobalConfigurationViewSet, GlobalNameserverViewSet, HostingAccountExportViewSet, HostingAccountViewSet, HostingAdvancedItemViewSet, HostingApplicationViewSet, HostingDatabaseUserViewSet, HostingDatabaseViewSet, HostingDNSRecordViewSet, HostingDomainViewSet, HostingFtpUserViewSet, HostingIPBlockViewSet, HostingMailboxViewSet, HostingMonitorAlertRuleViewSet, HostingMonitorCheckViewSet, HostingMonitorIncidentViewSet, HostingPlanViewSet, HostingProtectedDirectoryViewSet, HostingResellerProfileViewSet, HostingSecurityScanViewSet, MigrationAccountViewSet, MigrationLogViewSet, MigrationRunViewSet, MigrationSourceViewSet, ProvisioningRunViewSet, ProvisioningTemplateViewSet, ResellerSecurityViewSet, ResellerSelfViewSet, ResellerTeamMemberViewSet, SupportTicketAttachmentViewSet, SupportTicketViewSet, WebmailSsoConsumeView

router = DefaultRouter()
router.register("plans", HostingPlanViewSet, basename="hosting-plans")
router.register("resellers", HostingResellerProfileViewSet, basename="hosting-resellers")
router.register("reseller-self", ResellerSelfViewSet, basename="hosting-reseller-self")
router.register("reseller-team", ResellerTeamMemberViewSet, basename="hosting-reseller-team")
router.register("reseller-security", ResellerSecurityViewSet, basename="hosting-reseller-security")
router.register("migration-sources", MigrationSourceViewSet, basename="hosting-migration-sources")
router.register("migration-runs", MigrationRunViewSet, basename="hosting-migration-runs")
router.register("migration-accounts", MigrationAccountViewSet, basename="hosting-migration-accounts")
router.register("migration-logs", MigrationLogViewSet, basename="hosting-migration-logs")
router.register("configuration", GlobalConfigurationViewSet, basename="hosting-configuration")
router.register("api-keys", ApiKeyCredentialViewSet, basename="hosting-api-keys")
router.register("accounts", HostingAccountViewSet, basename="hosting-accounts")
router.register("account-exports", HostingAccountExportViewSet, basename="hosting-account-exports")
router.register("backup-policies", BackupPolicyViewSet, basename="hosting-backup-policies")
router.register("backup-storage", BackupStorageDestinationViewSet, basename="hosting-backup-storage")
router.register("backup-restores", BackupRestoreRunViewSet, basename="hosting-backup-restores")
router.register("domains", HostingDomainViewSet, basename="hosting-domains")
router.register("dns-records", HostingDNSRecordViewSet, basename="hosting-dns-records")
router.register("dns-template-records", DNSTemplateRecordViewSet, basename="hosting-dns-template-records")
router.register("global-nameservers", GlobalNameserverViewSet, basename="hosting-global-nameservers")
router.register("databases", HostingDatabaseViewSet, basename="hosting-databases")
router.register("database-users", HostingDatabaseUserViewSet, basename="hosting-database-users")
router.register("mailboxes", HostingMailboxViewSet, basename="hosting-mailboxes")
router.register("ftp-users", HostingFtpUserViewSet, basename="hosting-ftp-users")
router.register("protected-directories", HostingProtectedDirectoryViewSet, basename="hosting-protected-directories")
router.register("ip-blocks", HostingIPBlockViewSet, basename="hosting-ip-blocks")
router.register("security-scans", HostingSecurityScanViewSet, basename="hosting-security-scans")
router.register("monitor-checks", HostingMonitorCheckViewSet, basename="hosting-monitor-checks")
router.register("monitor-incidents", HostingMonitorIncidentViewSet, basename="hosting-monitor-incidents")
router.register("monitor-alerts", HostingMonitorAlertRuleViewSet, basename="hosting-monitor-alerts")
router.register("advanced-items", HostingAdvancedItemViewSet, basename="hosting-advanced-items")
router.register("tickets", SupportTicketViewSet, basename="hosting-tickets")
router.register("ticket-attachments", SupportTicketAttachmentViewSet, basename="hosting-ticket-attachments")
router.register("announcements", GlobalAnnouncementViewSet, basename="hosting-announcements")
router.register("apps", HostingApplicationViewSet, basename="hosting-apps")
router.register("provisioning-runs", ProvisioningRunViewSet, basename="hosting-provisioning-runs")
router.register("provisioning-templates", ProvisioningTemplateViewSet, basename="hosting-provisioning-templates")

urlpatterns = [
    path("dbtools-sso/consume/", DatabaseSsoConsumeView.as_view(), name="hosting-dbtools-sso-consume"),
    path("webmail-sso/consume/", WebmailSsoConsumeView.as_view(), name="hosting-webmail-sso-consume"),
    *router.urls,
]
