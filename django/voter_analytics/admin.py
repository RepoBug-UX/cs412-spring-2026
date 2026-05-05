# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Registers the Voter model with the Django admin site.

from django.contrib import admin
from .models import Voter

admin.site.register(Voter)
