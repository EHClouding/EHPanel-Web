from django.db import migrations


RECORDS = [
    {"order": 111, "name": "autoconfig", "record_type": "CNAME", "content": "{mail_host}.", "ttl": 300, "description": "Autoconfig Thunderbird"},
    {"order": 112, "name": "_imaps._tcp", "record_type": "SRV", "content": "0 1 993 {mail_host}.", "ttl": 300, "description": "IMAPS autoconfig"},
    {"order": 113, "name": "_pop3s._tcp", "record_type": "SRV", "content": "0 1 995 {mail_host}.", "ttl": 300, "description": "POP3S autoconfig"},
    {"order": 114, "name": "_submission._tcp", "record_type": "SRV", "content": "0 1 587 {mail_host}.", "ttl": 300, "description": "SMTP submission autoconfig"},
    {"order": 115, "name": "_smtps._tcp", "record_type": "SRV", "content": "0 1 465 {mail_host}.", "ttl": 300, "description": "SMTPS autoconfig"},
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
        ("hosting", "0024_hostingmailbox_antispam_enabled_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_records, migrations.RunPython.noop),
    ]
