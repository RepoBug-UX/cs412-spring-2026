from django.contrib import admin
from .models import Profile, Post, Photo, Follow, Comment, Like


class ProfileAdmin(admin.ModelAdmin):
	list_display = ("username", "display_name", "join_date")
	search_fields = ("username", "display_name")


admin.site.register(Profile, ProfileAdmin)
admin.site.register(Post)
admin.site.register(Photo)
admin.site.register(Follow)
admin.site.register(Comment)
admin.site.register(Like)

