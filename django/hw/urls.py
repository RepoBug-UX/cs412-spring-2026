from django.urls import path
from django.conf.urls.static import static
from django.conf import settings
from . import views

app_name = 'hw'
 
urlpatterns = [ 
    # path(r'', views.home, name="home"),
    path(r'', views.home_page, name="home"),
    path(r'about', views.about, name="about"),
]
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)