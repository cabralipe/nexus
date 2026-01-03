from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_passwordresettoken"),
    ]

    operations = [
        migrations.CreateModel(
            name="AbsenceJustification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(max_length=200)),
                ("observation", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("pending", "Pendente"), ("approved", "Aprovada"), ("rejected", "Rejeitada")], default="pending", max_length=20)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("attendance", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="justification", to="api.attendancerecord")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="absence_justifications_created", to="api.userprofile")),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="absence_justifications_decided", to="api.userprofile")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
