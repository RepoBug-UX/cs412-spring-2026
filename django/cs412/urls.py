"""
URL configuration for cs412 project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path('quotes/', include('quotes.urls', namespace='quotes')),
    path('hw/', include('hw.urls', namespace='hw')),
    path('formdata/', include('formdata.urls', namespace='formdata')),
    path('restaurant/', include('restaurant.urls', namespace='restaurant')),
    path('blog/', include('blog.urls', namespace='blog')),
    path('mini_insta/', include('mini_insta.urls', namespace='mini_insta')),
    path('voter_analytics/', include('voter_analytics.urls', namespace='voter_analytics')),
    path('dadjokes/', include('dadjokes.urls', namespace='dadjokes')),
    path('project/', include('project.urls', namespace='project')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
