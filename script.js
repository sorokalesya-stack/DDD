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
    stars = Array.from({ length: 180 }, makeStar);
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
}, { threshold: 0.08 });

document.querySelectorAll(
  '.section-head, .about-grid > *, .sp-card, .exp-item, .clink, .contact-side > *, .contact-title'
).forEach(el => {
  el.classList.add('reveal');
  observer.observe(el);
});

/* ─── ArtStation portfolio loader ────────────────────────────── */
async function loadPortfolio() {
  const container = document.getElementById('case-studies');
  const errorEl   = document.getElementById('cs-error');

  const usernames = ['pavlo_p', 'roll'];
  let projects = [];

  for (const username of usernames) {
    try {
      const res = await fetch(
        `https://www.artstation.com/users/${username}/projects.json?page=1&per_page=12`
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        projects = data.data;
        break;
      }
    } catch { /* try next username */ }
  }

  if (!projects.length) {
    container.innerHTML = '';
    errorEl.classList.remove('hidden');
    return;
  }

  const detailed = await Promise.allSettled(
    projects.slice(0, 8).map(p =>
      fetch(`https://www.artstation.com/projects/${p.hash_id}.json`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    )
  );

  container.innerHTML = '';

  projects.slice(0, 8).forEach((p, i) => {
    const detail = detailed[i]?.value;

    const coverImg = p.cover?.medium_image_url
      || p.cover?.url
      || p.cover_url
      || p.smaller_square_cover_url;

    if (!coverImg) return;

    const extraImages = [];
    if (detail && detail.assets) {
      detail.assets.forEach(a => {
        if (a.image_url && extraImages.length < 3) {
          extraImages.push(a.image_url);
        }
      });
    }

    const url   = `https://www.artstation.com/artwork/${p.hash_id}`;
    const title = esc(p.title || 'Untitled');
    const num   = String(i + 1).padStart(2, '0');
    const cats  = (p.medium?.name || p.categories?.[0]?.name || '3D Art');
    const desc  = detail?.description
      ? esc(stripHtml(detail.description).slice(0, 150))
      : 'View project details and full-resolution renders.';
    const software = detail?.software_items
      ? detail.software_items.map(s => esc(s.name || s)).slice(0, 4).join(' · ')
      : '';

    const item = document.createElement('a');
    item.href      = url;
    item.target    = '_blank';
    item.rel       = 'noopener';
    item.className = 'cs-item reveal';

    let galleryHtml = '';
    if (extraImages.length > 0) {
      galleryHtml = `<div class="cs-gallery">${
        extraImages.map(img => `<div class="cs-thumb"><img src="${esc(img)}" alt="" loading="lazy" /></div>`).join('')
      }</div>`;
    }

    let softwareHtml = '';
    if (software) {
      softwareHtml = `<div class="cs-software">${esc(software)}</div>`;
    }

    item.innerHTML = `
      <div class="cs-image-wrap">
        <img src="${esc(coverImg)}" alt="${title}" loading="lazy" />
      </div>
      <div class="cs-info">
        <div class="cs-num">${num}</div>
        <div class="cs-cat">${esc(cats)}</div>
        <h3 class="cs-title">${title}</h3>
        <p class="cs-desc">${desc}</p>
        ${softwareHtml}
        ${galleryHtml}
        <span class="cs-cta">View Project</span>
      </div>
    `;

    container.appendChild(item);
    observer.observe(item);
  });
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/\"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ─── Lightbox ───────────────────────────────────────────────── */
document.addEventListener('click', function (e) {
  const img = e.target.closest('.cs-thumb img, .cs-image-wrap img');
  if (!img) return;

  const isThumb = img.closest('.cs-thumb');
  if (!isThumb) return;

  e.preventDefault();
  e.stopPropagation();

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${img.src}" alt="" /><button class="lb-close">✕</button>`;
  document.body.appendChild(lb);
  requestAnimationFrame(() => lb.classList.add('active'));

  lb.addEventListener('click', () => {
    lb.classList.remove('active');
    setTimeout(() => lb.remove(), 300);
  });
});

loadPortfolio();