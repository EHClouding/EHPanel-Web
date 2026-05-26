from django.db import migrations


WEB_ENGINE = {
    "admin_port": "7080",
    "engine": "OpenLiteSpeed",
    "php_handler": "lsphp",
    "provisioning": "OpenLiteSpeed hosting",
    "public_ports": "80 / 443",
    "service": "lshttpd",
}


def seed_web_engine(apps, _schema_editor):
    GlobalConfiguration = apps.get_model("hosting", "GlobalConfiguration")
    config, _created = GlobalConfiguration.objects.get_or_create(key="default")
    policies = dict(config.policies or {})
    current = policies.get("web_engine") if isinstance(policies.get("web_engine"), dict) else {}
    policies["web_engine"] = {**WEB_ENGINE, **current, "engine": "OpenLiteSpeed", "service": current.get("service") or WEB_ENGINE["service"]}
    config.policies = policies
    config.save(update_fields=["policies", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0045_global_configuration_defaults"),
    ]

    operations = [
        migrations.RunPython(seed_web_engine, migrations.RunPython.noop),
    ]
