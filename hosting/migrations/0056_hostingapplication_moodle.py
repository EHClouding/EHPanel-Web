from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hosting", "0055_mail_autodiscover_dns_template"),
    ]

    operations = [
        migrations.AlterField(
            model_name="hostingapplication",
            name="app_type",
            field=models.CharField(
                choices=[
                    ("wordpress", "WordPress"),
                    ("python", "Python"),
                    ("django", "Django"),
                    ("nodejs", "Node.js"),
                    ("laravel", "Laravel"),
                    ("moodle", "Moodle"),
                ],
                default="wordpress",
                max_length=30,
            ),
        ),
    ]
