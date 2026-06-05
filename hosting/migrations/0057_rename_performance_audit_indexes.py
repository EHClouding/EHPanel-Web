from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0056_hostingapplication_moodle"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="hostingperformanceaudit",
            new_name="hosting_hos_account_b54ec6_idx",
            old_name="hosting_per_account_b01bfe_idx",
        ),
        migrations.RenameIndex(
            model_name="hostingperformanceaudit",
            new_name="hosting_hos_created_7d0880_idx",
            old_name="hosting_per_created_5298f0_idx",
        ),
    ]
