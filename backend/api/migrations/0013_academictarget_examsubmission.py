from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_attendance_teacher"),
    ]

    operations = [
        migrations.CreateModel(
            name="AcademicTarget",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("month_label", models.CharField(max_length=100)),
                ("required_classes", models.PositiveIntegerField(default=0)),
                ("grade_submission_deadline", models.DateField()),
                ("exam_submission_deadline", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
            ],
            options={"ordering": ["-grade_submission_deadline", "-exam_submission_deadline"]},
        ),
        migrations.CreateModel(
            name="ExamSubmission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("subject", models.CharField(max_length=120)),
                ("grade_level", models.CharField(blank=True, max_length=80)),
                ("exam_type", models.CharField(choices=[("Standard", "Padrao"), ("Adapted", "Adaptada")], default="Standard", max_length=20)),
                ("status", models.CharField(choices=[("Pending", "Pendente"), ("Approved", "Aprovada"), ("ChangesRequested", "Revisao Solicitada")], default="Pending", max_length=30)),
                ("student_name", models.CharField(blank=True, max_length=120)),
                ("feedback", models.TextField(blank=True)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exam_submissions_decided", to="api.userprofile")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="api.school")),
                ("submitted_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exam_submissions", to="api.userprofile")),
            ],
            options={"ordering": ["-submitted_at"]},
        ),
    ]
