from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView, TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.shortcuts import render, redirect
from .models import Profile, Post, Photo, Follow, Like, Comment
from .forms import CreatePostForm, UpdateProfileForm, UpdatePostForm, CreateProfileForm, CreateCommentForm
from django.urls import reverse


class MiniInstaLoginRequiredMixin(LoginRequiredMixin):
    '''Custom mixin that redirects to mini_insta login and provides get_profile().'''

    def get_login_url(self):
        return reverse('mini_insta:login')

    def get_profile(self):
        return Profile.objects.get(user=self.request.user)


class ProfileListView(ListView):
    '''Display all profiles.'''
    model = Profile
    template_name = 'mini_insta/show_all_profiles.html'
    context_object_name = 'profiles'


class ProfileDetailView(DetailView):
    '''Display a single profile by pk.'''
    model = Profile
    template_name = 'mini_insta/show_profile.html'
    context_object_name = 'profile'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated:
            try:
                logged_in_profile = Profile.objects.get(user=self.request.user)
                context['is_following'] = Follow.objects.filter(
                    profile=self.object, follower_profile=logged_in_profile
                ).exists()
            except Profile.DoesNotExist:
                pass
        return context


class ShowMyProfileView(MiniInstaLoginRequiredMixin, DetailView):
    '''Display the logged-in user\'s own profile.'''
    model = Profile
    template_name = 'mini_insta/show_profile.html'
    context_object_name = 'profile'

    def get_object(self):
        return self.get_profile()


class PostDetailView(DetailView):
    '''Display a single post.'''
    model = Post
    template_name = 'mini_insta/show_post.html'
    context_object_name = 'post'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated:
            try:
                logged_in_profile = Profile.objects.get(user=self.request.user)
                context['has_liked'] = Like.objects.filter(
                    post=self.object, profile=logged_in_profile
                ).exists()
            except Profile.DoesNotExist:
                pass
        context['comment_form'] = CreateCommentForm()
        return context


class CreatePostView(MiniInstaLoginRequiredMixin, CreateView):
    '''View to create a new post for the logged-in user.'''
    model = Post
    form_class = CreatePostForm
    template_name = 'mini_insta/create_post_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = self.get_profile()
        return context

    def form_valid(self, form):
        form.instance.profile = self.get_profile()
        response = super().form_valid(form)
        files = self.request.FILES.getlist('files')
        for f in files:
            Photo.objects.create(post=self.object, image_file=f)
        return response

    def get_success_url(self):
        return reverse('mini_insta:show_post', kwargs={'pk': self.object.pk})


class UpdateProfileView(MiniInstaLoginRequiredMixin, UpdateView):
    '''View to update the logged-in user\'s profile.'''
    model = Profile
    form_class = UpdateProfileForm
    template_name = 'mini_insta/update_profile_form.html'

    def get_object(self):
        return self.get_profile()


class DeletePostView(MiniInstaLoginRequiredMixin, DeleteView):
    '''View to delete a post.'''
    model = Post
    template_name = 'mini_insta/delete_post_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['post'] = self.object
        context['profile'] = self.object.profile
        return context

    def get_success_url(self):
        return reverse('mini_insta:show_profile', kwargs={'pk': self.object.profile.pk})


class UpdatePostView(MiniInstaLoginRequiredMixin, UpdateView):
    '''View to update a post caption.'''
    model = Post
    form_class = UpdatePostForm
    template_name = 'mini_insta/update_post_form.html'


class PostFeedListView(MiniInstaLoginRequiredMixin, ListView):
    '''Display the post feed for the logged-in user.'''
    model = Post
    template_name = 'mini_insta/show_feed.html'
    context_object_name = 'posts'

    def get_queryset(self):
        return self.get_profile().get_post_feed()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = self.get_profile()
        return context


class ShowFollowersDetailView(DetailView):
    '''Display followers of a profile.'''
    model = Profile
    template_name = 'mini_insta/show_followers.html'
    context_object_name = 'profile'


class ShowFollowingDetailView(DetailView):
    '''Display profiles that a profile is following.'''
    model = Profile
    template_name = 'mini_insta/show_following.html'
    context_object_name = 'profile'


class SearchView(MiniInstaLoginRequiredMixin, ListView):
    '''Search profiles and posts by a query string.'''
    model = Post
    template_name = 'mini_insta/search_results.html'
    context_object_name = 'posts'

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if 'query' not in request.GET:
            return render(request, 'mini_insta/search.html', {'profile': self.get_profile()})
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        query = self.request.GET.get('query', '')
        return Post.objects.filter(caption__icontains=query)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        query = self.request.GET.get('query', '')
        context['profile'] = self.get_profile()
        context['query'] = query
        context['posts'] = Post.objects.filter(caption__icontains=query)
        context['profiles'] = Profile.objects.filter(
            username__icontains=query
        ) | Profile.objects.filter(
            display_name__icontains=query
        ) | Profile.objects.filter(
            bio_text__icontains=query
        )
        return context


class LikedPostsView(MiniInstaLoginRequiredMixin, ListView):
    '''Display all posts liked by the logged-in user.'''
    model = Post
    template_name = 'mini_insta/liked_posts.html'
    context_object_name = 'posts'

    def get_queryset(self):
        profile = self.get_profile()
        return Post.objects.filter(likes__profile=profile)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = self.get_profile()
        return context


class CreateProfileView(CreateView):
    '''View to create a new Profile along with a new User account.'''
    model = Profile
    form_class = CreateProfileForm
    template_name = 'mini_insta/create_profile_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['user_creation_form'] = UserCreationForm()
        return context

    def form_valid(self, form):
        # Reconstruct and save the UserCreationForm
        user_creation_form = UserCreationForm(self.request.POST)
        user = user_creation_form.save()
        # Log the new user in
        login(self.request, user, backend='django.contrib.auth.backends.ModelBackend')
        # Attach the user to the profile before saving
        form.instance.user = user
        return super().form_valid(form)

    def get_success_url(self):
        return reverse('mini_insta:show_my_profile')


class FollowProfileView(MiniInstaLoginRequiredMixin, TemplateView):
    '''Follow another profile.'''
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        logged_in_profile = self.get_profile()
        other_profile = Profile.objects.get(pk=kwargs['pk'])
        if logged_in_profile != other_profile:
            Follow.objects.get_or_create(profile=other_profile, follower_profile=logged_in_profile)
        return redirect(reverse('mini_insta:show_profile', kwargs={'pk': other_profile.pk}))


class UnfollowProfileView(MiniInstaLoginRequiredMixin, TemplateView):
    '''Unfollow another profile.'''
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        logged_in_profile = self.get_profile()
        other_profile = Profile.objects.get(pk=kwargs['pk'])
        Follow.objects.filter(profile=other_profile, follower_profile=logged_in_profile).delete()
        return redirect(reverse('mini_insta:show_profile', kwargs={'pk': other_profile.pk}))


class LikePostView(MiniInstaLoginRequiredMixin, TemplateView):
    '''Like a post.'''
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        logged_in_profile = self.get_profile()
        post = Post.objects.get(pk=kwargs['pk'])
        if logged_in_profile != post.profile:
            Like.objects.get_or_create(post=post, profile=logged_in_profile)
        return redirect(reverse('mini_insta:show_post', kwargs={'pk': post.pk}))


class CreateCommentView(MiniInstaLoginRequiredMixin, CreateView):
    '''Add a comment to a post.'''
    model = Comment
    form_class = CreateCommentForm
    template_name = 'mini_insta/show_post.html'

    def form_valid(self, form):
        post = Post.objects.get(pk=self.kwargs['pk'])
        form.instance.post = post
        form.instance.profile = self.get_profile()
        return super().form_valid(form)

    def get_success_url(self):
        return reverse('mini_insta:show_post', kwargs={'pk': self.kwargs['pk']})


class DeleteCommentView(MiniInstaLoginRequiredMixin, DeleteView):
    '''Delete a comment.'''
    model = Comment
    template_name = 'mini_insta/delete_comment_form.html'

    def get_success_url(self):
        return reverse('mini_insta:show_post', kwargs={'pk': self.object.post.pk})


class CommentedPostsView(MiniInstaLoginRequiredMixin, ListView):
    '''Display all posts commented on by the logged-in user.'''
    model = Post
    template_name = 'mini_insta/commented_posts.html'
    context_object_name = 'posts'

    def get_queryset(self):
        profile = self.get_profile()
        return Post.objects.filter(comments__profile=profile).distinct()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = self.get_profile()
        return context


class UnlikePostView(MiniInstaLoginRequiredMixin, TemplateView):
    '''Unlike a post.'''
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        logged_in_profile = self.get_profile()
        post = Post.objects.get(pk=kwargs['pk'])
        Like.objects.filter(post=post, profile=logged_in_profile).delete()
        return redirect(reverse('mini_insta:show_post', kwargs={'pk': post.pk}))
