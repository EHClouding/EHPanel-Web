from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0018_hostingdomain_domain_type_document_root"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("account.created", "Account created"),
                    ("account.updated", "Account updated"),
                    ("account.password_changed", "Account password changed"),
                    ("account.synced", "Account synced"),
                    ("account.retry_failed", "Account retry failed"),
                    ("provisioning.step_retried", "Provisioning step retried"),
                    ("user.impersonated", "User impersonated"),
                ],
                max_length=80,
            ),
        ),
    ]
