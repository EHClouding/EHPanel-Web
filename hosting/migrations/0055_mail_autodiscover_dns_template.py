from django.db import migrations


RECORDS = [
    {"order": 110, "name": "autodiscover", "record_type": "CNAME", "content": "{mail_host}.", "ttl": 300, "description": "Autodiscover Outlook"},
    {"order": 111, "name": "autoconfig", "record_type": "CNAME", "content": "{mail_host}.", "ttl": 300, "description": "Autoconfig Thunderbird"},
    {"order": 116, "name": "_autodiscover._tcp", "record_type": "SRV", "content": "0 1 443 autodiscover.{domain}.", "ttl": 300, "description": "Autodiscover Outlook SRV"},
]


def seed_records(apps, _schema_editor):
    DNSTemplateRecord = apps.get_model("hosting", "DNSTemplateRecord")
    for record in RECORDS:
        DNSTemplateRecord.objects.update_or_create(
            name=record["name"],
            record_type=record["record_type"],
            defaults={
                "content": record["content"],
                "ttl": record["ttl"],
                "priority": None,
                "order": record["order"],
                "is_active": True,
                "description": record["description"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0054_hostingperformanceaudit"),
    ]

    operations = [
        migrations.RunPython(seed_records, migrations.RunPython.noop),
    ]
