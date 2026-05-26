from django.db import migrations


def ensure_webmail_template(apps, _schema_editor):
    DNSTemplateRecord = apps.get_model("hosting", "DNSTemplateRecord")
    DNSTemplateRecord.objects.update_or_create(
        name="webmail",
        record_type="A",
        defaults={
            "content": "{ip}",
            "ttl": 300,
            "priority": None,
            "order": 116,
            "is_active": True,
            "description": "Webmail al nodo",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0051_hostingaccount_billing_client_id_and_more"),
    ]

    operations = [
        migrations.RunPython(ensure_webmail_template, migrations.RunPython.noop),
    ]
