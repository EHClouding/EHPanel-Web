from django.db import migrations


def backfill_plan_runtime_defaults(apps, schema_editor):
    HostingPlan = apps.get_model("hosting", "HostingPlan")
    default_features = {
        "mail": True,
        "databases": True,
        "dns": True,
        "ssl": True,
        "sftp": True,
        "wordpress": True,
    }
    for plan in HostingPlan.objects.all():
        changed = []
        if not plan.allowed_web_engines:
            plan.allowed_web_engines = ["nginx_apache", "openlitespeed"]
            changed.append("allowed_web_engines")
        if not plan.allowed_php_versions:
            plan.allowed_php_versions = ["8.3", "8.4", "8.5"]
            changed.append("allowed_php_versions")
        if not plan.features:
            plan.features = default_features
            changed.append("features")
        if changed:
            plan.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0016_hostingplan_allowed_php_versions_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_plan_runtime_defaults, migrations.RunPython.noop),
    ]
