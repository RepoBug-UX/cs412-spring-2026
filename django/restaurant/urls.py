from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = 'restaurant'

urlpatterns = [
    path(r'', views.main, name="root"),
    path(r'main/', views.main, name="main"),
    path(r'order/', views.order, name="order"),
    path(r'confirmation/', views.confirmation, name="confirmation"),
]
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)