from django.views.generic import ListView, DetailView, TemplateView
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Joke, Picture
from .serializers import JokeSerializer, PictureSerializer

# --- Web Views ---

class RandomView(TemplateView):
    template_name = 'dadjokes/random.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['joke'] = Joke.get_random()
        context['picture'] = Picture.get_random()
        return context

class JokeListView(ListView):
    model = Joke
    template_name = 'dadjokes/jokes.html'
    context_object_name = 'jokes'

class JokeDetailView(DetailView):
    model = Joke
    template_name = 'dadjokes/joke_detail.html'
    context_object_name = 'joke'

class PictureListView(ListView):
    model = Picture
    template_name = 'dadjokes/pictures.html'
    context_object_name = 'pictures'

class PictureDetailView(DetailView):
    model = Picture
    template_name = 'dadjokes/picture_detail.html'
    context_object_name = 'picture'

# --- API Views ---

class RandomJokeAPIView(APIView):
    def get(self, request):
        joke = Joke.get_random()
        serializer = JokeSerializer(joke)
        return Response(serializer.data)

class JokeListAPIView(generics.ListCreateAPIView):
    queryset = Joke.objects.all()
    serializer_class = JokeSerializer

class JokeDetailAPIView(generics.RetrieveAPIView):
    queryset = Joke.objects.all()
    serializer_class = JokeSerializer

class PictureListAPIView(generics.ListAPIView):
    queryset = Picture.objects.all()
    serializer_class = PictureSerializer

class PictureDetailAPIView(generics.RetrieveAPIView):
    queryset = Picture.objects.all()
    serializer_class = PictureSerializer

class RandomPictureAPIView(APIView):
    def get(self, request):
        picture = Picture.get_random()
        serializer = PictureSerializer(picture)
        return Response(serializer.data)
