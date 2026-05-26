from django.db import migrations


RECORDS = [
    {"order": 116, "name": "webmail", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "Webmail al nodo"},
    {"order": 117, "name": "ipv4", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "Alias IPv4 al nodo"},
    {"order": 118, "name": "server", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "Alias server al nodo"},
    {"order": 119, "name": "ns2", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "IP del nameserver secundario"},
    {"order": 120, "name": "@", "record_type": "NS", "content": "ns2.{domain}.", "ttl": 300, "description": "Nameserver secundario"},
    {"order": 121, "name": "_domainkey", "record_type": "TXT", "content": "o=-", "ttl": 300, "description": "Politica DomainKeys legacy"},
]


def seed_records(apps, _schema_editor):
    DNSTemplateRecord = apps.get_model("hosting", "DNSTemplateRecord")
    for record in RECORDS:
        obj, _created = DNSTemplateRecord.objects.get_or_create(
            name=record["name"],
            record_type=record["record_type"],
            content=record["content"],
            defaults={
                "ttl": record["ttl"],
                "priority": record.get("priority"),
                "order": record["order"],
                "is_active": True,
                "description": record["description"],
            },
        )
        obj.ttl = record["ttl"]
        obj.priority = record.get("priority")
        obj.order = record["order"]
        obj.is_active = True
        obj.description = record["description"]
        obj.save(update_fields=["ttl", "priority", "order", "is_active", "description"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0026_alter_dnstemplaterecord_unique_together_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_records, migrations.RunPython.noop),
    ]
