from django.db import models

# Create your models here.
class Article(models.Model):
    '''Encapsulate the idea of an Article by some author.'''
    title = models.TextField(blank=False)
    author = models.TextField(blank=False)
    text = models.TextField(blank=False)
    published = models.DateTimeField(auto_now=True)

    def __str__(self):
        '''Return a string representation of this Article object.'''
        return f'{self.title} by {self.author}'