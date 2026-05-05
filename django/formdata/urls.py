from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

app_name = 'formdata'
 
urlpatterns = [ 
    path(r'', views.show_form, name="show_form"),
    path(r'submit/', views.submit, name="submit"),
]
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)