/* ═══════════════════════════════════════════════════════════════
   La Maison — Admin Dashboard Script
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ─── DOM refs ────────────────────────────────────────────

    const loginOverlay  = document.getElementById('loginOverlay');
    const loginForm     = document.getElementById('loginForm');
    const loginPassword = document.getElementById('loginPassword');
    const loginError    = document.getElementById('loginError');
    const dashboard     = document.getElementById('dashboard');

    const navCategories = document.getElementById('navCategories');
    const navItems      = document.getElementById('navItems');
    const navOrders     = document.getElementById('navOrders');
    const navAnalytics  = document.getElementById('navAnalytics');
    const panelTitle    = document.getElementById('panelTitle');
    const panelCats     = document.getElementById('panelCategories');
    const panelItems    = document.getElementById('panelItems');
    const panelOrders   = document.getElementById('panelOrders');
    const panelAnalytics= document.getElementById('panelAnalytics');
    const addNewBtn     = document.getElementById('addNewBtn');
    const logoutBtn     = document.getElementById('logoutBtn');

    const categoriesBody = document.getElementById('categoriesBody');
    const itemsBody      = document.getElementById('itemsBody');
    const ordersBody     = document.getElementById('ordersBody');
    const popularBody    = document.getElementById('popularBody');
    const emptyCats      = document.getElementById('emptyCats');
    const emptyItems     = document.getElementById('emptyItems');
    const emptyOrders    = document.getElementById('emptyOrders');
    const emptyPopular   = document.getElementById('emptyPopular');

    const modal       = document.getElementById('modal');
    const modalTitle  = document.getElementById('modalTitle');
    const modalFields = document.getElementById('modalFields');
    const modalForm   = document.getElementById('modalForm');
    const modalClose  = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');

    const toastContainer = document.getElementById('toastContainer');

    let currentPanel = 'categories';
    let categories   = [];
    let items        = [];
    let orders       = [];
    let editingId    = null;

    // ─── Auth ────────────────────────────────────────────────

    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        loginError.classList.add('hidden');
        try {
            const res = await fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: loginPassword.value })
            });
            if (res.ok) {
                loginOverlay.classList.add('hidden');
                dashboard.classList.remove('hidden');
                loadData();
            } else {
                loginError.classList.remove('hidden');
            }
        } catch {
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await fetch('/admin/logout', { method: 'POST' });
        location.reload();
    });

    // ─── Navigation ──────────────────────────────────────────

    const panels = {
        categories: { nav: navCategories, el: panelCats,      title: 'Categories',  showAdd: true  },
        items:      { nav: navItems,      el: panelItems,     title: 'Menu Items',  showAdd: true  },
        orders:     { nav: navOrders,     el: panelOrders,    title: 'Orders',      showAdd: false },
        analytics:  { nav: navAnalytics,  el: panelAnalytics, title: 'Analytics',   showAdd: false }
    };

    Object.keys(panels).forEach(key => {
        panels[key].nav.addEventListener('click', () => switchPanel(key));
    });

    function switchPanel(panel) {
        currentPanel = panel;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        Object.keys(panels).forEach(k => panels[k].el.classList.add('hidden'));

        const p = panels[panel];
        p.nav.classList.add('active');
        p.el.classList.remove('hidden');
        panelTitle.textContent = p.title;
        addNewBtn.style.display = p.showAdd ? '' : 'none';

        if (panel === 'orders') loadOrders();
        if (panel === 'analytics') loadAnalytics();
    }

    // ─── Data loading ────────────────────────────────────────

    async function loadData() {
        await Promise.all([loadCategories(), loadItems()]);
    }

    async function loadCategories() {
        try {
            const res = await fetch('/admin/categories');
            categories = await res.json();
            renderCategories();
        } catch { toast('Failed to load categories', 'error'); }
    }

    async function loadItems() {
        try {
            const res = await fetch('/admin/items');
            items = await res.json();
            renderItems();
        } catch { toast('Failed to load items', 'error'); }
    }

    async function loadOrders() {
        try {
            const res = await fetch('/admin/orders');
            orders = await res.json();
            renderOrders();
        } catch { toast('Failed to load orders', 'error'); }
    }

    async function loadAnalytics() {
        try {
            const res = await fetch('/admin/analytics');
            const data = await res.json();
            renderAnalytics(data);
        } catch { toast('Failed to load analytics', 'error'); }
    }

    // ─── Render Categories ───────────────────────────────────

    function renderCategories() {
        if (categories.length === 0) { categoriesBody.innerHTML = ''; emptyCats.classList.remove('hidden'); return; }
        emptyCats.classList.add('hidden');
        categoriesBody.innerHTML = categories.map(c => `
            <tr>
                <td>${c.image ? `<img src="${c.image}" class="thumb" alt="">` : `<div class="thumb-placeholder">📂</div>`}</td>
                <td><strong>${esc(c.name)}</strong></td>
                <td style="color:var(--text-muted);max-width:250px">${esc(c.description || '—')}</td>
                <td><div class="actions-cell">
                    <button class="btn-icon" title="Edit" onclick="Admin.editCategory(${c.id})">✏️</button>
                    <button class="btn-icon delete" title="Delete" onclick="Admin.deleteCategory(${c.id})">🗑️</button>
                </div></td>
            </tr>`).join('');
    }

    // ─── Render Items ────────────────────────────────────────

    function renderItems() {
        if (items.length === 0) { itemsBody.innerHTML = ''; emptyItems.classList.remove('hidden'); return; }
        emptyItems.classList.add('hidden');
        itemsBody.innerHTML = items.map(i => `
            <tr>
                <td>${i.image ? `<img src="${i.image}" class="thumb" alt="">` : `<div class="thumb-placeholder">🍕</div>`}</td>
                <td><strong>${esc(i.name)}</strong><br><small style="color:var(--text-muted)">${esc(truncate(i.description, 50))}</small></td>
                <td>${esc(i.category_name)}</td>
                <td>₹${Number(i.price).toFixed(2)}</td>
                <td><span class="badge-avail ${i.is_available ? 'yes' : 'no'}">${i.is_available ? 'Yes' : 'No'}</span></td>
                <td><div class="actions-cell">
                    <button class="btn-icon" title="Edit" onclick="Admin.editItem(${i.id})">✏️</button>
                    <button class="btn-icon delete" title="Delete" onclick="Admin.deleteItem(${i.id})">🗑️</button>
                </div></td>
            </tr>`).join('');
    }

    // ─── Render Orders ───────────────────────────────────────

    function renderOrders() {
        if (orders.length === 0) { ordersBody.innerHTML = ''; emptyOrders.classList.remove('hidden'); return; }
        emptyOrders.classList.add('hidden');
        ordersBody.innerHTML = orders.map(o => {
            const itemsList = o.items.map(oi => `${oi.item_name} ×${oi.quantity}`).join(', ');
            const dt = new Date(o.created_at);
            const timeStr = dt.toLocaleString();
            const statuses = ['pending','preparing','ready','completed','cancelled'];
            const opts = statuses.map(s =>
                `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
            ).join('');
            return `<tr>
                <td><strong>#${o.id}</strong></td>
                <td><strong>${esc(o.customer_name)}</strong>${o.customer_phone ? `<br><small style="color:var(--text-muted)">${esc(o.customer_phone)}</small>` : ''}</td>
                <td><span class="order-items-list">${esc(itemsList)}</span></td>
                <td><strong>₹${Number(o.total).toFixed(2)}</strong></td>
                <td><select class="status-select s-${o.status}" onchange="Admin.updateOrderStatus(${o.id}, this.value)">${opts}</select></td>
                <td style="color:var(--text-muted);font-size:.82rem">${timeStr}</td>
            </tr>`;
        }).join('');
    }

    // ─── Render Analytics ────────────────────────────────────

    function renderAnalytics(data) {
        // stat cards
        document.getElementById('statRevenue').textContent = `₹${Number(data.today.revenue).toFixed(2)}`;
        document.getElementById('statOrders').textContent = data.today.orders;
        document.getElementById('statCancelled').textContent = data.today.cancelled;

        // weekly bar chart
        const chart = document.getElementById('weeklyChart');
        const maxRev = Math.max(...data.weekly.map(d => d.revenue), 1);
        chart.innerHTML = data.weekly.map(d => {
            const pct = Math.round((d.revenue / maxRev) * 100);
            return `<div class="chart-bar">
                <div class="chart-bar-value">₹${Math.round(d.revenue)}</div>
                <div class="chart-bar-fill" style="height:${Math.max(pct, 3)}%"></div>
                <div class="chart-bar-label">${d.label}<br><small>${d.orders} ord</small></div>
            </div>`;
        }).join('');

        // popular items
        if (data.popular_items.length === 0) {
            popularBody.innerHTML = '';
            emptyPopular.classList.remove('hidden');
        } else {
            emptyPopular.classList.add('hidden');
            popularBody.innerHTML = data.popular_items.map(p => `
                <tr>
                    <td><strong>${esc(p.name)}</strong></td>
                    <td>${p.quantity}</td>
                    <td>₹${Number(p.revenue).toFixed(2)}</td>
                </tr>`).join('');
        }
    }

    // ─── Add New button ──────────────────────────────────────

    addNewBtn.addEventListener('click', () => {
        editingId = null;
        if (currentPanel === 'categories') openCategoryModal();
        else if (currentPanel === 'items') openItemModal();
    });

    // ─── Category Modal ──────────────────────────────────────

    function openCategoryModal(cat = null) {
        editingId = cat ? cat.id : null;
        modalTitle.textContent = cat ? 'Edit Category' : 'Add Category';
        modalFields.innerHTML = `
            <div class="form-group">
                <label for="catName">Name</label>
                <input class="form-input" id="catName" name="name" placeholder="e.g. Appetizers" required value="${cat ? esc(cat.name) : ''}">
            </div>
            <div class="form-group">
                <label for="catDesc">Description</label>
                <textarea class="form-input" id="catDesc" name="description" placeholder="Optional description">${cat ? esc(cat.description) : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Image</label>
                <div class="file-input-wrap"><input type="file" name="image" accept="image/*" id="catImage"></div>
                ${cat && cat.image ? `<img src="${cat.image}" class="img-preview" id="catPreview">` : ''}
            </div>`;
        setupImagePreview('catImage', 'catPreview');
        openModal();
    }

    // ─── Item Modal ──────────────────────────────────────────

    function openItemModal(item = null) {
        editingId = item ? item.id : null;
        modalTitle.textContent = item ? 'Edit Menu Item' : 'Add Menu Item';
        const catOptions = categories.map(c =>
            `<option value="${c.id}" ${item && item.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
        ).join('');
        modalFields.innerHTML = `
            <div class="form-group">
                <label for="itemName">Name</label>
                <input class="form-input" id="itemName" name="name" placeholder="e.g. Margherita Pizza" required value="${item ? esc(item.name) : ''}">
            </div>
            <div class="form-group">
                <label for="itemDesc">Description</label>
                <textarea class="form-input" id="itemDesc" name="description" placeholder="Describe the dish">${item ? esc(item.description) : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="itemPrice">Price (₹)</label>
                <input class="form-input" type="number" step="0.01" min="0" id="itemPrice" name="price" required value="${item ? item.price : ''}">
            </div>
            <div class="form-group">
                <label for="itemCat">Category</label>
                <select class="form-input" id="itemCat" name="category_id" required>
                    <option value="" disabled ${!item ? 'selected' : ''}>Select a category</option>
                    ${catOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="itemAvail">Available</label>
                <select class="form-input" id="itemAvail" name="is_available">
                    <option value="true" ${!item || item.is_available ? 'selected' : ''}>Yes</option>
                    <option value="false" ${item && !item.is_available ? 'selected' : ''}>No</option>
                </select>
            </div>
            <div class="form-group">
                <label>Image</label>
                <div class="file-input-wrap"><input type="file" name="image" accept="image/*" id="itemImage"></div>
                ${item && item.image ? `<img src="${item.image}" class="img-preview" id="itemPreview">` : ''}
            </div>`;
        setupImagePreview('itemImage', 'itemPreview');
        openModal();
    }

    // ─── Image preview ───────────────────────────────────────

    function setupImagePreview(inputId, previewId) {
        setTimeout(() => {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.addEventListener('change', e => {
                const file = e.target.files[0];
                if (!file) return;
                let preview = document.getElementById(previewId);
                if (!preview) {
                    preview = document.createElement('img');
                    preview.id = previewId;
                    preview.className = 'img-preview';
                    input.parentElement.parentElement.appendChild(preview);
                }
                preview.src = URL.createObjectURL(file);
            });
        }, 50);
    }

    // ─── Modal controls ──────────────────────────────────────

    function openModal() { modal.classList.remove('hidden'); }
    function closeModal() { modal.classList.add('hidden'); editingId = null; }

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    // ─── Form submit ─────────────────────────────────────────

    modalForm.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = new FormData(modalForm);
        let url, method;
        if (currentPanel === 'categories') {
            url = editingId ? `/admin/categories/${editingId}` : '/admin/categories';
            method = editingId ? 'PUT' : 'POST';
        } else {
            url = editingId ? `/admin/items/${editingId}` : '/admin/items';
            method = editingId ? 'PUT' : 'POST';
        }
        try {
            const res = await fetch(url, { method, body: fd });
            const data = await res.json();
            if (!res.ok) { toast(data.error || 'Something went wrong', 'error'); return; }
            toast(editingId ? 'Updated successfully!' : 'Created successfully!', 'success');
            closeModal();
            loadData();
        } catch { toast('Network error', 'error'); }
    });

    // ─── CRUD helpers exposed globally ───────────────────────

    window.Admin = {
        editCategory(id) {
            const cat = categories.find(c => c.id === id);
            if (cat) openCategoryModal(cat);
        },
        async deleteCategory(id) {
            if (!confirm('Delete this category and ALL its items?')) return;
            try {
                const res = await fetch(`/admin/categories/${id}`, { method: 'DELETE' });
                if (res.ok) { toast('Category deleted', 'info'); loadData(); }
            } catch { toast('Failed to delete', 'error'); }
        },
        editItem(id) {
            const item = items.find(i => i.id === id);
            if (item) openItemModal(item);
        },
        async deleteItem(id) {
            if (!confirm('Delete this menu item?')) return;
            try {
                const res = await fetch(`/admin/items/${id}`, { method: 'DELETE' });
                if (res.ok) { toast('Item deleted', 'info'); loadData(); }
            } catch { toast('Failed to delete', 'error'); }
        },
        async updateOrderStatus(id, status) {
            try {
                await fetch(`/admin/orders/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                toast('Status updated', 'success');
                loadOrders();
            } catch { toast('Failed to update', 'error'); }
        }
    };

    // ─── Toast ───────────────────────────────────────────────

    function toast(msg, type = 'info') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icons = { success: '✓', error: '✗', info: 'ℹ' };
        el.innerHTML = `<span>${icons[type] || ''}</span> ${esc(msg)}`;
        toastContainer.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
    }

    // ─── Util ────────────────────────────────────────────────

    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

})();
