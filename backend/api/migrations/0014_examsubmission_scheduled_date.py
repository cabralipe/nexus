from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0013_academictarget_examsubmission"),
    ]

    operations = [
        migrations.AddField(
            model_name="examsubmission",
            name="scheduled_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
