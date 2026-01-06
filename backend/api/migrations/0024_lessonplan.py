from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0023_financialtransaction_discounts"),
    ]

    operations = [
        migrations.CreateModel(
            name="LessonPlan",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=120)),
                ("grade_level", models.CharField(blank=True, max_length=80)),
                ("date", models.DateField()),
                ("duration", models.CharField(blank=True, max_length=40)),
                ("topic", models.CharField(max_length=200)),
                ("objectives", models.TextField(blank=True)),
                ("content_program", models.TextField(blank=True)),
                ("methodology", models.TextField(blank=True)),
                ("resources", models.TextField(blank=True)),
                ("activities", models.TextField(blank=True)),
                ("assessment", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("Pending", "Pendente"), ("Approved", "Aprovado"), ("Rejected", "Reprovado")], default="Pending", max_length=30)),
                ("feedback", models.TextField(blank=True)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("classroom", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lesson_plans", to="api.classroom")),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lesson_plans_decided", to="api.userprofile")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
                ("teacher", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="lesson_plans", to="api.userprofile")),
            ],
            options={
                "ordering": ["-date", "-submitted_at"],
            },
        ),
    ]
