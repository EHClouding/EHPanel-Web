from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0004_agentjob_mail_choices"),
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
                    ("enable_dkim", "Enable DKIM"),
                    ("service_action", "Service action"),
                ],
                max_length=64,
            ),
        ),
    ]
