from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0005_agentjob_dkim_choice"),
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
                    ("create_vhost", "Create vhost"),
                    ("delete_vhost", "Delete vhost"),
                    ("create_database", "Create database"),
                    ("create_dns_zone", "Create DNS zone"),
                    ("issue_ssl", "Issue SSL certificate"),
                    ("create_mail_domain", "Create mail domain"),
                    ("create_mailbox", "Create mailbox"),
                    ("change_mailbox_password", "Change mailbox password"),
                    ("suspend_mailbox", "Suspend mailbox"),
                    ("unsuspend_mailbox", "Unsuspend mailbox"),
                    ("delete_mailbox", "Delete mailbox"),
                    ("enable_dkim", "Enable DKIM"),
                    ("service_action", "Service action"),
                ],
                max_length=64,
            ),
        ),
    ]
