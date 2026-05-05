from django.urls import path
from . import views

app_name = 'dadjokes'

urlpatterns = [
    # Web views
    path('', views.RandomView.as_view(), name='random'),
    path('random', views.RandomView.as_view(), name='random2'),
    path('jokes', views.JokeListView.as_view(), name='jokes'),
    path('joke/<int:pk>', views.JokeDetailView.as_view(), name='joke_detail'),
    path('pictures', views.PictureListView.as_view(), name='pictures'),
    path('picture/<int:pk>', views.PictureDetailView.as_view(), name='picture_detail'),

    # API views
    path('api/', views.RandomJokeAPIView.as_view(), name='api_random'),
    path('api/random', views.RandomJokeAPIView.as_view(), name='api_random2'),
    path('api/jokes', views.JokeListAPIView.as_view(), name='api_jokes'),
    path('api/joke/<int:pk>', views.JokeDetailAPIView.as_view(), name='api_joke_detail'),
    path('api/pictures', views.PictureListAPIView.as_view(), name='api_pictures'),
    path('api/picture/<int:pk>', views.PictureDetailAPIView.as_view(), name='api_picture_detail'),
    path('api/random_picture', views.RandomPictureAPIView.as_view(), name='api_random_picture'),
]
