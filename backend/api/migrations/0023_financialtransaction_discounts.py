from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0022_inventory_requests_movements"),
    ]

    operations = [
        migrations.AddField(
            model_name="financialtransaction",
            name="student",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="api.student",
            ),
        ),
        migrations.AddField(
            model_name="financialtransaction",
            name="gross_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="financialtransaction",
            name="discount_type",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="financialtransaction",
            name="discount_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
