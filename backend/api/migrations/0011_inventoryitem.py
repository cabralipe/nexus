from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0010_attendance_subject"),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("category", models.CharField(choices=[("Stationery", "Papelaria"), ("Cleaning", "Limpeza"), ("Electronics", "Eletronicos"), ("Didactic", "Didatico")], max_length=30)),
                ("quantity", models.PositiveIntegerField(default=0)),
                ("min_quantity", models.PositiveIntegerField(default=0)),
                ("unit", models.CharField(blank=True, max_length=40)),
                ("location", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
            ],
            options={"ordering": ["name"]},
        ),
    ]
