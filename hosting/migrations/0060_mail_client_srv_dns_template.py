from django.db import migrations


RECORDS = [
    {"order": 112, "name": "_imaps._tcp", "record_type": "SRV", "content": "0 1 993 {mail_client_host}.", "ttl": 300, "description": "IMAPS cliente correo"},
    {"order": 113, "name": "_pop3s._tcp", "record_type": "SRV", "content": "0 1 995 {mail_client_host}.", "ttl": 300, "description": "POP3S cliente correo"},
    {"order": 114, "name": "_submission._tcp", "record_type": "SRV", "content": "0 1 587 {mail_client_host}.", "ttl": 300, "description": "SMTP submission cliente correo"},
    {"order": 115, "name": "_smtps._tcp", "record_type": "SRV", "content": "0 1 465 {mail_client_host}.", "ttl": 300, "description": "SMTPS cliente correo"},
    {"order": 116, "name": "_autodiscover._tcp", "record_type": "SRV", "content": "0 1 443 autodiscover.{domain}.", "ttl": 300, "description": "Autodiscover Outlook SRV"},
]


def update_records(apps, _schema_editor):
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
        ("hosting", "0059_hostingapplicationbackup_metadata"),
    ]

    operations = [
        migrations.RunPython(update_records, migrations.RunPython.noop),
    ]
