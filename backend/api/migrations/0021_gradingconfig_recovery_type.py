from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0020_learningmaterial_subject"),
    ]

    operations = [
        migrations.AddField(
            model_name="gradingconfig",
            name="recovery_type",
            field=models.CharField(
                choices=[
                    ("none", "Sem recuperacao"),
                    ("grade", "Recuperacao por nota"),
                    ("exam", "Recuperacao por prova"),
                ],
                default="grade",
                max_length=20,
            ),
        ),
    ]
