require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const { simpleGit } = require('simple-git');
const path    = require('path');
const fs      = require('fs');

const ROOT       = path.resolve(__dirname);
const DATA_FILE  = path.join(ROOT, 'data', 'projects.json');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const PORT       = process.env.PORT || 3000;

const app = express();
const git = simpleGit(ROOT);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// API routes first so static middleware doesn't intercept them
// Static: portfolio site files
app.use(express.static(ROOT, { index: 'index.html' }));
// Static: admin panel
app.get('/admin', (req, res) => res.sendFile(path.join(ROOT, 'admin', 'index.html')));
app.use('/admin', express.static(path.join(ROOT, 'admin')));

// ── Image upload storage ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const pid = req.params.projectId || 'general';
    const dir = path.join(IMAGES_DIR, pid);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter(req, file) {
    return /image\/(jpeg|png|gif|webp)/.test(file.mimetype);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function writeConfig(c) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
}

// ── Data API ───────────────────────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  try { res.json(readData()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/data', (req, res) => {
  try { writeData(req.body); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Image API ──────────────────────────────────────────────────────────────
app.post('/api/upload/:projectId', upload.array('images', 30), (req, res) => {
  try {
    const pid = req.params.projectId;
    const uploaded = req.files.map(f => ({
      src: `assets/images/${pid}/${f.filename}`,
      alt: f.originalname.replace(/\.[^.]+$/, ''),
      order: 0
    }));
    res.json({ uploaded });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/image', (req, res) => {
  try {
    const { src } = req.body;
    // Security: only allow deleting files inside assets/images/
    const full = path.resolve(ROOT, src);
    if (!full.startsWith(path.join(ROOT, 'assets', 'images'))) {
      return res.status(403).json({ error: 'Forbidden path' });
    }
    if (fs.existsSync(full)) fs.unlinkSync(full);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Config API ─────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const c = readConfig();
  res.json({
    githubRepo:      c.github?.repo || '',
    githubTokenSet:  !!c.github?.token,
    vercelHookSet:   !!c.vercel?.deployHook,
    branch:          c.github?.branch || 'main'
  });
});

app.put('/api/config', (req, res) => {
  try {
    const existing = readConfig();
    const { githubRepo, githubToken, vercelHook, branch } = req.body;
    writeConfig({
      github: {
        repo:   githubRepo  ?? existing.github?.repo  ?? '',
        token:  githubToken ?? existing.github?.token ?? '',
        branch: branch      ?? existing.github?.branch ?? 'main'
      },
      vercel: {
        deployHook: vercelHook ?? existing.vercel?.deployHook ?? ''
      }
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Publish API ────────────────────────────────────────────────────────────
app.post('/api/publish', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');

  const emit = (step, status, extra = {}) =>
    res.write(JSON.stringify({ step, status, ...extra }) + '\n');

  const cfg = readConfig();
  const { commitMessage = `Portfolio update ${new Date().toISOString().slice(0, 10)}` } = req.body;

  try {
    // Stage data and images
    emit('git-add', 'running');
    await git.add(['data/projects.json', 'assets/images/']);
    emit('git-add', 'ok');

    // Commit
    emit('git-commit', 'running');
    try {
      const result = await git.commit(commitMessage);
      emit('git-commit', 'ok', { hash: result.commit || '' });
    } catch (e) {
      if (e.message.includes('nothing to commit')) {
        emit('git-commit', 'skipped', { message: 'Nothing new to commit' });
      } else throw e;
    }

    // Push
    emit('git-push', 'running');
    const branch = cfg.github?.branch || 'main';
    const token  = cfg.github?.token;
    const repo   = cfg.github?.repo;
    if (token && repo) {
      const authUrl = repo.replace('https://', `https://${token}@`);
      await git.push(authUrl, branch);
    } else {
      await git.push('origin', branch);
    }
    emit('git-push', 'ok');

    // Vercel hook
    const hookUrl = cfg.vercel?.deployHook;
    if (hookUrl) {
      emit('vercel', 'running');
      const r = await fetch(hookUrl, { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      emit('vercel', 'ok', { jobId: body.job?.id });
    } else {
      emit('vercel', 'skipped', { reason: 'No deploy hook configured' });
    }

    emit('done', 'ok', { timestamp: new Date().toISOString() });
  } catch (e) {
    emit('error', 'failed', { message: e.message });
  } finally {
    res.end();
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nPortfolio CMS running:`);
  console.log(`  Site:  http://localhost:${PORT}/`);
  console.log(`  Admin: http://localhost:${PORT}/admin\n`);
});
