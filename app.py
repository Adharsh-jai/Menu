import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from sqlalchemy import func

app = Flask(__name__)
app.secret_key = 'restaurant-secret-key-change-in-production'

# Database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'restaurant.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Upload config
UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# Admin password (change this!)
ADMIN_PASSWORD = 'admin123'

# ─── Models ───────────────────────────────────────────────────────────

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.String(300), default='')
    image = db.Column(db.String(300), default='')
    items = db.relationship('MenuItem', backref='category', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'image': self.image,
            'items': [item.to_dict() for item in self.items]
        }


class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(500), default='')
    price = db.Column(db.Float, nullable=False)
    image = db.Column(db.String(300), default='')
    is_available = db.Column(db.Boolean, default=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'image': self.image,
            'is_available': self.is_available,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else ''
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(150), nullable=False)
    customer_phone = db.Column(db.String(20), default='')
    status = db.Column(db.String(30), default='pending')  # pending, preparing, ready, completed, cancelled
    total = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'status': self.status,
            'total': self.total,
            'created_at': self.created_at.isoformat(),
            'items': [oi.to_dict() for oi in self.items]
        }


class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_item.id'), nullable=False)
    item_name = db.Column(db.String(150), nullable=False)
    item_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, default=1)

    menu_item = db.relationship('MenuItem')

    def to_dict(self):
        return {
            'id': self.id,
            'menu_item_id': self.menu_item_id,
            'item_name': self.item_name,
            'item_price': self.item_price,
            'quantity': self.quantity,
            'subtotal': self.item_price * self.quantity
        }


# ─── Helpers ──────────────────────────────────────────────────────────

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload(file_field):
    """Save uploaded file, return relative URL path or empty string."""
    if file_field and file_field.filename and allowed_file(file_field.filename):
        filename = secure_filename(file_field.filename)
        # Add a timestamp to avoid name collisions
        import time
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(time.time())}{ext}"
        file_field.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        return f'/static/uploads/{filename}'
    return ''


def admin_required(f):
    """Simple admin auth decorator."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


# ─── Page Routes ──────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/admin')
def admin_page():
    return render_template('admin.html')


# ─── Auth Routes ──────────────────────────────────────────────────────

@app.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if data and data.get('password') == ADMIN_PASSWORD:
        session['admin_logged_in'] = True
        return jsonify({'success': True})
    return jsonify({'error': 'Invalid password'}), 401


@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.pop('admin_logged_in', None)
    return jsonify({'success': True})


# ─── Public API ───────────────────────────────────────────────────────

@app.route('/api/menu')
def get_menu():
    categories = Category.query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in categories])


# ─── Admin: Categories ───────────────────────────────────────────────

@app.route('/admin/categories', methods=['GET'])
@admin_required
def list_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([{'id': c.id, 'name': c.name, 'description': c.description, 'image': c.image} for c in cats])


@app.route('/admin/categories', methods=['POST'])
@admin_required
def create_category():
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    if Category.query.filter_by(name=name).first():
        return jsonify({'error': 'Category already exists'}), 400
    image = save_upload(request.files.get('image'))
    cat = Category(name=name, description=description, image=image)
    db.session.add(cat)
    db.session.commit()
    return jsonify({'id': cat.id, 'name': cat.name, 'description': cat.description, 'image': cat.image}), 201


@app.route('/admin/categories/<int:cat_id>', methods=['PUT'])
@admin_required
def update_category(cat_id):
    cat = Category.query.get_or_404(cat_id)
    cat.name = request.form.get('name', cat.name).strip()
    cat.description = request.form.get('description', cat.description).strip()
    new_image = save_upload(request.files.get('image'))
    if new_image:
        cat.image = new_image
    db.session.commit()
    return jsonify({'id': cat.id, 'name': cat.name, 'description': cat.description, 'image': cat.image})


@app.route('/admin/categories/<int:cat_id>', methods=['DELETE'])
@admin_required
def delete_category(cat_id):
    cat = Category.query.get_or_404(cat_id)
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True})


# ─── Admin: Menu Items ───────────────────────────────────────────────

@app.route('/admin/items', methods=['GET'])
@admin_required
def list_items():
    items = MenuItem.query.order_by(MenuItem.name).all()
    return jsonify([i.to_dict() for i in items])


@app.route('/admin/items', methods=['POST'])
@admin_required
def create_item():
    name = request.form.get('name', '').strip()
    description = request.form.get('description', '').strip()
    price = request.form.get('price', 0)
    category_id = request.form.get('category_id')
    is_available = request.form.get('is_available', 'true') == 'true'

    if not name or not category_id:
        return jsonify({'error': 'Name and category are required'}), 400

    try:
        price = float(price)
    except ValueError:
        return jsonify({'error': 'Invalid price'}), 400

    cat = Category.query.get(int(category_id))
    if not cat:
        return jsonify({'error': 'Category not found'}), 404

    image = save_upload(request.files.get('image'))
    item = MenuItem(name=name, description=description, price=price, image=image,
                    is_available=is_available, category_id=cat.id)
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@app.route('/admin/items/<int:item_id>', methods=['PUT'])
@admin_required
def update_item(item_id):
    item = MenuItem.query.get_or_404(item_id)
    item.name = request.form.get('name', item.name).strip()
    item.description = request.form.get('description', item.description).strip()

    price = request.form.get('price')
    if price is not None:
        try:
            item.price = float(price)
        except ValueError:
            pass

    category_id = request.form.get('category_id')
    if category_id:
        cat = Category.query.get(int(category_id))
        if cat:
            item.category_id = cat.id

    is_available = request.form.get('is_available')
    if is_available is not None:
        item.is_available = is_available == 'true'

    new_image = save_upload(request.files.get('image'))
    if new_image:
        item.image = new_image

    db.session.commit()
    return jsonify(item.to_dict())


@app.route('/admin/items/<int:item_id>', methods=['DELETE'])
@admin_required
def delete_item(item_id):
    item = MenuItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'success': True})


# ─── Public: Orders ──────────────────────────────────────────────────

@app.route('/api/orders', methods=['POST'])
def place_order():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request'}), 400

    customer_name = (data.get('customer_name') or '').strip()
    customer_phone = (data.get('customer_phone') or '').strip()
    cart_items = data.get('items', [])

    if not customer_name:
        return jsonify({'error': 'Name is required'}), 400
    if not cart_items:
        return jsonify({'error': 'Cart is empty'}), 400

    order = Order(customer_name=customer_name, customer_phone=customer_phone)
    total = 0

    for ci in cart_items:
        mi = MenuItem.query.get(ci.get('id'))
        if not mi:
            continue
        qty = max(1, int(ci.get('quantity', 1)))
        oi = OrderItem(item_name=mi.name, item_price=mi.price, quantity=qty, menu_item_id=mi.id)
        order.items.append(oi)
        total += mi.price * qty

    if not order.items:
        return jsonify({'error': 'No valid items'}), 400

    order.total = total
    db.session.add(order)
    db.session.commit()
    return jsonify({'success': True, 'order_id': order.id, 'total': order.total}), 201


# ─── Admin: Orders ───────────────────────────────────────────────────

@app.route('/admin/orders', methods=['GET'])
@admin_required
def list_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders])


@app.route('/admin/orders/<int:order_id>', methods=['PUT'])
@admin_required
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    new_status = data.get('status', '').strip()
    if new_status in ('pending', 'preparing', 'ready', 'completed', 'cancelled'):
        order.status = new_status
        db.session.commit()
    return jsonify(order.to_dict())


# ─── Admin: Analytics ────────────────────────────────────────────────

@app.route('/admin/analytics', methods=['GET'])
@admin_required
def get_analytics():
    today = datetime.utcnow().date()
    start_of_day = datetime.combine(today, datetime.min.time())

    # Today's orders
    today_orders = Order.query.filter(Order.created_at >= start_of_day).all()
    today_revenue = sum(o.total for o in today_orders if o.status != 'cancelled')
    today_count = len([o for o in today_orders if o.status != 'cancelled'])
    cancelled_count = len([o for o in today_orders if o.status == 'cancelled'])

    # Last 7 days revenue
    daily_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        orders_day = Order.query.filter(
            Order.created_at >= day_start,
            Order.created_at < day_end,
            Order.status != 'cancelled'
        ).all()
        daily_data.append({
            'date': day.isoformat(),
            'label': day.strftime('%a'),
            'revenue': sum(o.total for o in orders_day),
            'orders': len(orders_day)
        })

    # Popular items (all time)
    popular = db.session.query(
        OrderItem.item_name,
        func.sum(OrderItem.quantity).label('total_qty'),
        func.sum(OrderItem.item_price * OrderItem.quantity).label('total_revenue')
    ).group_by(OrderItem.item_name).order_by(func.sum(OrderItem.quantity).desc()).limit(10).all()

    popular_items = [{'name': p[0], 'quantity': int(p[1]), 'revenue': float(p[2])} for p in popular]

    # Status breakdown today
    status_counts = {}
    for o in today_orders:
        status_counts[o.status] = status_counts.get(o.status, 0) + 1

    return jsonify({
        'today': {
            'revenue': today_revenue,
            'orders': today_count,
            'cancelled': cancelled_count
        },
        'weekly': daily_data,
        'popular_items': popular_items,
        'status_breakdown': status_counts
    })


# ─── Boot ─────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
