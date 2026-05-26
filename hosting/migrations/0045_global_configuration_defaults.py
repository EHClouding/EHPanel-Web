from django.db import migrations


GLOBAL_SETTINGS = {
    "auto_ssl": "Automatico",
    "backup_policy": "Politica global",
    "default_language": "Espanol",
    "log_retention": "90 dias",
    "maintenance_mode": "Inactivo",
    "panel_mode": "Produccion",
    "panel_name": "EHPanel Web",
    "primary_domain": "web.ehclouding.com",
    "suspension_policy": "Manual/admin",
    "system_email": "noreply@ehclouding.com",
    "timezone": "America/La_Paz",
    "waf_policy": "Monitoreo 24h",
}


def seed_global_configuration(apps, _schema_editor):
    GlobalConfiguration = apps.get_model("hosting", "GlobalConfiguration")
    config, _created = GlobalConfiguration.objects.get_or_create(key="default")
    policies = dict(config.policies or {})
    existing_settings = policies.get("global_settings") if isinstance(policies.get("global_settings"), dict) else {}
    policies["global_settings"] = {**GLOBAL_SETTINGS, **existing_settings}
    mail_defaults = dict(config.mail_defaults or {})
    mail_defaults.setdefault("system_email", GLOBAL_SETTINGS["system_email"])
    config.policies = policies
    config.mail_defaults = mail_defaults
    config.save(update_fields=["policies", "mail_defaults", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0044_accesssession"),
    ]

    operations = [
        migrations.RunPython(seed_global_configuration, migrations.RunPython.noop),
    ]
