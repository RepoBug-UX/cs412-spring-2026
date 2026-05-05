from django.urls import path
from django.conf.urls.static import static
from django.conf import settings
from . import views

app_name = 'quotes'

urlpatterns = [
    path(r'', views.quote, name='root'),           # Default path
    path(r'quote/', views.quote, name='quote'),    # Alternate path to the dfault path
    path(r'show_all/', views.show_all, name='show_all'), # Show all quotes and images
    path(r'about/', views.about, name='about'),          # About page
]
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)