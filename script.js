/* ─── Nav scroll effect ─────────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ─── Mobile menu toggle ────────────────────────────────────── */
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
toggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  const spans = toggle.querySelectorAll('span');
  const open = navLinks.classList.contains('open');
  spans[0].style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
  spans[1].style.opacity = open ? '0' : '';
  spans[2].style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  toggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}));

/* ─── Scroll reveal ─────────────────────────────────────────── */
const revealEls = () => {
  document.querySelectorAll('.section-header, .skill-card, .timeline-item, .about-grid > *, .contact-inner, .portfolio-item, .stat, .contact-link')
    .forEach(el => el.classList.add('reveal'));
};
revealEls();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 60);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

/* ─── ArtStation portfolio loader ───────────────────────────── */
async function loadPortfolio() {
  const grid = document.getElementById('portfolio-grid');
  const errorEl = document.getElementById('portfolio-error');

  try {
    const response = await fetch(
      'https://www.artstation.com/users/pavlo_p/projects.json?page=1&per_page=12',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const projects = data.data || [];

    if (!projects.length) throw new Error('No projects returned');

    grid.innerHTML = '';

    projects.slice(0, 12).forEach((project, i) => {
      const coverUrl = project.cover?.small_square_url
        || project.cover?.thumb_url
        || project.smaller_square_cover_url
        || project.cover_url;

      if (!coverUrl) return;

      const url = `https://www.artstation.com/artwork/${project.hash_id}`;
      const title = project.title || 'Untitled';

      const item = document.createElement('a');
      item.href = url;
      item.target = '_blank';
      item.rel = 'noopener';
      item.className = 'portfolio-item reveal';
      item.style.animationDelay = `${i * 60}ms`;

      item.innerHTML = `
        <img src="${escHtml(coverUrl)}" alt="${escHtml(title)}" loading="lazy" />
        <div class="portfolio-overlay">
          <div class="portfolio-title">${escHtml(title)}</div>
          <div class="portfolio-view">View project →</div>
        </div>
      `;

      grid.appendChild(item);
    });

    // Re-observe new items
    grid.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  } catch (err) {
    console.warn('ArtStation fetch failed:', err.message);
    // Graceful fallback — show error panel with link
    grid.innerHTML = '';
    errorEl.classList.remove('hidden');
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

loadPortfolio();
