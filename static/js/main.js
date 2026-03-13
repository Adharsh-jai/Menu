/* ═══════════════════════════════════════════════════════════════
   La Maison — User Menu Script with Cart & Orders
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const categoryTabs  = document.getElementById('categoryTabs');
    const menuContainer = document.getElementById('menuContainer');
    const emptyState    = document.getElementById('emptyState');
    const viewSwitcher  = document.getElementById('viewSwitcher');
    const searchInput   = document.getElementById('searchInput');
    const searchClear   = document.getElementById('searchClear');

    // Cart DOM
    const cartFab       = document.getElementById('cartFab');
    const cartBadge     = document.getElementById('cartBadge');
    const cartOverlay   = document.getElementById('cartOverlay');
    const cartClose     = document.getElementById('cartClose');
    const cartItemsEl   = document.getElementById('cartItems');
    const cartEmptyEl   = document.getElementById('cartEmpty');
    const cartFooter    = document.getElementById('cartFooter');
    const cartTotalEl   = document.getElementById('cartTotal');
    const placeOrderBtn = document.getElementById('placeOrderBtn');
    const custName      = document.getElementById('custName');
    const custPhone     = document.getElementById('custPhone');

    // Order success
    const orderSuccess  = document.getElementById('orderSuccess');
    const orderIdDisp   = document.getElementById('orderIdDisplay');
    const orderTotalDisp= document.getElementById('orderTotalDisplay');
    const successClose  = document.getElementById('successClose');

    let allCategories = [];
    let activeFilter  = 'all';
    let currentView   = 'list';
    let searchQuery   = '';
    let cart           = [];  // [{id, name, price, quantity}]

    // ─── Search ──────────────────────────────────────────────

    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        searchClear.classList.toggle('hidden', !searchQuery);
        renderMenu();
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.classList.add('hidden');
        renderMenu();
    });

    // ─── View switcher ───────────────────────────────────────

    viewSwitcher.addEventListener('click', e => {
        const btn = e.target.closest('.view-btn');
        if (!btn) return;
        viewSwitcher.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderMenu();
    });

    // ─── Fetch menu data ─────────────────────────────────────

    async function loadMenu() {
        try {
            const res = await fetch('/api/menu');
            allCategories = await res.json();
            buildTabs();
            renderMenu();
        } catch (err) {
            console.error('Failed to load menu:', err);
            emptyState.classList.remove('hidden');
        }
    }

    // ─── Build category tabs ─────────────────────────────────

    function buildTabs() {
        categoryTabs.innerHTML = '<button class="cat-tab active" data-cat="all">All</button>';
        allCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-tab';
            btn.dataset.cat = cat.id;
            btn.textContent = cat.name;
            categoryTabs.appendChild(btn);
        });

        categoryTabs.addEventListener('click', e => {
            const tab = e.target.closest('.cat-tab');
            if (!tab) return;
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.cat;
            renderMenu();
        });
    }

    // ─── Render menu items ───────────────────────────────────

    function renderMenu() {
        menuContainer.innerHTML = '';

        const cats = activeFilter === 'all'
            ? allCategories
            : allCategories.filter(c => String(c.id) === String(activeFilter));

        const visibleCats = cats.map(c => {
            let items = c.items || [];
            if (searchQuery) {
                items = items.filter(i =>
                    i.name.toLowerCase().includes(searchQuery) ||
                    (i.description && i.description.toLowerCase().includes(searchQuery))
                );
            }
            return { ...c, items };
        }).filter(c => c.items.length > 0);

        if (visibleCats.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        visibleCats.forEach((cat, ci) => {
            const section = document.createElement('div');
            section.className = 'menu-category';
            section.style.animationDelay = `${ci * 0.08}s`;

            let titleHTML = `<h3 class="menu-category-title">`;
            if (cat.image) {
                titleHTML += `<img src="${cat.image}" alt="" class="cat-img">`;
            }
            titleHTML += `${escHtml(cat.name)}</h3>`;
            section.innerHTML = titleHTML;

            const grid = document.createElement('div');
            grid.className = `items-grid view-${currentView}`;

            cat.items.forEach((item, ii) => {
                const card = document.createElement('div');
                card.className = 'menu-card';
                card.style.animationDelay = `${ci * 0.08 + ii * 0.06}s`;

                const imgHtml = item.image
                    ? `<img class="menu-card-img" src="${item.image}" alt="${escHtml(item.name)}">`
                    : `<div class="placeholder-img">🍽️</div>`;

                const availBadge = item.is_available
                    ? `<span class="menu-card-badge">Available</span>`
                    : `<span class="menu-card-badge unavailable">Sold Out</span>`;

                const orderBtn = item.is_available
                    ? `<button class="btn-add-cart" data-id="${item.id}" data-name="${escHtml(item.name)}" data-price="${item.price}">+ Add</button>`
                    : '';

                card.innerHTML = `
                    ${imgHtml}
                    <div class="menu-card-body">
                        <div class="menu-card-name">${escHtml(item.name)}</div>
                        <div class="menu-card-desc">${escHtml(item.description)}</div>
                        <div class="menu-card-footer">
                            <span class="menu-card-price">₹${Number(item.price).toFixed(2)}</span>
                            ${availBadge}
                            ${orderBtn}
                        </div>
                    </div>`;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });
    }

    // ─── Add to cart (delegated click) ───────────────────────

    document.addEventListener('click', e => {
        const btn = e.target.closest('.btn-add-cart');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        const name = btn.dataset.name;
        const price = Number(btn.dataset.price);
        addToCart(id, name, price);
    });

    function addToCart(id, name, price) {
        const existing = cart.find(c => c.id === id);
        if (existing) {
            existing.quantity++;
        } else {
            cart.push({ id, name, price, quantity: 1 });
        }
        updateCartUI();
    }

    function removeFromCart(id) {
        cart = cart.filter(c => c.id !== id);
        updateCartUI();
    }

    function changeQty(id, delta) {
        const item = cart.find(c => c.id === id);
        if (!item) return;
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(id);
            return;
        }
        updateCartUI();
    }

    function updateCartUI() {
        const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
        const count = cart.reduce((s, c) => s + c.quantity, 0);

        // FAB
        cartFab.classList.toggle('hidden', count === 0);
        cartBadge.textContent = count;

        // Cart items list
        if (cart.length === 0) {
            cartItemsEl.classList.add('hidden');
            cartEmptyEl.classList.remove('hidden');
            cartFooter.classList.add('hidden');
        } else {
            cartItemsEl.classList.remove('hidden');
            cartEmptyEl.classList.add('hidden');
            cartFooter.classList.remove('hidden');
            cartItemsEl.innerHTML = cart.map(c => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${escHtml(c.name)}</div>
                        <div class="cart-item-price">₹${(c.price * c.quantity).toFixed(2)}</div>
                    </div>
                    <div class="cart-qty">
                        <button onclick="CartActions.changeQty(${c.id}, -1)">−</button>
                        <span>${c.quantity}</span>
                        <button onclick="CartActions.changeQty(${c.id}, 1)">+</button>
                    </div>
                    <button class="cart-item-remove" onclick="CartActions.remove(${c.id})">✕</button>
                </div>`).join('');
        }

        cartTotalEl.textContent = `₹${total.toFixed(2)}`;
    }

    // Expose cart actions globally for onclick handlers
    window.CartActions = {
        remove: removeFromCart,
        changeQty: changeQty
    };

    // ─── Cart drawer toggle ──────────────────────────────────

    cartFab.addEventListener('click', () => cartOverlay.classList.remove('hidden'));
    cartClose.addEventListener('click', () => cartOverlay.classList.add('hidden'));
    cartOverlay.addEventListener('click', e => {
        if (e.target === cartOverlay) cartOverlay.classList.add('hidden');
    });

    // ─── Place order ─────────────────────────────────────────

    placeOrderBtn.addEventListener('click', async () => {
        const name = custName.value.trim();
        if (!name) {
            custName.style.borderColor = '#ff5050';
            custName.focus();
            return;
        }
        custName.style.borderColor = '';

        if (cart.length === 0) return;

        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Placing...';

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: name,
                    customer_phone: custPhone.value.trim(),
                    items: cart.map(c => ({ id: c.id, quantity: c.quantity }))
                })
            });
            const data = await res.json();
            if (res.ok) {
                // Success
                orderIdDisp.textContent = data.order_id;
                orderTotalDisp.textContent = `₹${Number(data.total).toFixed(2)}`;
                cart = [];
                custName.value = '';
                custPhone.value = '';
                updateCartUI();
                cartOverlay.classList.add('hidden');
                orderSuccess.classList.remove('hidden');
            } else {
                alert(data.error || 'Failed to place order');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Place Order';
        }
    });

    successClose.addEventListener('click', () => orderSuccess.classList.add('hidden'));

    // ─── Helpers ─────────────────────────────────────────────

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ─── Init ────────────────────────────────────────────────

    loadMenu();
})();
