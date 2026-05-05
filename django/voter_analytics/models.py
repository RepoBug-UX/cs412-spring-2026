# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Defines the Voter model for Newton, MA registered voter data
#              and provides a load_data() function to import records from CSV.

import csv
import os
from datetime import datetime
from django.db import models


class Voter(models.Model):
    """
    @notice Represents a single registered voter in Newton, MA.
    @dev Fields map directly to columns in newton_voters.csv.
         Party affiliation is stored as a 2-character field (may include trailing space).
    """

    last_name = models.TextField()
    first_name = models.TextField()
    street_number = models.TextField()
    street_name = models.TextField()
    apartment_number = models.TextField(blank=True)
    zip_code = models.TextField()
    date_of_birth = models.DateField()
    date_of_registration = models.DateField()
    party_affiliation = models.CharField(max_length=2)
    precinct_number = models.TextField()
    v20state = models.BooleanField(default=False)
    v21town = models.BooleanField(default=False)
    v21primary = models.BooleanField(default=False)
    v22general = models.BooleanField(default=False)
    v23town = models.BooleanField(default=False)
    voter_score = models.IntegerField(default=0)

    def __str__(self):
        """
        @notice Returns a human-readable string for this Voter.
        @return String with full name and street address.
        """
        return f'{self.first_name} {self.last_name}, {self.street_number} {self.street_name}'


def load_data():
    """
    @notice Loads voter records from newton_voters.csv into the database.
    @dev Deletes all existing Voter records before loading to prevent duplicates on re-run.
         Parses dates from 'YYYY-MM-DD' format and booleans from 'TRUE'/'FALSE' strings.
         CSV file is expected at voter_analytics/newton_voters.csv relative to this file.
    """
    Voter.objects.all().delete()

    csv_path = os.path.join(os.path.dirname(__file__), 'newton_voters.csv')

    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        voters = []
        for row in reader:
            try:
                voter = Voter(
                    last_name=row['Last Name'],
                    first_name=row['First Name'],
                    street_number=row['Residential Address - Street Number'],
                    street_name=row['Residential Address - Street Name'],
                    apartment_number=row['Residential Address - Apartment Number'],
                    zip_code=row['Residential Address - Zip Code'],
                    date_of_birth=datetime.strptime(row['Date of Birth'], '%Y-%m-%d').date(),
                    date_of_registration=datetime.strptime(row['Date of Registration'], '%Y-%m-%d').date(),
                    party_affiliation=row['Party Affiliation'],
                    precinct_number=row['Precinct Number'],
                    v20state=row['v20state'] == 'TRUE',
                    v21town=row['v21town'] == 'TRUE',
                    v21primary=row['v21primary'] == 'TRUE',
                    v22general=row['v22general'] == 'TRUE',
                    v23town=row['v23town'] == 'TRUE',
                    voter_score=int(row['voter_score']),
                )
                voters.append(voter)
            except Exception as e:
                print(f'Skipping row due to error: {e} | Row: {row}')

    Voter.objects.bulk_create(voters)
    print(f'Loaded {Voter.objects.count()} voter records.')
