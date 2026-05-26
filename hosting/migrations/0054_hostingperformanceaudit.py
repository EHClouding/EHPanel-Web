from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("agents", "0045_agentjob_run_web_performance_audit"),
        ("hosting", "0053_allow_php85_and_plan_subdomains"),
    ]

    operations = [
        migrations.CreateModel(
            name="HostingPerformanceAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("target_url", models.URLField(max_length=500)),
                ("duration_seconds", models.PositiveIntegerField(default=15)),
                ("samples", models.PositiveIntegerField(default=6)),
                (
                    "status",
                    models.CharField(
                        choices=[("queued", "Queued"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed")],
                        default="queued",
                        max_length=20,
                    ),
                ),
                ("result", models.JSONField(blank=True, default=dict)),
                ("error_code", models.CharField(blank=True, max_length=80)),
                ("error_detail", models.TextField(blank=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="performance_audits", to="hosting.hostingaccount")),
                ("job", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="agents.agentjob")),
                ("requested_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["account", "status"], name="hosting_per_account_b01bfe_idx"),
                    models.Index(fields=["created_at"], name="hosting_per_created_5298f0_idx"),
                ],
            },
        ),
    ]
