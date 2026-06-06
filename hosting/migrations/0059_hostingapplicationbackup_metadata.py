from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hosting", "0058_hostingadvanceditem_secret_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="hostingapplicationbackup",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
