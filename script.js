/* ─── Star field ─────────────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let W, H, stars = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeStar() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + .2,
      a: Math.random(),
      speed: Math.random() * .003 + .001,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    resize();
    stars = Array.from({ length: 200 }, makeStar);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    stars.forEach(s => {
      const alpha = (Math.sin(t * s.speed + s.phase) + 1) / 2 * s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,210,255,${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  init();
  requestAnimationFrame(draw);
})();

/* ─── Nav scroll ─────────────────────────────────────────────── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 30);
}, { passive: true });

/* ─── Mobile menu ────────────────────────────────────────────── */
const toggle   = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
toggle.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  const [s1, s2] = toggle.querySelectorAll('span');
  s1.style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
  s2.style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  toggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; });
}));

/* ─── Scroll reveal ──────────────────────────────────────────── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(
  '.section-head, .about-grid > *, .sp-card, .exp-item, .clink, .contact-side > *, .contact-title'
).forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});

/* ─── ArtStation loader ──────────────────────────────────────── */
async function loadProjects() {
  const container = document.getElementById('case-studies');
  const errorEl   = document.getElementById('cs-error');

  try {
    const res = await fetch(
      'https://www.artstation.com/users/pavlo_p/projects.json?page=1&per_page=10',
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data     = await res.json();
    const projects = (data.data || []).filter(p => p.cover_url || p.smaller_square_cover_url);

    if (!projects.length) throw new Error('empty');

    container.innerHTML = '';

    projects.slice(0, 8).forEach((p, i) => {
      const img   = p.cover_url || p.smaller_square_cover_url;
      const url   = `https://www.artstation.com/artwork/${p.hash_id}`;
      const title = esc(p.title || 'Untitled');
      const num   = String(i + 1).padStart(2, '0');

      // Build medium list from categories if available
      const cats = (p.categories || []).map(c => c.name).join(' · ') || '3D Asset';

      const item = document.createElement('a');
      item.href    = url;
      item.target  = '_blank';
      item.rel     = 'noopener';
      item.className = 'cs-item reveal';

      item.innerHTML = `
        <div class="cs-image-wrap">
          <img src="${esc(img)}" alt="${title}" loading="lazy" />
        </div>
        <div class="cs-info">
          <div class="cs-num">${num}</div>
          <div class="cs-cat">${esc(cats)}</div>
          <h3 class="cs-title">${title}</h3>
          <p class="cs-desc">View this project in full detail on ArtStation.</p>
          <span class="cs-cta">View Project</span>
        </div>
      `;

      container.appendChild(item);
      observer.observe(item);
    });

  } catch (err) {
    console.warn('ArtStation fetch failed:', err.message);
    container.innerHTML = '';
    errorEl.classList.remove('hidden');
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

loadProjects();
