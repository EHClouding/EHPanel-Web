# Generated manually for the initial EHPanel Web MVP.

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Node",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("hostname", models.CharField(max_length=255, unique=True)),
                (
                    "agent_type",
                    models.CharField(
                        choices=[("web", "Web"), ("radio", "Radio"), ("video", "Video"), ("srt", "SRT")],
                        default="web",
                        max_length=20,
                    ),
                ),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("online", "Online"),
                            ("offline", "Offline"),
                            ("maintenance", "Maintenance"),
                            ("disabled", "Disabled"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("agent_version", models.CharField(blank=True, max_length=50)),
                ("os_name", models.CharField(blank=True, max_length=120)),
                ("arch", models.CharField(blank=True, max_length=50)),
                ("last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("capabilities", models.JSONField(blank=True, default=dict)),
                ("last_telemetry", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="EnrollmentToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(default="", editable=False, max_length=96, unique=True)),
                ("hostname", models.CharField(max_length=255)),
                (
                    "agent_type",
                    models.CharField(
                        choices=[("web", "Web"), ("radio", "Radio"), ("video", "Video"), ("srt", "SRT")],
                        default="web",
                        max_length=20,
                    ),
                ),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("node", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="agents.node")),
            ],
        ),
        migrations.CreateModel(
            name="AgentEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("msg_type", models.CharField(max_length=80)),
                ("msg_id", models.CharField(blank=True, max_length=80)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("node", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="agents.node")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
