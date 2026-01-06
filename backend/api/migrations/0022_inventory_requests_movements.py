from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0021_gradingconfig_recovery_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("approved", "Aprovada"), ("rejected", "Rejeitada")], default="pending", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="inventory_decisions", to="api.userprofile")),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.inventoryitem")),
                ("requested_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.userprofile")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="InventoryMovement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("movement_type", models.CharField(choices=[("in", "Entrada"), ("out", "Saida")], max_length=10)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("reason", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.userprofile")),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.inventoryitem")),
                ("related_request", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.inventoryrequest")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
