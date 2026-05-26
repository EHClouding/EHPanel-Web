from django.db import migrations


def prefer_openlitespeed(apps, _schema_editor):
    HostingPlan = apps.get_model("hosting", "HostingPlan")
    for plan in HostingPlan.objects.all():
        engines = list(plan.allowed_web_engines or [])
        if not engines or "nginx_apache" in engines:
            plan.allowed_web_engines = ["openlitespeed"]
            plan.save(update_fields=["allowed_web_engines", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0046_openlitespeed_web_engine"),
    ]

    operations = [
        migrations.RunPython(prefer_openlitespeed, migrations.RunPython.noop),
    ]
