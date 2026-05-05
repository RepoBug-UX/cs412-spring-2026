from django.db import models
import random

class Joke(models.Model):
    text = models.TextField(blank=False)
    contributor = models.CharField(max_length=200)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'"{self.text}" - {self.contributor}'

    @classmethod
    def get_random(cls):
        all_jokes = cls.objects.all()
        return random.choice(list(all_jokes))

class Picture(models.Model):
    image_url = models.URLField(blank=False)
    contributor = models.CharField(max_length=200)
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Picture by {self.contributor}'

    @classmethod
    def get_random(cls):
        all_pictures = cls.objects.all()
        return random.choice(list(all_pictures))
