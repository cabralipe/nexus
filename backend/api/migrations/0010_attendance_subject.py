from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_absencejustification"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="subject",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AlterUniqueTogether(
            name="attendancerecord",
            unique_together={("student", "classroom", "date", "subject")},
        ),
    ]
