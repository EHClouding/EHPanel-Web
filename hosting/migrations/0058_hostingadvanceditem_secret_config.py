from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hosting", "0057_rename_performance_audit_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="hostingadvanceditem",
            name="secret_config",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
