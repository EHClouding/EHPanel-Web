from django.db import migrations


def normalize_existing_plans(apps, schema_editor):
    HostingPlan = apps.get_model("hosting", "HostingPlan")
    for plan in HostingPlan.objects.all():
        changed = False
        versions = list(plan.allowed_php_versions or [])
        for version in ["8.4", "8.5"]:
            if version not in versions:
                versions.append(version)
                changed = True
        features = dict(plan.features or {})
        if not any(key in features for key in ["max_subdomains", "subdomains", "subdomain_limit", "subdomains_limit"]):
            features["max_subdomains"] = "unlimited"
            changed = True
        if changed:
            plan.allowed_php_versions = versions
            plan.features = features
            plan.save(update_fields=["allowed_php_versions", "features", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0052_ensure_webmail_dns_template"),
    ]

    operations = [
        migrations.RunPython(normalize_existing_plans, migrations.RunPython.noop),
    ]
