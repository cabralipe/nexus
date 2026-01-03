from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0014_examsubmission_scheduled_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="student",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="profile", to="api.student"),
        ),
    ]
