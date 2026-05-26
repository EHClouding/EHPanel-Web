from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0028_agentjob_apply_web_protection"),
        ("hosting", "0027_expand_dns_default_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="hostingdomain",
            name="web_protection",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="hostingdomain",
            name="web_protection_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="hostingdomain",
            name="web_protection_last_job",
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, related_name="web_protection_domains", to="agents.agentjob"),
        ),
        migrations.AddField(
            model_name="hostingdomain",
            name="web_protection_status",
            field=models.CharField(choices=[("pending", "Pending"), ("active", "Active"), ("failed", "Failed")], default="pending", max_length=20),
        ),
    ]
