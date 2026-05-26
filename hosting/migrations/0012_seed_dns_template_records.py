from django.db import migrations


DEFAULT_RECORDS = [
    {"order": 10, "name": "@", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "Dominio raiz al nodo"},
    {"order": 20, "name": "www", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "WWW al nodo"},
    {"order": 30, "name": "mail", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "Servidor de correo"},
    {"order": 40, "name": "ftp", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "FTP/SFTP"},
    {"order": 50, "name": "@", "record_type": "MX", "content": "{mail_host}.", "ttl": 300, "priority": 10, "description": "MX principal"},
    {"order": 60, "name": "@", "record_type": "TXT", "content": "v=spf1 a mx ip4:{ip} ~all", "ttl": 300, "description": "SPF"},
    {"order": 70, "name": "_dmarc", "record_type": "TXT", "content": "v=DMARC1; p=none; rua=mailto:postmaster@{domain}", "ttl": 300, "description": "DMARC"},
    {"order": 80, "name": "{selector}._domainkey", "record_type": "TXT", "content": "{dkim_txt}", "ttl": 300, "description": "DKIM generado por nodo"},
    {"order": 90, "name": "@", "record_type": "NS", "content": "ns1.{domain}.", "ttl": 300, "description": "Nameserver primario"},
    {"order": 100, "name": "ns1", "record_type": "A", "content": "{ip}", "ttl": 300, "description": "IP del nameserver"},
    {"order": 110, "name": "autodiscover", "record_type": "CNAME", "content": "{mail_host}.", "ttl": 300, "description": "Autodiscover correo"},
]


def seed_records(apps, _schema_editor):
    DNSTemplateRecord = apps.get_model("hosting", "DNSTemplateRecord")
    for record in DEFAULT_RECORDS:
        DNSTemplateRecord.objects.update_or_create(
            name=record["name"],
            record_type=record["record_type"],
            defaults={
                "content": record["content"],
                "ttl": record["ttl"],
                "priority": record.get("priority"),
                "order": record["order"],
                "is_active": True,
                "description": record["description"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0011_hostingdomain_dkim_selector_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_records, migrations.RunPython.noop),
    ]
