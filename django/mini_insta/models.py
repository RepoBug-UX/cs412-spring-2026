from django.db import models
from django.urls import reverse
from django.contrib.auth.models import User


class Profile(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, default=1)
	username = models.CharField(max_length=150, unique=True)
	display_name = models.CharField(max_length=150)
	profile_image_url = models.URLField(blank=True)
	profile_image_file = models.ImageField(upload_to='profile_images/', blank=True)
	bio_text = models.TextField(blank=True)
	join_date = models.DateField(auto_now_add=True)

	def __str__(self):
		return f"{self.username} ({self.display_name})"

	def get_profile_image_url(self):
		'''Return the profile image URL from file upload or URL field.'''
		if self.profile_image_file:
			return self.profile_image_file.url
		return self.profile_image_url
	
	def get_all_posts(self):
		return self.posts.all().order_by('-timestamp')

	def get_absolute_url(self):
		return reverse('mini_insta:show_profile', kwargs={'pk': self.pk})

	def get_followers(self):
		'''Return list of Profiles who follow this profile.'''
		return [f.follower_profile for f in Follow.objects.filter(profile=self)]

	def get_num_followers(self):
		return len(self.get_followers())

	def get_following(self):
		'''Return list of Profiles this profile is following.'''
		return [f.profile for f in Follow.objects.filter(follower_profile=self)]

	def get_num_following(self):
		return len(self.get_following())

	def get_post_feed(self):
		'''Return all posts from profiles this profile is following, ordered by most recent.'''
		following = self.get_following()
		return Post.objects.filter(profile__in=following).order_by('-timestamp')

class Post(models.Model):
	profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='posts')
	caption = models.TextField(blank=True)
	timestamp = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"Post by {self.profile.username} at {self.timestamp}"
	
	def get_all_photos(self):
		return self.photos.all().order_by('-timestamp')

	def get_absolute_url(self):
		return reverse('mini_insta:show_post', kwargs={'pk': self.pk})

	def get_all_comments(self):
		return Comment.objects.filter(post=self).order_by('timestamp')

	def get_likes(self):
		return Like.objects.filter(post=self)

class Photo(models.Model):
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='photos')
	image_url = models.URLField(blank=True)
	image_file = models.ImageField(upload_to='photos/', blank=True)
	timestamp = models.DateTimeField(auto_now_add=True)

	def get_image_url(self):
		'''Return the URL to the image, either from image_file or image_url.'''
		if self.image_file:
			return self.image_file.url
		return self.image_url

	def __str__(self):
		if self.image_file:
			return f"Photo (file) for post {self.post.id}"
		return f"Photo (url) for post {self.post.id}"

class Follow(models.Model):
	profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='profile')
	follower_profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='follower_profile')
	timestamp = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.follower_profile.display_name} follows {self.profile.display_name}"

class Comment(models.Model):
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
	profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='comments')
	timestamp = models.DateTimeField(auto_now_add=True)
	text = models.TextField()

	def __str__(self):
		return f"Comment by {self.profile.username} on post {self.post.id}"

class Like(models.Model):
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
	profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='likes')
	timestamp = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f"{self.profile.username} likes post {self.post.id}"