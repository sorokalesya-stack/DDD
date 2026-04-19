// GitHub API browser wrapper — credentials stored in localStorage, never sent elsewhere
const GH = (() => {
  const LS_KEY = 'portfolio_gh';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveConfig({ token, repo, branch = 'main', vercelHook = '' }) {
    const clean = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
    const m = clean.match(/^([^/]+)\/([^/]+)/);
    const owner = m ? m[1] : '';
    const repoName = m ? m[2] : '';
    localStorage.setItem(LS_KEY, JSON.stringify({ token, owner, repo: repoName, fullRepo: repo, branch, vercelHook }));
  }

  function clearConfig() { localStorage.removeItem(LS_KEY); }

  function isConfigured() {
    const c = getConfig();
    return !!(c.token && c.owner && c.repo);
  }

  async function apiReq(method, path, body) {
    const c = getConfig();
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}`;
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `token ${c.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `GitHub API ${r.status}`);
    }
    return method === 'DELETE' ? {} : r.json();
  }

  async function getSHA(path) {
    try {
      const d = await apiReq('GET', path);
      return d.sha;
    } catch (e) {
      if (/404|Not Found/.test(e.message)) return null;
      throw e;
    }
  }

  async function putFile(path, text, msg = 'Update') {
    const sha = await getSHA(path);
    const body = {
      message: msg,
      content: btoa(unescape(encodeURIComponent(text))),
      branch: getConfig().branch || 'main'
    };
    if (sha) body.sha = sha;
    return apiReq('PUT', path, body);
  }

  async function putBinaryFile(path, b64, msg = 'Upload') {
    const sha = await getSHA(path);
    const body = { message: msg, content: b64, branch: getConfig().branch || 'main' };
    if (sha) body.sha = sha;
    return apiReq('PUT', path, body);
  }

  async function deleteFile(path, msg = 'Delete') {
    const sha = await getSHA(path);
    if (!sha) return;
    return apiReq('DELETE', path, { message: msg, sha, branch: getConfig().branch || 'main' });
  }

  function rawUrl(relPath) {
    const c = getConfig();
    return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch || 'main'}/${relPath.replace(/^\.?\//, '')}`;
  }

  return { getConfig, saveConfig, clearConfig, isConfigured, putFile, putBinaryFile, deleteFile, rawUrl };
})();
