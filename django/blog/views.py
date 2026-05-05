from django.shortcuts import render
from .models import Article
from django.views.generic import ListView
# REST framework imports
from rest_framework import generics
from .serializers import *

# Create your views here.
 
class ArticleListAPIView(generics.ListCreateAPIView):
    '''
    A view that handles GET and POST requests for Article objects.
    '''
    queryset = Article.objects.all() # retrieve all Article objects from the database
    serializer_class = ArticleSerializer # use the ArticleSerializer to convert data to/from JSON
 
class ArticleDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    '''
    A view that handles GET, PUT, PATCH, and DELETE requests for a single Article object.
    '''
    queryset = Article.objects.all() # retrieve all Article objects from the database
    serializer_class = ArticleSerializer # use the ArticleSerializer to convert data to/from JSON

class ShowAllView(ListView):
    '''Create a subclass of ListView to display all blog articles.'''
 
 
    model = Article # retrieve objects of type Article from the database
    template_name = 'blog/show_all.html'
    context_object_name = 'articles' # how to find the data in the template file

    