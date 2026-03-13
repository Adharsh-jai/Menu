/* ═══════════════════════════════════════════════════════════════
   La Maison — User Menu Script
   ═══════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    const categoryTabs  = document.getElementById('categoryTabs');
    const menuContainer = document.getElementById('menuContainer');
    const emptyState    = document.getElementById('emptyState');
    const viewSwitcher  = document.getElementById('viewSwitcher');
    const searchInput   = document.getElementById('searchInput');
    const searchClear   = document.getElementById('searchClear');

    let allCategories = [];
    let activeFilter  = 'all';
    let currentView   = 'list'; // 'list' | 'medium' | 'large'
    let searchQuery   = '';

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
        // keep the "All" button, clear the rest
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

        // filter out cats with no items; also apply search filter
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

            // Category heading
            let titleHTML = `<h3 class="menu-category-title">`;
            if (cat.image) {
                titleHTML += `<img src="${cat.image}" alt="" class="cat-img">`;
            }
            titleHTML += `${escHtml(cat.name)}</h3>`;
            section.innerHTML = titleHTML;

            // Items grid
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

                card.innerHTML = `
                    ${imgHtml}
                    <div class="menu-card-body">
                        <div class="menu-card-name">${escHtml(item.name)}</div>
                        <div class="menu-card-desc">${escHtml(item.description)}</div>
                        <div class="menu-card-footer">
                            <span class="menu-card-price">₹${Number(item.price).toFixed(2)}</span>
                            ${availBadge}
                        </div>
                    </div>`;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });
    }

    // ─── Helpers ─────────────────────────────────────────────

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ─── Init ────────────────────────────────────────────────

    loadMenu();
})();
