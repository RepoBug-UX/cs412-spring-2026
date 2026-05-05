from django import forms
from .models import *

class CreatePostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['caption']

class UpdateProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['display_name', 'profile_image_url', 'profile_image_file', 'bio_text']

class UpdatePostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['caption']

class CreateProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['username', 'display_name', 'bio_text', 'profile_image_url', 'profile_image_file']

class CreateCommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['text']
