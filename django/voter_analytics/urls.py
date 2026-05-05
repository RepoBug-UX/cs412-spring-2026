# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: URL configuration for the voter_analytics app.
#              Routes requests to the voter list, voter detail, and graphs views.

from django.urls import path
from . import views

app_name = 'voter_analytics'

urlpatterns = [
    path('', views.VoterListView.as_view(), name='voters'),
    path('voter/<int:pk>', views.VoterDetailView.as_view(), name='voter'),
    path('graphs', views.VoterGraphsView.as_view(), name='graphs'),
]
