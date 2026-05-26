from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0006_agentjob_mail_admin_choices"),
    ]

    operations = [
        migrations.AlterField(
            model_name="agentjob",
            name="job_type",
            field=models.CharField(
                choices=[
                    ("create_account", "Create account"),
                    ("provision_hosting", "Provision hosting"),
                    ("delete_account", "Delete account"),
                    ("suspend_account", "Suspend account"),
                    ("unsuspend_account", "Unsuspend account"),
                    ("create_domain", "Create domain"),
                    ("delete_domain", "Delete domain"),
                    ("create_php_pool", "Create PHP-FPM pool"),
                    ("create_database", "Create database"),
                    ("create_dns_zone", "Create DNS zone"),
                    ("issue_ssl", "Issue SSL certificate"),
                    ("create_mail_domain", "Create mail domain"),
                    ("create_mailbox", "Create mailbox"),
                    ("change_mailbox_password", "Change mailbox password"),
                    ("suspend_mailbox", "Suspend mailbox"),
                    ("unsuspend_mailbox", "Unsuspend mailbox"),
                    ("delete_mailbox", "Delete mailbox"),
                    ("create_mail_alias", "Create mail alias"),
                    ("delete_mail_alias", "Delete mail alias"),
                    ("set_mailbox_quota", "Set mailbox quota"),
                    ("enable_dkim", "Enable DKIM"),
                    ("service_action", "Service action"),
                ],
                max_length=80,
            ),
        ),
    ]
