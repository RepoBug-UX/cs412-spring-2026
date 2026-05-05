from django.urls import path
from django.contrib.auth import views as auth_views
from django.views.generic import TemplateView
from .views import (
    ProfileListView, ProfileDetailView, ShowMyProfileView,
    PostDetailView, CreatePostView, UpdateProfileView,
    DeletePostView, UpdatePostView, ShowFollowersDetailView,
    ShowFollowingDetailView, PostFeedListView, SearchView,
    CreateProfileView, FollowProfileView, UnfollowProfileView,
    LikePostView, UnlikePostView, LikedPostsView,
    CreateCommentView, DeleteCommentView, CommentedPostsView,
)

app_name = 'mini_insta'

urlpatterns = [
    # Public views
    path('', ProfileListView.as_view(), name='show_all_profiles'),
    path('profile/<int:pk>', ProfileDetailView.as_view(), name='show_profile'),
    path('post/<int:pk>', PostDetailView.as_view(), name='show_post'),
    path('profile/<int:pk>/followers', ShowFollowersDetailView.as_view(), name='show_followers'),
    path('profile/<int:pk>/following', ShowFollowingDetailView.as_view(), name='show_following'),

    # Logged-in user views (no pk needed)
    path('profile', ShowMyProfileView.as_view(), name='show_my_profile'),
    path('profile/feed', PostFeedListView.as_view(), name='show_feed'),
    path('profile/search', SearchView.as_view(), name='search'),
    path('profile/update', UpdateProfileView.as_view(), name='update_profile'),
    path('profile/create_post', CreatePostView.as_view(), name='create_post'),
    path('profile/liked_posts', LikedPostsView.as_view(), name='liked_posts'),
    path('profile/commented_posts', CommentedPostsView.as_view(), name='commented_posts'),

    # Comments
    path('post/<int:pk>/comment', CreateCommentView.as_view(), name='create_comment'),
    path('comment/<int:pk>/delete', DeleteCommentView.as_view(), name='delete_comment'),

    # Follow/Unfollow
    path('profile/<int:pk>/follow', FollowProfileView.as_view(), name='follow'),
    path('profile/<int:pk>/delete_follow', UnfollowProfileView.as_view(), name='delete_follow'),

    # Like/Unlike
    path('post/<int:pk>/like', LikePostView.as_view(), name='like'),
    path('post/<int:pk>/delete_like', UnlikePostView.as_view(), name='delete_like'),

    # Post CRUD (still use post pk)
    path('post/<int:pk>/delete', DeletePostView.as_view(), name='delete_post'),
    path('post/<int:pk>/update', UpdatePostView.as_view(), name='update_post'),

    # Registration
    path('create_profile', CreateProfileView.as_view(), name='create_profile'),

    # Auth
    path('login/', auth_views.LoginView.as_view(template_name='mini_insta/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='mini_insta:logout_confirmation'), name='logout'),
    path('logout_confirmation', TemplateView.as_view(template_name='mini_insta/logged_out.html'), name='logout_confirmation'),
]
