from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0029_agentjob_apply_protected_directories"),
        ("hosting", "0028_hostingdomain_web_protection"),
    ]

    operations = [
        migrations.CreateModel(
            name="HostingProtectedDirectory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(max_length=255)),
                ("zone", models.CharField(max_length=120)),
                ("username", models.SlugField(max_length=64)),
                ("enabled", models.BooleanField(default=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("active", "Active"), ("disabled", "Disabled"), ("failed", "Failed")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("domain", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="protected_directories", to="hosting.hostingdomain")),
                ("last_job", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="agents.agentjob")),
            ],
            options={
                "ordering": ["domain__domain", "path"],
                "unique_together": {("domain", "path")},
            },
        ),
        migrations.AddIndex(
            model_name="hostingprotecteddirectory",
            index=models.Index(fields=["domain", "status"], name="hosting_hos_domain__ba222c_idx"),
        ),
    ]
