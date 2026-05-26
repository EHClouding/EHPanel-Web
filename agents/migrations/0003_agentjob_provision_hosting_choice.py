from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0002_agentjob"),
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
                    ("service_action", "Service action"),
                ],
                max_length=80,
            ),
        ),
    ]
