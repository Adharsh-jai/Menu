import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename

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


# ─── Boot ─────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
