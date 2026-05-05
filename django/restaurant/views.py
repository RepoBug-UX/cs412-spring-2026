from django.shortcuts import render
from django.utils import timezone
from datetime import timedelta
import random
from zoneinfo import ZoneInfo

DAILY_SPECIALS = [
    {'name': 'Halibut', 'description': 'Fresh halibut with lemon butter sauce', 'price': 31.99, 'image': 'https://d2uqlwridla7kt.cloudfront.net/recipe-media/recipe-9kvlgjoyp/121gunhy8lg1acnzh/pan-fried-halibut-re-edited-jpg'},
    {'name': 'Swordfish', 'description': 'Grilled swordfish with herbs', 'price': 34.99, 'image': 'https://www.foodandwine.com/thmb/FFQudXXajnpgl8qrdRobFvo6g9U=/750x0/filters:no_upscale():max_bytes(150000):strip_icc()/200606-xl-grilled-swordfish-steaks-with-basil-caper-butter-2000-f57f72dc9d8446edb0e59bec5778df95.jpg'},
    {'name': 'Mahi-Mahi', 'description': 'Tender mahi-mahi with lemongras aioli', 'price': 32.99, 'image': 'https://www.foodandwine.com/thmb/Ur4ZyPcrpyb69a4Ely5I_FeAFh0=/750x0/filters:no_upscale():max_bytes(150000):strip_icc()/Grilled-Mahi-Mahi-with-Lemongrass-Lime-Aioli-FT-RECIPE0622-519e4b3112824fb7a4e84226be03ad53.jpg'},
]

MENU_PRICES = {
    'Clam Chowder': 13.99,
    'Crab Cakes': 26.99,
    'Scallops': 31.99,
    'Shrimp Scampi': 22.99,
}


def main(request):
    template = 'restaurant/main.html'
    return render(request, template)

def order(request):
    template = 'restaurant/order.html'
    context = {
        'daily_special': random.choice(DAILY_SPECIALS),
    }
    return render(request, template, context)

def confirmation(request):
    template = 'restaurant/confirmation.html'
    
    # Get form data
    items = request.POST.getlist('item')  # List of selected items
    customer_name = request.POST.get('name', '')
    customer_phone = request.POST.get('phone', '')
    customer_email = request.POST.get('email', '')
    special_instructions = request.POST.get('special_instructions', '')
    crab_sauce = request.POST.get('crab_cakes_sauce', '')
    
    # Build ordered items list with prices
    ordered_items = []
    total_price = 0
    
    for item in items:
        if item in MENU_PRICES:
            price = MENU_PRICES[item]
        else:
            # It's the daily special - look for its price in DAILY_SPECIALS
            price = None
            for special in DAILY_SPECIALS:
                if special['name'] == item:
                    price = special['price']
                    break
            if price is None:
                price = 0
        
        # Add sauce info if crab cakes was ordered
        sauce_text = ''
        if item == 'Crab Cakes' and crab_sauce:
            sauce_text = f' ({crab_sauce})'
        
        ordered_items.append({
            'name': item + sauce_text,
            'price': price
        })
        total_price += price
    
    # Calculate ready time: current time + random 30-60 minutes
    global_time = timezone.now()
    local_time = global_time.astimezone(ZoneInfo('America/New_York'))
    ready_time = local_time + timedelta(minutes=random.randint(30, 60))
    ready_time_str = ready_time.strftime('%I:%M %p')
    
    context = {
        'items': ordered_items,
        'total': f'{total_price:.2f}',
        'name': customer_name,
        'phone': customer_phone,
        'email': customer_email,
        'special_instructions': special_instructions,
        'ready_time': ready_time_str,
    }
    
    return render(request, template, context)