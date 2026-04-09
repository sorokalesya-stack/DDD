/* ─── Nav scroll state ───────────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 30);
}, { passive: true });

/* ─── Scroll reveal ──────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

function observeReveal(el) {
  revealObserver.observe(el);
}

document.querySelectorAll('.stat-item').forEach(observeReveal);

/* ─── Filter buttons ──────────────────────────────────────────── */
let activeFilter = 'all';

document.getElementById('filterBtns').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterCards();
});

function filterCards() {
  document.querySelectorAll('.proj-card').forEach(card => {
    const match = activeFilter === 'all' || card.dataset.category === activeFilter;
    card.classList.toggle('hidden', !match);
  });
}

/* ─── Helpers ────────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mapCategory(project) {
  const combined = [
    project.title || '',
    project.medium?.name || '',
    ...(project.mediums || []).map(m => m.name || ''),
    ...(project.categories || []).map(c => c.name || ''),
  ].join(' ').toLowerCase();

  if (combined.includes('portrait') || combined.includes('likeness')) return 'portraits';
  if (
    combined.includes('creature') ||
    combined.includes('spider') ||
    combined.includes('animal') ||
    combined.includes('monster')
  ) return 'creatures';
  if (
    combined.includes('hard surface') ||
    combined.includes('vehicle') ||
    combined.includes('car') ||
    combined.includes('mechanical') ||
    combined.includes('industrial')
  ) return 'hard-surface';
  if (
    combined.includes('environment') ||
    combined.includes('scene') ||
    combined.includes('landscape') ||
    combined.includes('level')
  ) return 'environment';
  return 'characters';
}

function getYear(project) {
  const d = project.created_at || project.updated_at;
  if (!d) return '';
  return new Date(d).getFullYear();
}

function createCard(project, imgUrl) {
  const category = mapCategory(project);
  const year = getYear(project);

  const a = document.createElement('a');
  a.href = `https://www.artstation.com/artwork/${project.hash_id}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.className = 'proj-card reveal';
  a.dataset.category = category;

  const catLabel = category === 'hard-surface' ? 'Hard Surface' :
    category.charAt(0).toUpperCase() + category.slice(1);
  const yearStr = year ? ` · ${year}` : '';

  a.innerHTML = `
    <img src="${esc(imgUrl)}" alt="${esc(project.title || '')}" loading="lazy" />
    <div class="proj-gradient"></div>
    <div class="proj-info">
      <span class="proj-meta">${esc(catLabel)}${esc(yearStr)}</span>
      <h3 class="proj-title">${esc(project.title || 'Untitled')}</h3>
    </div>
    <div class="proj-hover">
      <div class="proj-hover-btn">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    </div>
  `;

  return a;
}

/* ─── ArtStation loader ───────────────────────────────────────── */
async function loadPortfolio() {
  const grid = document.getElementById('projectsGrid');
  const heroBg = document.getElementById('heroBg');

  let projects = [];

  try {
    const res = await fetch(
      'https://www.artstation.com/users/pavlo_p/projects.json?page=1&per_page=12'
    );
    if (res.ok) {
      const data = await res.json();
      if (data.data?.length) projects = data.data;
    }
  } catch { /* fall through */ }

  grid.innerHTML = '';

  if (!projects.length) {
    grid.innerHTML = `
      <p style="color:#737373;font-size:14px;grid-column:1/-1;padding:40px 0;">
        Could not load projects.
        <a href="https://www.artstation.com/pavlo_p" target="_blank"
           style="color:#fff;text-decoration:underline;text-underline-offset:3px;">
          View on ArtStation ↗
        </a>
      </p>`;
    return;
  }

  // Set hero background from first project's cover
  const firstCover =
    projects[0]?.cover?.medium_image_url ||
    projects[0]?.cover_url ||
    projects[0]?.smaller_square_cover_url;
  if (firstCover && heroBg) {
    heroBg.style.backgroundImage = `url(${firstCover})`;
  }

  projects.slice(0, 12).forEach((p) => {
    const imgUrl =
      p.cover?.medium_image_url ||
      p.cover_url ||
      p.smaller_square_cover_url;
    if (!imgUrl) return;

    const card = createCard(p, imgUrl);

    // Apply current filter
    if (activeFilter !== 'all' && card.dataset.category !== activeFilter) {
      card.classList.add('hidden');
    }

    grid.appendChild(card);
    observeReveal(card);
  });
}

loadPortfolio();
