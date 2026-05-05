from django.urls import path
from django.contrib.auth import views as auth_views
from .views import ShowAllView, ArticleListAPIView, ArticleDetailAPIView

app_name = 'blog'
 
urlpatterns = [ 
    path('', ShowAllView.as_view(), name='show_all'),
    # API views:
    path(r'api/articlees/', ArticleListAPIView.as_view(), name='article-list-api'),
    path(r'api/articlees/<int:pk>/', ArticleDetailAPIView.as_view(), name='article-detail-api'),
]