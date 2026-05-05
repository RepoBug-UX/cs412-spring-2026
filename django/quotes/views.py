from django.shortcuts import render
import random

# Lists of quotes and images for Linus Torvolds
QUOTES = [
    "Microsoft isn't evil, they just make really crappy operating systems.",
    "My name is Linus, and I am your God.",
    "I'm generally a very pragmatic person: that which works, works.",
    "You won't get sued for anticompetitive behavior.",
]

IMAGES = [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/LinusTorvalds.jpg/220px-LinusTorvalds.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Linus_Torvalds_-_Linuxcon2011.jpg/220px-Linus_Torvalds_-_Linuxcon2011.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Linus_Torvalds_%28cropped%29.jpg/220px-Linus_Torvalds_%28cropped%29.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Linus_in_SCUBA_gear.jpg/220px-Linus_in_SCUBA_gear.jpg",
]


def quote(request):
    template = 'quotes/quote.html'
    context = {
        'quote': random.choice(QUOTES),
        'image': random.choice(IMAGES),
    }
    return render(request, template, context)

def show_all(request):
    template = 'quotes/show_all.html'
    context = {
        'quotes': QUOTES,
        'images': IMAGES,
    }
    return render(request, template, context)

def about(request):
    template = 'quotes/about.html'
    context = {
        'person_name': 'Linus Torvalds',
        'Biography': 'Linus Torvolds is a Finnish-American software engineer born on December 28, 1969. He is the creator and principal developer of the Linux kernel, which became the kernel for many Linux distributions and operating systems such as Android and Chrome OS. Torvalds also created the distributed version control system Git, which is widely used in software development. He has received numerous awards for his contributions to computing, including the Millennium Technology Prize in 2012.',
        'creator_note': 'This web app was developed by Gabriel Ginsberg, a student at Boston University, as part of a CS412 course assignment.',
    }
    return render(request, template, context)