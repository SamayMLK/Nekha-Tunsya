/* =========================================================
   NEKHA TUNSYA — App JS
   - Charge recipes.json
   - Rend la grille de cartes (avec filtres + recherche + favoris)
   - Rend une page recette quand ?id=xxx est présent
   ========================================================= */

const STORAGE_KEY = 'nekha_favorites';

/* ---------- Helpers ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function setFavorites(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  let favs = getFavorites();
  if (favs.includes(id)) favs = favs.filter(f => f !== id);
  else favs.push(id);
  setFavorites(favs);
  return favs.includes(id);
}

/* ---------- Data loader ---------- */
let _data = null;
async function loadData() {
  if (_data) return _data;
  const res = await fetch('recipes.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger recipes.json');
  _data = await res.json();
  return _data;
}

function findRecipe(data, id) {
  return data.recipes.find(r => r.id === id);
}
function categoryLabel(data, catId) {
  const c = data.categories.find(c => c.id === catId);
  return c ? c : { label: catId, icon: '' };
}

/* ---------- Home rendering ---------- */
async function renderHome() {
  const grid       = $('#recipeGrid');
  const filterBar  = $('#filterBar');
  const searchInput = $('#searchInput');
  if (!grid) return;

  let data;
  try { data = await loadData(); }
  catch (e) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    return;
  }

  /* Hero (si placeholder présent) */
  const heroBg = $('#heroBg');
  const heroTitleAr = $('#heroTitleAr');
  if (heroBg) {
    const heroImg = (data.recipes.find(r => r.id === 'tajine') || data.recipes[0])?.image;
    if (heroImg) heroBg.style.backgroundImage = `url('${heroImg}')`;
  }
  if (heroTitleAr && data.site.nameArabic) heroTitleAr.textContent = data.site.nameArabic;

  /* Document title */
  document.title = `${data.site.name} — ${data.site.tagline}`;

  /* Filters */
  filterBar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.dataset.cat = 'all';
  allBtn.innerHTML = `Tout <span class="count">${data.recipes.length}</span>`;
  filterBar.appendChild(allBtn);

  data.categories.forEach(cat => {
    const count = data.recipes.filter(r => r.category === cat.id).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.cat = cat.id;
    btn.innerHTML = `${cat.icon} ${cat.label} <span class="count">${count}</span>`;
    filterBar.appendChild(btn);
  });

  /* Fav filter (only if there are favorites) */
  const favCount = getFavorites().length;
  if (favCount > 0) {
    const favBtn = document.createElement('button');
    favBtn.className = 'filter-btn';
    favBtn.dataset.cat = 'favorites';
    favBtn.innerHTML = `♥ Favoris <span class="count">${favCount}</span>`;
    filterBar.appendChild(favBtn);
  }

  /* State */
  let activeCat = 'all';
  let searchTerm = '';

  function applyFilters() {
    let list = data.recipes;
    if (activeCat === 'favorites') list = list.filter(r => isFavorite(r.id));
    else if (activeCat !== 'all') list = list.filter(r => r.category === activeCat);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(t) ||
        (r.tagline || '').toLowerCase().includes(t) ||
        (r.ingredients || []).some(i => i.toLowerCase().includes(t))
      );
    }
    renderCards(list);
  }

  function renderCards(list) {
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="icon">🍽️</div>
          <p>Aucune recette ne correspond à votre recherche.</p>
        </div>`;
      return;
    }
    grid.innerHTML = list.map(r => cardHTML(r, data)).join('');
    bindHearts(grid);
  }

  /* Filter click */
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    $$('.filter-btn', filterBar).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    applyFilters();
  });

  /* Search */
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.trim();
      applyFilters();
    });
  }

  /* Initial render */
  applyFilters();
}

/* ---------- Card HTML ---------- */
function cardHTML(r, data) {
  const cat = categoryLabel(data, r.category);
  const fav = isFavorite(r.id);
  const ar = r.titleArabic ? `<span class="ar">${esc(r.titleArabic)}</span>` : '';
  return `
    <article class="card" data-id="${esc(r.id)}">
      <a class="card-link" href="recipe.html?id=${esc(r.id)}">
        <div class="card-media">
          <span class="card-cat">${esc(cat.icon)} ${esc(cat.label)}</span>
          <button class="heart-btn ${fav ? 'is-fav' : ''}" data-fav="${esc(r.id)}" aria-label="Ajouter aux favoris" title="Favori">
            ${fav ? '♥' : '♡'}
          </button>
          <img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy">
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(r.title)}${ar}</h3>
          ${r.tagline ? `<p class="card-tag">${esc(r.tagline)}</p>` : ''}
          <div class="card-meta">
            ${r.prepTime ? `<span>⏱ ${esc(r.prepTime)}</span>` : ''}
            ${r.cookTime ? `<span>🔥 ${esc(r.cookTime)}</span>` : ''}
            ${r.difficulty ? `<span>• ${esc(r.difficulty)}</span>` : ''}
          </div>
        </div>
      </a>
    </article>`;
}

/* ---------- Bind heart buttons in a container ---------- */
function bindHearts(container) {
  $$('.heart-btn', container).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.fav;
      const nowFav = toggleFavorite(id);
      btn.classList.toggle('is-fav', nowFav);
      btn.textContent = nowFav ? '♥' : '♡';
      /* If we're filtering favorites, refresh list */
      const activeBtn = $('.filter-btn.active');
      if (activeBtn && activeBtn.dataset.cat === 'favorites') {
        /* Re-render home grid */
        window.location.reload();
      }
    });
  });
}

/* ---------- Recipe page rendering ---------- */
async function renderRecipe() {
  const mount = $('#recipeMount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  let data;
  try { data = await loadData(); }
  catch (e) {
    mount.innerHTML = `<div class="error-box"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    return;
  }

  if (!id) {
    mount.innerHTML = `<div class="error-box"><div class="icon">🔍</div><p>Aucune recette sélectionnée.</p><p><a href="index.html">← Retour à l'accueil</a></p></div>`;
    return;
  }

  const recipe = findRecipe(data, id);
  if (!recipe) {
    mount.innerHTML = `<div class="error-box"><div class="icon">🍽️</div><p>Cette recette n'existe pas (encore).</p><p><a href="index.html">← Retour à l'accueil</a></p></div>`;
    return;
  }

  const cat = categoryLabel(data, recipe.category);
  const fav = isFavorite(recipe.id);
  const ar = recipe.titleArabic ? `<span class="ar">${esc(recipe.titleArabic)}</span>` : '';

  document.title = `${recipe.title} — ${data.site.name}`;

  mount.innerHTML = `
    <section class="recipe-hero">
      <img src="${esc(recipe.image)}" alt="${esc(recipe.title)}">
      <div class="recipe-hero-overlay"></div>
      <div class="recipe-hero-content">
        <a href="index.html" class="recipe-back">← Retour</a>
        <span class="eyebrow">${esc(cat.icon)} ${esc(cat.label)}</span>
        <h1>${esc(recipe.title)}${ar}</h1>
        ${recipe.tagline ? `<p class="lead">${esc(recipe.tagline)}</p>` : ''}
        <button class="heart-btn ${fav ? 'is-fav' : ''}" data-fav="${esc(recipe.id)}" aria-label="Favori">
          ${fav ? '♥' : '♡'}
        </button>
      </div>
    </section>

    <div class="read" style="padding-top:64px">
      <div class="recipe-toolbar">
        <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer la recette</button>
        <button class="btn" onclick="window.location.href='index.html'">← Toutes les recettes</button>
      </div>

      <div class="recipe-meta-row">
        ${recipe.servings  ? `<div class="meta"><span class="meta-label">${esc(recipe.servingsLabel || 'Portions')}</span><span class="meta-value">${esc(recipe.servings)}</span></div>` : ''}
        ${recipe.prepTime  ? `<div class="meta"><span class="meta-label">Préparation</span><span class="meta-value">${esc(recipe.prepTime)}</span></div>` : ''}
        ${recipe.cookTime  ? `<div class="meta"><span class="meta-label">Cuisson</span><span class="meta-value">${esc(recipe.cookTime)}</span></div>` : ''}
        ${recipe.difficulty? `<div class="meta"><span class="meta-label">Difficulté</span><span class="meta-value">${esc(recipe.difficulty)}</span></div>` : ''}
      </div>

      <div class="recipe-layout">
        <aside class="ingredients-col">
          <div class="ingredients-card">
            <h2>Ingrédients</h2>
            ${recipe.servings ? `<span class="servings">${esc(recipe.servings)}</span>` : ''}
            <ul class="ingredients-list">
              ${recipe.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}
            </ul>
          </div>
        </aside>

        <div class="steps-col">
          <h2>Préparation</h2>
          <ol class="steps-list">
            ${recipe.steps.map(s => `<li>${esc(s)}</li>`).join('')}
          </ol>

          ${recipe.notes ? `
            <div class="recipe-notes">
              <strong>💡 Petite note</strong>
              ${esc(recipe.notes)}
            </div>` : ''}

          ${(recipe.video || recipe.videoUrl || recipe.sourceUrl) ? `
            <div class="recipe-extra">
              ${recipe.video ? `
                <h3>🎥 Vidéo de la recette</h3>
                <div class="video-frame">
                  <video controls preload="metadata">
                    <source src="${esc(recipe.video)}" type="video/mp4">
                    Votre navigateur ne supporte pas la vidéo.
                  </video>
                </div>
                ${recipe.videoUrl ? `<p style="margin-top:12px"><a class="btn" href="${esc(recipe.videoUrl)}" target="_blank" rel="noopener">▶ Voir la vidéo originale</a></p>` : ''}
              ` : ''}
              ${recipe.sourceUrl ? `
                <div class="source-block">
                  <strong>📌 Source</strong><br>
                  ${recipe.sourceNote ? `<p style="margin:8px 0">${esc(recipe.sourceNote)}</p>` : ''}
                  <a href="${esc(recipe.sourceUrl)}" target="_blank" rel="noopener">Voir la recette originale →</a>
                </div>
              ` : ''}
            </div>` : ''}
        </div>
      </div>
    </div>
  `;

  /* Bind heart */
  bindHearts(mount);
}

/* ---------- Mobile menu ---------- */
function initMobileMenu() {
  const btn = $('#menuBtn');
  const nav = $('#nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  renderHome();
  renderRecipe();
});
