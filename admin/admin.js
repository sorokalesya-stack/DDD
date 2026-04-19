// ── State ────────────────────────────────────────────────────────────────
let siteData = { site: {}, projects: [] };
let currentView = 'dashboard';
let editingProject = null;   // null = new project, string id = editing existing
let dashboardTag = 'all';

const LAYOUTS = [
  { id: 'hero-gallery',  label: 'Hero + Gallery', icon: '⬛\n▪▪▪' },
  { id: 'grid',          label: 'Grid',            icon: '▪▪\n▪▪' },
  { id: 'masonry',       label: 'Masonry',          icon: '▪ ▪' },
  { id: 'slideshow',     label: 'Slideshow',        icon: '◁▪▷' },
  { id: 'strips',        label: 'Full Strips',      icon: '━━━' }
];

// ── Boot ─────────────────────────────────────────────────────────────────
async function boot() {
  await loadData();
  navigate('dashboard');
}

async function loadData() {
  const res = await fetch('/api/data');
  siteData = await res.json();
  siteData.projects = siteData.projects || [];
  siteData.site = siteData.site || {};
}

async function saveData() {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siteData)
  });
  if (!res.ok) throw new Error('Failed to save');
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(view, arg) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const container = document.getElementById('view-container');
  switch (view) {
    case 'dashboard':     container.innerHTML = renderDashboard(); break;
    case 'project-editor':renderProjectEditor(arg); break;
    case 'site-settings': container.innerHTML = renderSiteSettings(); bindSiteSettings(); break;
    case 'visual-editor': container.innerHTML = renderVisualEditor(); initVisualEditor(); break;
    case 'publish':       container.innerHTML = renderPublish(); break;
    case 'settings':      container.innerHTML = renderSettings(); loadSettings(); break;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function renderDashboard() {
  const tags = ['all', ...new Set(siteData.projects.flatMap(p => p.tags || []))];
  const filtered = dashboardTag === 'all'
    ? siteData.projects
    : siteData.projects.filter(p => (p.tags || []).includes(dashboardTag));

  return `
    <div class="view-header">
      <span class="view-title">Projects</span>
      <button class="btn btn-primary" onclick="startNewProject()">+ Add Project</button>
    </div>
    <div class="dashboard-content">
      <div class="tag-filter-bar">
        ${tags.map(t => `
          <button class="tag-filter-btn ${t === dashboardTag ? 'active' : ''}"
                  onclick="setDashboardTag('${esc(t)}')">
            ${esc(t === 'all' ? 'All' : t)}
          </button>`).join('')}
      </div>
      ${filtered.length === 0
        ? '<div class="empty-state">No projects yet. Click "+ Add Project" to get started.</div>'
        : `<div class="projects-grid">${filtered.map(renderProjectCard).join('')}</div>`}
    </div>
  `;
}

function setDashboardTag(tag) {
  dashboardTag = tag;
  navigate('dashboard');
}

function renderProjectCard(p) {
  return `
    <div class="project-card-admin">
      <div class="project-card-thumb">
        ${p.thumbnail
          ? `<img src="${esc(p.thumbnail)}" alt="${esc(p.title)}" onerror="this.parentNode.innerHTML='<div class=no-img>No image</div>'">`
          : `<div class="no-img">No image</div>`}
      </div>
      <div class="project-card-body">
        <div class="project-card-tags">
          ${(p.tags||[]).map(t => `<span class="tag-chip">${esc(t)}</span>`).join('')}
        </div>
        <div class="project-card-title">${esc(p.title)}</div>
        <div class="project-card-desc">${esc(p.description)}</div>
        <div class="project-card-actions">
          <button class="btn btn-ghost" style="flex:1;" onclick="navigate('project-editor','${esc(p.id)}')">Edit</button>
          <button class="btn btn-danger" onclick="deleteProject('${esc(p.id)}')">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function startNewProject() {
  navigate('project-editor', null);
}

async function deleteProject(id) {
  if (!confirm('Delete this project? This cannot be undone.')) return;
  siteData.projects = siteData.projects.filter(p => p.id !== id);
  await saveData();
  toast('Project deleted');
  navigate('dashboard');
}

// ── Project Editor ────────────────────────────────────────────────────────
function renderProjectEditor(id) {
  const isNew = !id;
  const project = isNew
    ? { id: `proj_${Date.now()}`, title: '', description: '', fullDescription: '',
        tags: [], year: String(new Date().getFullYear()), layout: 'hero-gallery',
        thumbnail: '', images: [], software: [], artStationUrl: '' }
    : JSON.parse(JSON.stringify(siteData.projects.find(p => p.id === id)));

  if (!project) { navigate('dashboard'); return; }
  editingProject = project;

  document.getElementById('view-container').innerHTML = `
    <div class="view-header">
      <span class="view-title">${isNew ? 'New Project' : 'Edit Project'}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="navigate('dashboard')">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject(${isNew})">Save</button>
      </div>
    </div>

    <!-- Identity -->
    <div class="form-section">
      <div class="form-section-title">Project Info</div>
      <div class="field-row">
        <div class="field">
          <label>Title</label>
          <input id="pe-title" value="${esc(project.title)}" placeholder="Project title">
        </div>
        <div class="field">
          <label>Year</label>
          <input id="pe-year" value="${esc(String(project.year||''))}" placeholder="2024">
        </div>
      </div>
      <div class="field">
        <label>Short Description</label>
        <input id="pe-desc" value="${esc(project.description)}" placeholder="One-line summary">
      </div>
      <div class="field">
        <label>Full Description</label>
        <textarea id="pe-fulldesc" placeholder="Detailed description...">${esc(project.fullDescription||'')}</textarea>
      </div>
      <div class="field">
        <label>Tags (press Enter to add)</label>
        <div class="tag-input-wrap" id="pe-tags-wrap" onclick="document.getElementById('pe-tag-input').focus()">
          ${(project.tags||[]).map(t => tagPill(t, 'removePETag')).join('')}
          <input class="tag-input-field" id="pe-tag-input" placeholder="Add tag…"
                 onkeydown="handleTagInput(event,'pe-tags-wrap','pe-tag-input','project')">
        </div>
      </div>
      <div class="field">
        <label>Software / Tools (press Enter to add)</label>
        <div class="tag-input-wrap" id="pe-sw-wrap" onclick="document.getElementById('pe-sw-input').focus()">
          ${(project.software||[]).map(t => tagPill(t, 'removePESW')).join('')}
          <input class="tag-input-field" id="pe-sw-input" placeholder="Add tool…"
                 onkeydown="handleTagInput(event,'pe-sw-wrap','pe-sw-input','software')">
        </div>
      </div>
      <div class="field">
        <label>ArtStation URL (optional)</label>
        <input id="pe-artstation" value="${esc(project.artStationUrl||'')}" placeholder="https://www.artstation.com/artwork/...">
      </div>
    </div>

    <!-- Layout -->
    <div class="form-section">
      <div class="form-section-title">Layout</div>
      <div class="layout-picker">
        ${LAYOUTS.map(l => `
          <div class="layout-option ${project.layout === l.id ? 'selected' : ''}"
               onclick="selectLayout('${l.id}')" id="lo-${l.id}">
            <div class="lo-icon">${l.icon}</div>
            <div class="lo-label">${l.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Images -->
    <div class="form-section">
      <div class="form-section-title">Images</div>
      <div class="drop-zone" id="pe-dropzone"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="handleImageDrop(event)"
           onclick="document.getElementById('pe-file-input').click()">
        <p>Drop images here or click to upload</p>
        <p style="margin-top:4px;font-size:10px;">JPG, PNG, WEBP up to 30MB each</p>
        <input type="file" id="pe-file-input" multiple accept="image/*"
               onchange="handleImageFiles(this.files)">
      </div>
      <div class="images-grid" id="pe-images-grid">
        ${renderImageTiles(project.images)}
      </div>
    </div>

    <!-- Danger -->
    ${!isNew ? `
    <div class="form-section" style="border-top: 1px solid rgba(239,68,68,0.2);">
      <div class="form-section-title" style="color:#ef4444;">Danger Zone</div>
      <button class="btn btn-danger" onclick="deleteProject('${esc(project.id)}')">Delete this project</button>
    </div>` : ''}
  `;
}

function renderImageTiles(images) {
  if (!images || !images.length) return '<p style="color:var(--muted);font-size:12px;">No images uploaded yet.</p>';
  const sorted = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.map((img, i) => `
    <div class="image-tile" draggable="true"
         ondragstart="imgDragStart(event,${i})"
         ondragover="event.preventDefault();this.classList.add('drag-target')"
         ondragleave="this.classList.remove('drag-target')"
         ondrop="imgDrop(event,${i})"
         id="imgtile-${i}">
      ${img.src === editingProject.thumbnail ? '<div class="thumb-badge">THUMB</div>' : ''}
      <div class="image-tile-thumb">
        <img src="${esc(img.src)}" alt="${esc(img.alt||'')}" onerror="this.src=''">
      </div>
      <div class="image-tile-body">
        <input value="${esc(img.alt||'')}" placeholder="Caption…"
               onchange="updateImageAlt(${i},this.value)">
        <div class="image-tile-actions">
          <button onclick="setThumbnail('${esc(img.src)}')">Set Thumb</button>
          <button class="btn-del" onclick="removeImage('${esc(img.src)}')">Remove</button>
        </div>
      </div>
    </div>
  `).join('');
}

let dragFromIdx = null;
function imgDragStart(event, idx) { dragFromIdx = idx; event.currentTarget.classList.add('dragging'); }
function imgDrop(event, toIdx) {
  event.preventDefault();
  document.querySelectorAll('.image-tile').forEach(t => t.classList.remove('drag-target', 'dragging'));
  if (dragFromIdx === null || dragFromIdx === toIdx) return;
  const sorted = [...editingProject.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const moved = sorted.splice(dragFromIdx, 1)[0];
  sorted.splice(toIdx, 0, moved);
  sorted.forEach((img, i) => { img.order = i; });
  editingProject.images = sorted;
  document.getElementById('pe-images-grid').innerHTML = renderImageTiles(editingProject.images);
  dragFromIdx = null;
}

function selectLayout(id) {
  editingProject.layout = id;
  document.querySelectorAll('.layout-option').forEach(el => el.classList.remove('selected'));
  document.getElementById(`lo-${id}`)?.classList.add('selected');
}

function setThumbnail(src) {
  editingProject.thumbnail = src;
  document.getElementById('pe-images-grid').innerHTML = renderImageTiles(editingProject.images);
}

function updateImageAlt(idx, val) {
  const sorted = [...editingProject.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (sorted[idx]) sorted[idx].alt = val;
}

async function removeImage(src) {
  editingProject.images = editingProject.images.filter(i => i.src !== src);
  if (editingProject.thumbnail === src) editingProject.thumbnail = editingProject.images[0]?.src || '';
  document.getElementById('pe-images-grid').innerHTML = renderImageTiles(editingProject.images);
  // Delete file from server
  await fetch('/api/image', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ src }) });
}

function tagPill(text, removeFn) {
  return `<span class="tag-pill">${esc(text)}<button onclick="${removeFn}('${esc(text)}')">&times;</button></span>`;
}

function removePETag(tag) {
  editingProject.tags = (editingProject.tags || []).filter(t => t !== tag);
  refreshTagWrap('pe-tags-wrap', 'pe-tag-input', editingProject.tags, 'removePETag', 'project');
}
function removePESW(tag) {
  editingProject.software = (editingProject.software || []).filter(t => t !== tag);
  refreshTagWrap('pe-sw-wrap', 'pe-sw-input', editingProject.software, 'removePESW', 'software');
}

function refreshTagWrap(wrapId, inputId, arr, removeFn, type) {
  const wrap = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  const val = input ? input.value : '';
  wrap.innerHTML = arr.map(t => tagPill(t, removeFn)).join('') +
    `<input class="tag-input-field" id="${inputId}" placeholder="Add…" value="${esc(val)}"
            onkeydown="handleTagInput(event,'${wrapId}','${inputId}','${type}')">`;
  document.getElementById(inputId)?.focus();
}

function handleTagInput(event, wrapId, inputId, type) {
  if (event.key !== 'Enter' && event.key !== ',') return;
  event.preventDefault();
  const input = document.getElementById(inputId);
  const val = input.value.trim().replace(/,/g, '');
  if (!val) return;
  if (type === 'project') {
    if (!editingProject.tags.includes(val)) editingProject.tags.push(val);
    refreshTagWrap(wrapId, inputId, editingProject.tags, 'removePETag', 'project');
  } else {
    if (!editingProject.software.includes(val)) editingProject.software.push(val);
    refreshTagWrap(wrapId, inputId, editingProject.software, 'removePESW', 'software');
  }
}

async function handleImageDrop(event) {
  event.preventDefault();
  document.getElementById('pe-dropzone').classList.remove('drag-over');
  await handleImageFiles(event.dataTransfer.files);
}

async function handleImageFiles(files) {
  if (!files || !files.length) return;
  showUploadProgress(`Uploading ${files.length} image(s)…`);
  const fd = new FormData();
  Array.from(files).forEach(f => fd.append('images', f));
  try {
    const res = await fetch(`/api/upload/${editingProject.id}`, { method: 'POST', body: fd });
    const data = await res.json();
    const maxOrder = editingProject.images.reduce((m, img) => Math.max(m, img.order ?? 0), -1);
    data.uploaded.forEach((img, i) => {
      img.order = maxOrder + 1 + i;
      editingProject.images.push(img);
    });
    if (!editingProject.thumbnail && data.uploaded[0]) {
      editingProject.thumbnail = data.uploaded[0].src;
    }
    document.getElementById('pe-images-grid').innerHTML = renderImageTiles(editingProject.images);
    hideUploadProgress();
    toast(`${data.uploaded.length} image(s) uploaded`);
  } catch (e) {
    hideUploadProgress();
    toast('Upload failed: ' + e.message, 'error');
  }
}

async function saveProject(isNew) {
  // Collect form values
  editingProject.title          = document.getElementById('pe-title').value.trim();
  editingProject.year           = document.getElementById('pe-year').value.trim();
  editingProject.description    = document.getElementById('pe-desc').value.trim();
  editingProject.fullDescription= document.getElementById('pe-fulldesc').value.trim();
  editingProject.artStationUrl  = document.getElementById('pe-artstation').value.trim();

  if (!editingProject.title) { toast('Title is required', 'error'); return; }

  if (isNew) {
    siteData.projects.push(editingProject);
  } else {
    const idx = siteData.projects.findIndex(p => p.id === editingProject.id);
    if (idx >= 0) siteData.projects[idx] = editingProject;
  }
  try {
    await saveData();
    toast('Project saved');
    navigate('dashboard');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ── Site Settings ─────────────────────────────────────────────────────────
function renderSiteSettings() {
  const s = siteData.site || {};
  return `
    <div class="view-header">
      <span class="view-title">Site Settings</span>
      <button class="btn btn-primary" onclick="saveSiteSettings()">Save</button>
    </div>

    <div class="form-section">
      <div class="form-section-title">Identity</div>
      <div class="field-row">
        <div class="field"><label>Name</label><input id="ss-name" value="${esc(s.name||'')}"></div>
        <div class="field"><label>Tagline</label><input id="ss-tagline" value="${esc(s.tagline||'')}"></div>
      </div>
      <div class="field"><label>Bio</label><textarea id="ss-bio">${esc(s.bio||'')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Status</label><input id="ss-status" value="${esc(s.status||'')}"></div>
        <div class="field"><label>Location</label><input id="ss-location" value="${esc(s.location||'')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Email</label><input id="ss-email" type="email" value="${esc(s.email||'')}"></div>
        <div class="field"><label>ArtStation URL</label><input id="ss-artstation" value="${esc(s.artstation||'')}"></div>
      </div>
    </div>

    <div class="form-section">
      <div class="form-section-title">Hero Image</div>
      <div class="field">
        <label>Image URL or path (upload via image manager)</label>
        <input id="ss-hero" value="${esc(s.heroImage||'')}" placeholder="assets/images/hero.jpg">
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-ghost" onclick="document.getElementById('ss-hero-file').click()">Upload Hero Image</button>
        <input type="file" id="ss-hero-file" accept="image/*" style="display:none"
               onchange="uploadHeroImage(this.files[0])">
      </div>
      ${s.heroImage ? `<img src="${esc(s.heroImage)}" style="margin-top:12px;max-width:300px;max-height:200px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" onerror="this.style.display='none'">` : ''}
    </div>

    <div class="form-section">
      <div class="form-section-title">Stats</div>
      <div class="stats-list" id="ss-stats">
        ${(s.stats||[]).map((st, i) => `
          <div class="stat-item" data-idx="${i}">
            <input value="${esc(st.value)}" placeholder="15+" onchange="updateStat(${i},'value',this.value)">
            <input value="${esc(st.label)}" placeholder="Years of Experience" onchange="updateStat(${i},'label',this.value)">
            <button onclick="removeStat(${i})">&times;</button>
          </div>`).join('')}
      </div>
      <button class="btn btn-ghost" onclick="addStat()">+ Add Stat</button>
    </div>
  `;
}

function bindSiteSettings() {}

function updateStat(idx, key, val) {
  if (siteData.site.stats && siteData.site.stats[idx]) {
    siteData.site.stats[idx][key] = val;
  }
}

function removeStat(idx) {
  siteData.site.stats = (siteData.site.stats||[]).filter((_, i) => i !== idx);
  document.getElementById('ss-stats').innerHTML = (siteData.site.stats||[]).map((st, i) => `
    <div class="stat-item" data-idx="${i}">
      <input value="${esc(st.value)}" placeholder="15+" onchange="updateStat(${i},'value',this.value)">
      <input value="${esc(st.label)}" placeholder="Label" onchange="updateStat(${i},'label',this.value)">
      <button onclick="removeStat(${i})">&times;</button>
    </div>`).join('');
}

function addStat() {
  siteData.site.stats = siteData.site.stats || [];
  siteData.site.stats.push({ value: '', label: '' });
  const i = siteData.site.stats.length - 1;
  const list = document.getElementById('ss-stats');
  list.insertAdjacentHTML('beforeend', `
    <div class="stat-item" data-idx="${i}">
      <input value="" placeholder="15+" onchange="updateStat(${i},'value',this.value)">
      <input value="" placeholder="Label" onchange="updateStat(${i},'label',this.value)">
      <button onclick="removeStat(${i})">&times;</button>
    </div>`);
}

async function uploadHeroImage(file) {
  if (!file) return;
  showUploadProgress('Uploading hero image…');
  const fd = new FormData();
  fd.append('images', file);
  try {
    const res = await fetch('/api/upload/site', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.uploaded?.[0]) {
      siteData.site.heroImage = data.uploaded[0].src;
      document.getElementById('ss-hero').value = siteData.site.heroImage;
    }
    hideUploadProgress();
    toast('Hero image uploaded');
  } catch (e) {
    hideUploadProgress();
    toast('Upload failed', 'error');
  }
}

async function saveSiteSettings() {
  siteData.site.name       = document.getElementById('ss-name').value.trim();
  siteData.site.tagline    = document.getElementById('ss-tagline').value.trim();
  siteData.site.bio        = document.getElementById('ss-bio').value.trim();
  siteData.site.status     = document.getElementById('ss-status').value.trim();
  siteData.site.location   = document.getElementById('ss-location').value.trim();
  siteData.site.email      = document.getElementById('ss-email').value.trim();
  siteData.site.artstation = document.getElementById('ss-artstation').value.trim();
  siteData.site.heroImage  = document.getElementById('ss-hero').value.trim();
  try {
    await saveData();
    toast('Settings saved');
  } catch (e) {
    toast('Save failed', 'error');
  }
}

// ── Visual Editor ─────────────────────────────────────────────────────────
function renderVisualEditor() {
  return `
    <div class="ve-toolbar">
      <label class="ve-toggle">
        <input type="checkbox" id="ve-toggle" onchange="toggleEditMode(this.checked)">
        <span>Edit Mode</span>
      </label>
      <span id="ve-hint" style="color:var(--muted);">Toggle edit mode to click elements and edit them</span>
      <div style="margin-left:auto;display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="reloadPreview()">Reload</button>
        <a href="/" target="_blank" class="btn btn-ghost">Open Site ↗</a>
      </div>
    </div>
    <iframe id="site-preview" src="/"></iframe>
  `;
}

function initVisualEditor() {}

function reloadPreview() {
  const iframe = document.getElementById('site-preview');
  if (iframe) iframe.src = iframe.src;
}

function toggleEditMode(enabled) {
  const iframe = document.getElementById('site-preview');
  if (!iframe) return;
  const hint = document.getElementById('ve-hint');
  if (enabled) {
    hint.textContent = 'Click a project card to edit it, or click anywhere else to reload';
    iframe.contentWindow.postMessage({ type: 'ENABLE_EDIT' }, '*');
    // Listen for clicks from iframe
    iframe.contentWindow.addEventListener('click', handleIframeClick, { capture: true });
  } else {
    hint.textContent = 'Toggle edit mode to click elements and edit them';
    try { iframe.contentWindow.removeEventListener('click', handleIframeClick, { capture: true }); } catch {}
  }
}

function handleIframeClick(e) {
  const card = e.target.closest('[data-project-id]');
  if (card) {
    e.preventDefault();
    e.stopPropagation();
    navigate('project-editor', card.dataset.projectId);
  }
}

// Also listen to postMessage from iframe
window.addEventListener('message', (e) => {
  if (e.data?.type === 'EDIT_PROJECT') navigate('project-editor', e.data.id);
});

// ── Publish ───────────────────────────────────────────────────────────────
function renderPublish() {
  const steps = [
    { id: 'git-add',    label: 'Stage files' },
    { id: 'git-commit', label: 'Commit changes' },
    { id: 'git-push',   label: 'Push to GitHub' },
    { id: 'vercel',     label: 'Trigger Vercel deploy' },
    { id: 'done',       label: 'Complete' }
  ];
  return `
    <div class="view-header">
      <span class="view-title">Publish</span>
    </div>
    <div class="publish-content">
      <div class="field">
        <label>Commit Message</label>
        <input id="pub-message" value="Portfolio update ${new Date().toISOString().slice(0,10)}" placeholder="Describe changes…">
      </div>
      <button class="btn btn-primary" id="pub-btn" onclick="runPublish()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Publish Now
      </button>
      <div class="publish-steps" id="pub-steps">
        ${steps.map(s => `
          <div class="publish-step" id="step-${s.id}">
            <div class="step-icon">●</div>
            <div class="step-label">${s.label}</div>
            <div class="step-status" id="step-status-${s.id}">–</div>
          </div>`).join('')}
      </div>
      <div id="pub-error" style="margin-top:16px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;font-size:12px;display:none;"></div>
    </div>
  `;
}

async function runPublish() {
  const btn = document.getElementById('pub-btn');
  const msg = document.getElementById('pub-message').value.trim() || `Portfolio update ${new Date().toISOString().slice(0,10)}`;
  btn.disabled = true;
  document.getElementById('pub-error').style.display = 'none';

  const res = await fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitMessage: msg })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        updatePublishStep(event);
      } catch {}
    }
  }
  btn.disabled = false;
}

function updatePublishStep({ step, status, message, hash, reason }) {
  const stepEl = document.getElementById(`step-${step}`);
  const statusEl = document.getElementById(`step-status-${step}`);
  if (!stepEl) return;
  stepEl.className = `publish-step step-${status}`;
  const icons = { ok: '✓', running: '⟳', failed: '✗', skipped: '–', done: '✓' };
  stepEl.querySelector('.step-icon').textContent = icons[status] || '●';
  statusEl.textContent = status === 'ok' ? (hash ? `#${hash.slice(0,7)}` : 'Done')
    : status === 'skipped' ? (reason || 'Skipped')
    : status === 'running' ? 'Running…'
    : status === 'failed' ? (message || 'Failed')
    : status;
  if (status === 'failed') {
    const err = document.getElementById('pub-error');
    err.textContent = message || 'Publish failed';
    err.style.display = 'block';
  }
}

// ── Settings (GitHub/Vercel config) ──────────────────────────────────────
function renderSettings() {
  return `
    <div class="view-header">
      <span class="view-title">Settings</span>
      <button class="btn btn-primary" onclick="saveSettings()">Save</button>
    </div>
    <div class="settings-content">
      <div class="form-section">
        <div class="form-section-title">GitHub</div>
        <div class="field">
          <label>Repository URL</label>
          <input id="cfg-repo" placeholder="https://github.com/user/repo">
        </div>
        <div class="field">
          <label>Personal Access Token</label>
          <input id="cfg-token" type="password" placeholder="ghp_xxxxxxxxxxxx">
        </div>
        <div class="field">
          <label>Branch</label>
          <input id="cfg-branch" value="main">
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Vercel</div>
        <div class="field">
          <label>Deploy Hook URL</label>
          <input id="cfg-vercel" type="password" placeholder="https://api.vercel.com/v1/integrations/deploy/...">
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:8px;">
          Get this from Vercel → Project → Settings → Git → Deploy Hooks
        </p>
      </div>
    </div>
  `;
}

async function loadSettings() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    const repoEl = document.getElementById('cfg-repo');
    const branchEl = document.getElementById('cfg-branch');
    if (repoEl) repoEl.value = cfg.githubRepo || '';
    if (branchEl) branchEl.value = cfg.branch || 'main';
    if (cfg.githubTokenSet) document.getElementById('cfg-token').placeholder = '(saved)';
    if (cfg.vercelHookSet) document.getElementById('cfg-vercel').placeholder = '(saved)';
  } catch {}
}

async function saveSettings() {
  const body = {
    githubRepo:  document.getElementById('cfg-repo').value.trim(),
    githubToken: document.getElementById('cfg-token').value.trim() || undefined,
    vercelHook:  document.getElementById('cfg-vercel').value.trim() || undefined,
    branch:      document.getElementById('cfg-branch').value.trim() || 'main'
  };
  try {
    await fetch('/api/config', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    toast('Settings saved');
  } catch (e) {
    toast('Save failed', 'error');
  }
}

// ── UI Helpers ────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function showUploadProgress(msg) {
  let el = document.getElementById('upload-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'upload-progress';
    el.className = 'upload-progress';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
}
function hideUploadProgress() {
  document.getElementById('upload-progress')?.classList.remove('visible');
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ─────────────────────────────────────────────────────────────────
boot();
