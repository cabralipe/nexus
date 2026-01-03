from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0011_inventoryitem"),
    ]

    operations = [
        migrations.AddField(
            model_name="attendancerecord",
            name="teacher",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.userprofile"),
        ),
    ]
