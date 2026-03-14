import json
from app import app, Category

with app.app_context():
    categories = Category.query.order_by(Category.name).all()
    data = [c.to_dict() for c in categories]
    
    # Optional: adjust image paths in JSON from /static/... to ./static/...
    for cat in data:
        if cat.get('image') and cat['image'].startswith('/static/'):
            cat['image'] = '.' + cat['image']
        for item in cat.get('items', []):
            if item.get('image') and item['image'].startswith('/static/'):
                item['image'] = '.' + item['image']
                
    with open('frontend_export/static/menu.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
