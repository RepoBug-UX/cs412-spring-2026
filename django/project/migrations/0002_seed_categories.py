# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Data migration that seeds the global Category table with the
#              ten default categories defined in DESIGN.md §4. Per design D1
#              categories are global for v1 — this migration provides the
#              shared starting set every user sees.

from django.db import migrations


# Tuples of (name, description, is_essential). Order matters only for
# readability — the Category Meta orders alphabetically on read.
SEED_CATEGORIES = [
    (
        "Housing",
        "Rent or mortgage, HOA fees, property tax — the core cost of having a place to live.",
        True,
    ),
    (
        "Utilities",
        "Energy, water, gas, heating — recurring service charges to keep the lights on.",
        True,
    ),
    (
        "Personal Billings",
        "Phone plans, internet, and other personal communication services.",
        True,
    ),
    (
        "Insurance",
        "House, fire/flood, auto, life, and medical insurance premiums.",
        True,
    ),
    (
        "Subscriptions — Entertainment",
        "Streaming services and entertainment subscriptions like Netflix and Spotify.",
        False,
    ),
    (
        "Subscriptions — SaaS",
        "Software-as-a-service: iCloud, Google storage, Claude, Adobe, and similar tooling.",
        False,
    ),
    (
        "Subscriptions — Lifestyle",
        "Gym memberships, meal kits, Amazon Prime, and other lifestyle subscriptions.",
        False,
    ),
    (
        "Subscriptions — Professional",
        "Professional tools and memberships such as LinkedIn Premium.",
        False,
    ),
    (
        "Transportation",
        "Car payments, registration, tolls, public transit passes, and rideshare services.",
        True,
    ),
    (
        "Debt & Obligations",
        "Student loans, personal loans, credit-card payments, tuition, childcare, and support obligations.",
        True,
    ),
]


def seed_categories(apps, schema_editor):
    """
    @notice Inserts the default categories defined in DESIGN.md §4.
    @dev Uses the historical model accessor (apps.get_model) so this migration
         remains correct even if the Category model evolves in later
         migrations. Uses get_or_create keyed on the unique name so the
         migration is idempotent — re-running on a database that already has
         these rows is a no-op.
    """
    Category = apps.get_model("project", "Category")
    for name, description, is_essential in SEED_CATEGORIES:
        Category.objects.get_or_create(
            name=name,
            defaults={"description": description, "is_essential": is_essential},
        )


def remove_categories(apps, schema_editor):
    """
    @notice Reverse migration: deletes the seeded categories by name.
    @dev Only deletes rows whose name matches one of the seeded entries —
         user-created categories (if per-user customization is added in v2)
         are left untouched. PROTECT on RecurringExpense.category will block
         this if any expense still references a seeded category, which is
         the desired behaviour.
    """
    Category = apps.get_model("project", "Category")
    Category.objects.filter(name__in=[name for name, _, _ in SEED_CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("project", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_categories, remove_categories),
    ]
