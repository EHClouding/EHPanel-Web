from django.db import migrations, models


def backfill_domain_type_and_root(apps, schema_editor):
    HostingDomain = apps.get_model("hosting", "HostingDomain")
    for domain in HostingDomain.objects.select_related("account").all():
        if domain.is_primary:
            domain.domain_type = "primary"
            domain.document_root = "public_html"
        elif domain.domain.endswith("." + domain.account.primary_domain):
            label = domain.domain[: -(len(domain.account.primary_domain) + 1)].replace(".", "_")
            domain.domain_type = "subdomain"
            domain.document_root = f"subdomains/{label or 'site'}"
        else:
            domain.domain_type = "alias"
            domain.document_root = "public_html"
        domain.save(update_fields=["domain_type", "document_root"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0017_backfill_plan_runtime_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="hostingdomain",
            name="domain_type",
            field=models.CharField(
                choices=[
                    ("primary", "Primary"),
                    ("alias", "Alias"),
                    ("subdomain", "Subdomain"),
                    ("addon", "Addon"),
                ],
                default="alias",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="hostingdomain",
            name="document_root",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.RunPython(backfill_domain_type_and_root, migrations.RunPython.noop),
    ]
