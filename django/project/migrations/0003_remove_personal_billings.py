# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Drops the "Personal Billings" Category and folds its concept
#              (phone plans, internet, etc.) into "Utilities", which most
#              users already think of as a single bucket. Defensive about
#              foreign-key references: any RecurringExpense currently
#              pointing at Personal Billings is reassigned to Utilities
#              before the row is deleted, so the on_delete=PROTECT rule
#              on RecurringExpense.category is never triggered.

from django.db import migrations


# Updated Utilities description that absorbs the Personal Billings copy.
UPDATED_UTILITIES_DESCRIPTION = (
    "Energy, water, gas, heating, plus phone plans, internet, and other "
    "recurring service charges that keep the lights on and the household "
    "connected."
)
ORIGINAL_UTILITIES_DESCRIPTION = (
    "Energy, water, gas, heating — recurring service charges to keep the lights on."
)
ORIGINAL_PERSONAL_BILLINGS_DESCRIPTION = (
    "Phone plans, internet, and other personal communication services."
)


def remove_personal_billings(apps, schema_editor):
    """
    @notice Forward migration. Reassigns expenses to Utilities, then
            deletes the Personal Billings Category and updates the
            Utilities description.
    @dev Idempotent — if Personal Billings has already been deleted (e.g.
         a partial earlier run), the function returns cleanly without
         erroring.
    """
    Category = apps.get_model("project", "Category")
    RecurringExpense = apps.get_model("project", "RecurringExpense")

    try:
        utilities = Category.objects.get(name="Utilities")
    except Category.DoesNotExist:
        # Nothing to fold into. Bail out so the seed-data invariant holds.
        return

    # Update Utilities to absorb the Personal Billings concept.
    utilities.description = UPDATED_UTILITIES_DESCRIPTION
    utilities.save(update_fields=["description"])

    try:
        personal_billings = Category.objects.get(name="Personal Billings")
    except Category.DoesNotExist:
        return

    RecurringExpense.objects.filter(category=personal_billings).update(category=utilities)
    personal_billings.delete()


def restore_personal_billings(apps, schema_editor):
    """
    @notice Reverse migration. Recreates Personal Billings with its
            original description and restores Utilities' original copy.
    @dev Cannot reassign expenses back to Personal Billings — the forward
         step destroyed the information about which were originally
         routed there. This is acceptable for the migration's purpose
         (rolling back the schema decision); test data simply ends up
         consolidated under Utilities.
    """
    Category = apps.get_model("project", "Category")

    Category.objects.update_or_create(
        name="Personal Billings",
        defaults={
            "description": ORIGINAL_PERSONAL_BILLINGS_DESCRIPTION,
            "is_essential": True,
        },
    )

    Category.objects.filter(name="Utilities").update(
        description=ORIGINAL_UTILITIES_DESCRIPTION,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("project", "0002_seed_categories"),
    ]

    operations = [
        migrations.RunPython(remove_personal_billings, restore_personal_billings),
    ]
