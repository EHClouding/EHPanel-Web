from django.db import migrations


DEFAULT_INTEGRATIONS = [
    {
        "category": "Billing",
        "endpoint": "",
        "id": "ehpanel-billing",
        "name": "EHPanel Billing",
        "notes": "Sistema de facturacion propio. Pendiente de conectar API.",
        "status": "Pendiente",
        "type": "Aplicacion EHPanel",
    },
    {
        "category": "Correo",
        "endpoint": "https://webmail.ehclouding.com",
        "id": "ehpanel-webmail",
        "name": "EHPanel Webmail",
        "notes": "Servicio webmail del ecosistema EHClouding.",
        "status": "Activo",
        "type": "Aplicacion EHPanel",
    },
    {
        "category": "Almacenamiento",
        "endpoint": "",
        "id": "ehpanel-drive",
        "name": "EHPanel Drive",
        "notes": "Pendiente. Se conectara por API cuando el servicio exista.",
        "status": "Pendiente",
        "type": "Aplicacion EHPanel",
    },
]


def seed_integrations(apps, _schema_editor):
    GlobalConfiguration = apps.get_model("hosting", "GlobalConfiguration")
    config, _created = GlobalConfiguration.objects.get_or_create(key="default")
    policies = dict(config.policies or {})
    existing = policies.get("integrations") if isinstance(policies.get("integrations"), list) else []
    by_id = {item["id"]: item for item in DEFAULT_INTEGRATIONS}
    for item in existing:
        if isinstance(item, dict) and item.get("id"):
            by_id[item["id"]] = {**by_id.get(item["id"], {}), **item}
    policies["integrations"] = list(by_id.values())
    config.policies = policies
    config.save(update_fields=["policies", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0047_default_plans_openlitespeed"),
    ]

    operations = [
        migrations.RunPython(seed_integrations, migrations.RunPython.noop),
    ]
