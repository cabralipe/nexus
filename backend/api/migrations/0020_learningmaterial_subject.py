from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0019_allow_school_logo_upload"),
    ]

    operations = [
        migrations.AddField(
            model_name="learningmaterial",
            name="subject",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
