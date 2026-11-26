(function () {
  'use strict';

  const TOKEN_STORAGE_KEY = 'portal_ukmppdh_gh_token';
  const SESSION_TOKEN_KEY = 'portal_ukmppdh_gh_token_session';
  const CFG_OVERRIDE_KEY = 'portal_ukmppdh_gh_cfg';
  const HIDDEN_BUILTIN_KEY = 'portal_ukmppdh_hidden_builtins';
  const PBKDF2_ITERATIONS = 200000;

  let repoConfig = {
    owner: 'bhadreswara2509611047',
    repo: 'Portal-Soal-UKMPPDH',
    branch: 'main',
    manifestPath: 'data/manifest.json',
    packagesDir: 'data/packages',
    encryptedToken: null,
    hiddenBuiltinIds: []
  };

  let memoryToken = '';
  let cloudPackages = [];
  let pendingUploadHtml = '';
  let pendingUploadFileName = '';
  let isSyncingGridUI = false;

  // ==================== UTILITAS ENCODING UTF-8 <-> BASE64 ====================
  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(String(b64 || '').replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function utf8ToBase64(str) {
    return bytesToBase64(new TextEncoder().encode(str));
  }

  function base64ToUtf8(b64) {
    return new TextDecoder('utf-8').decode(base64ToBytes(b64));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugifyFileName(name) {
    const base = String(name || 'paket_soal')
      .replace(/\.html?$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (base || 'paket_soal') + '.html';
  }

  // ==================== DATA PAKET BAWAAN & STATUS HAPUS ====================
  function getBuiltinPackagesMeta() {
    try {
      const el = document.getElementById('embedded-builtin-meta');
      if (!el) return [];
      const parsed = JSON.parse(el.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function getHiddenBuiltinIds() {
    const fromCfg = Array.isArray(repoConfig.hiddenBuiltinIds) ? repoConfig.hiddenBuiltinIds : [];
    let fromLocal = [];
    try {
      const raw = localStorage.getItem(HIDDEN_BUILTIN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) fromLocal = parsed;
      }
    } catch (e) {}
    return Array.from(new Set([...fromCfg, ...fromLocal].map((id) => String(id))));
  }

  function setLocalHiddenBuiltinIds(ids) {
    const unique = Array.from(new Set((ids || []).map((id) => String(id))));
    repoConfig.hiddenBuiltinIds = unique;
    try {
      localStorage.setItem(HIDDEN_BUILTIN_KEY, JSON.stringify(unique));
    } catch (e) {}
    return unique;
  }

  function isAdminModeActive() {
    const btn = document.getElementById('btn-open-gh-sync');
    if (!btn) return false;
    return !btn.classList.contains('hidden') && btn.offsetParent !== null;
  }

  // ==================== ENKRIPSI WEB CRYPTO (PBKDF2 + AES-GCM) ====================
  function ensureWebCryptoAvailable() {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error(
        'Fitur enkripsi memerlukan halaman HTTPS (GitHub Pages) atau localhost.'
      );
    }
  }

  async function deriveAesKey(passphrase, saltBytes, iterations) {
    ensureWebCryptoAvailable();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations || PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptTokenToVault(plainToken, passphrase) {
    ensureWebCryptoAvailable();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
    const cipherBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plainToken.trim())
    );
    return {
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(cipherBuf))
    };
  }

  async function decryptTokenFromVault(vault, passphrase) {
    ensureWebCryptoAvailable();
    if (!vault || !vault.salt || !vault.iv || !vault.data) {
      throw new Error('Data token terenkripsi di config.json tidak valid.');
    }
    const salt = base64ToBytes(vault.salt);
    const iv = base64ToBytes(vault.iv);
    const cipherBytes = base64ToBytes(vault.data);
    const key = await deriveAesKey(passphrase, salt, vault.iter || PBKDF2_ITERATIONS);
    try {
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherBytes
      );
      return new TextDecoder('utf-8').decode(plainBuf);
    } catch (e) {
      throw new Error('Sandi enkripsi salah. Token gagal dibuka.');
    }
  }

  // ==================== PENYIMPANAN TOKEN & KONFIGURASI ====================
  function getSavedToken() {
    if (memoryToken) return memoryToken;
    try {
      const sess = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (sess) {
        memoryToken = sess;
        return sess;
      }
      const local = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (local) {
        memoryToken = local;
        return local;
      }
    } catch (e) {}
    return '';
  }

  function saveToken(token, rememberLocal) {
    const clean = String(token || '').trim();
    memoryToken = clean;
    try {
      if (!clean) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        return;
      }
      sessionStorage.setItem(SESSION_TOKEN_KEY, clean);
      if (rememberLocal) {
        localStorage.setItem(TOKEN_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (e) {}
  }

  function detectGithubPagesRepo() {
    try {
      const host = window.location.hostname || '';
      if (host.endsWith('.github.io')) {
        const owner = host.replace(/\.github\.io$/i, '');
        const parts = (window.location.pathname || '').split('/').filter(Boolean);
        const repo = parts.length > 0 ? parts[0] : `${owner}.github.io`;
        return { owner, repo };
      }
    } catch (e) {}
    return { owner: '', repo: '' };
  }

  function getEffectiveConfig() {
    const detected = detectGithubPagesRepo();
    const base = Object.assign(
      {
        owner: detected.owner,
        repo: detected.repo,
        branch: 'main',
        manifestPath: 'data/manifest.json',
        packagesDir: 'data/packages',
        encryptedToken: null,
        hiddenBuiltinIds: []
      },
      repoConfig
    );

    try {
      const override = JSON.parse(localStorage.getItem(CFG_OVERRIDE_KEY) || 'null');
      if (override && override.owner && override.repo) {
        return Object.assign({}, base, {
          owner: override.owner,
          repo: override.repo,
          branch: override.branch || base.branch || 'main'
        });
      }
    } catch (e) {}

    return base;
  }

  function saveConfigOverride(owner, repo, branch) {
    try {
      localStorage.setItem(
        CFG_OVERRIDE_KEY,
        JSON.stringify({
          owner: String(owner || '').trim(),
          repo: String(repo || '').trim(),
          branch: (String(branch || '').trim() || 'main')
        })
      );
    } catch (e) {}
  }

  function clearConfigOverride() {
    try {
      localStorage.removeItem(CFG_OVERRIDE_KEY);
    } catch (e) {}
  }

  function hasCloudVault() {
    const cfg = getEffectiveConfig();
    return Boolean(
      cfg.encryptedToken &&
        cfg.encryptedToken.salt &&
        cfg.encryptedToken.iv &&
        cfg.encryptedToken.data
    );
  }

  // ==================== LOAD CONFIG & MANIFEST ====================
  async function loadRepoConfig(preferRaw) {
    const detected = detectGithubPagesRepo();
    const ts = Date.now();
    const urls = [];

    const currentOwner = repoConfig.owner || detected.owner;
    const currentRepo = repoConfig.repo || detected.repo;
    const currentBranch = repoConfig.branch || 'main';

    if (preferRaw && currentOwner && currentRepo) {
      urls.push(
        `https://raw.githubusercontent.com/${currentOwner}/${currentRepo}/${currentBranch}/config.json?t=${ts}`
      );
    }
    urls.push(`./config.json?t=${ts}`);
    if (!preferRaw && currentOwner && currentRepo) {
      urls.push(
        `https://raw.githubusercontent.com/${currentOwner}/${currentRepo}/${currentBranch}/config.json?t=${ts}`
      );
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            repoConfig = Object.assign({}, repoConfig, data);
            if (Array.isArray(data.hiddenBuiltinIds)) {
              setLocalHiddenBuiltinIds(data.hiddenBuiltinIds);
            }
            syncBuiltinCardsState();
            renderManageCloudList();
            return repoConfig;
          }
        }
      } catch (e) {}
    }

    syncBuiltinCardsState();
    return repoConfig;
  }

  async function loadCloudManifest(preferRaw) {
    const cfg = getEffectiveConfig();
    const ts = Date.now();
    const urls = [];

    if (preferRaw && cfg.owner && cfg.repo) {
      urls.push(
        `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.manifestPath}?t=${ts}`
      );
    }
    urls.push(`./${cfg.manifestPath}?t=${ts}`);
    if (!preferRaw && cfg.owner && cfg.repo) {
      urls.push(
        `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.manifestPath}?t=${ts}`
      );
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          cloudPackages = Array.isArray(json.packages) ? json.packages : [];
          renderCloudSection();
          renderManageCloudList();
          return cloudPackages;
        }
      } catch (e) {}
    }

    cloudPackages = [];
    renderCloudSection();
    renderManageCloudList();
    return [];
  }

  // ==================== GITHUB REST API ====================
  async function githubRequest(path, method, bodyObj, token, explicitCfg) {
    const cfg = explicitCfg || getEffectiveConfig();
    if (!cfg.owner || !cfg.repo) {
      throw new Error('Owner dan nama repository belum diisi di tab Pengaturan.');
    }
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyObj) headers['Content-Type'] = 'application/json';

    const cleanPath = path ? `/${String(path).replace(/^\/+/, '')}` : '';
    const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${cleanPath}`;
    const res = await fetch(url, {
      method: method || 'GET',
      headers,
      body: bodyObj ? JSON.stringify(bodyObj) : undefined
    });

    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {}

    if (!res.ok) {
      const msg = json.message || `HTTP ${res.status}`;
      throw new Error(`GitHub API Error (${res.status}): ${msg}`);
    }
    return json;
  }

  async function getFileSha(filePath, token, explicitCfg) {
    const cfg = explicitCfg || getEffectiveConfig();
    try {
      const data = await githubRequest(
        `contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`,
        'GET',
        null,
        token,
        cfg
      );
      return {
        sha: data.sha || null,
        content: data.content ? base64ToUtf8(data.content) : null
      };
    } catch (e) {
      if (String(e.message).includes('(404)')) {
        return { sha: null, content: null };
      }
      throw e;
    }
  }

  async function putRepoFile(filePath, contentString, commitMessage, token, explicitCfg) {
    const cfg = explicitCfg || getEffectiveConfig();
    const existing = await getFileSha(filePath, token, cfg);
    const payload = {
      message: commitMessage,
      content: utf8ToBase64(contentString),
      branch: cfg.branch
    };
    if (existing.sha) payload.sha = existing.sha;

    return githubRequest(`contents/${filePath}`, 'PUT', payload, token, cfg);
  }

  async function deleteRepoFile(filePath, commitMessage, token) {
    const cfg = getEffectiveConfig();
    const existing = await getFileSha(filePath, token);
    if (!existing.sha) return;

    return githubRequest(
      `contents/${filePath}`,
      'DELETE',
      {
        message: commitMessage,
        sha: existing.sha,
        branch: cfg.branch
      },
      token
    );
  }

  // ==================== BUKA PAKET CLOUD DI WORKSPACE ====================
  async function openCloudPackage(pkgId) {
    const pkg = cloudPackages.find((p) => p.id === pkgId);
    if (!pkg) return;

    const cfg = getEffectiveConfig();
    const filePath = `${cfg.packagesDir}/${pkg.fileName}`;
    const ts = Date.now();
    const candidateUrls = [
      `./${filePath}?t=${ts}`,
      cfg.owner && cfg.repo
        ? `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${filePath}?t=${ts}`
        : null
    ].filter(Boolean);

    let htmlContent = '';
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          htmlContent = await res.text();
          break;
        }
      } catch (e) {}
    }

    if (!htmlContent) {
      alert('Gagal memuat file soal. Silakan muat ulang halaman beberapa saat lagi.');
      return;
    }

    const overlay = ensureCloudRunnerOverlay();
    const titleEl = overlay.querySelector('#gh-runner-title');
    const iframe = overlay.querySelector('#gh-runner-frame');

    titleEl.textContent = `${pkg.code} — ${pkg.title}`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    if (iframe.dataset.blobUrl) {
      try {
        URL.revokeObjectURL(iframe.dataset.blobUrl);
      } catch (e) {}
    }
    iframe.dataset.blobUrl = blobUrl;
    iframe.src = blobUrl;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function ensureCloudRunnerOverlay() {
    let el = document.getElementById('gh-cloud-runner');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gh-cloud-runner';
    el.className = 'hidden fixed inset-0 z-[90] h-[100dvh] flex flex-col surface';
    el.innerHTML = `
      <div class="h-12 sm:h-14 surface border-b px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <button type="button" id="gh-runner-close"
            class="btn-secondary h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Portal</span>
          </button>
          <span id="gh-runner-title" class="text-xs sm:text-sm font-bold text-main truncate">Simulasi CBT</span>
        </div>
      </div>
      <iframe id="gh-runner-frame" class="w-full flex-1 border-0 bg-white" title="Simulasi CBT Tambahan"></iframe>
    `;
    document.body.appendChild(el);

    el.querySelector('#gh-runner-close').addEventListener('click', () => {
      el.classList.add('hidden');
      document.body.style.overflow = '';
    });

    return el;
  }

  // ==================== SINKRONISASI KARTU BAWAAN & TOMBOL HAPUS ADMIN ====================
  function matchCardToBuiltinPkg(card, builtins) {
    const attrId = card.getAttribute('data-pkg-id') || card.getAttribute('data-id');
    if (attrId) {
      const byAttr = builtins.find((p) => p.id === attrId);
      if (byAttr) return byAttr;
    }

    const actionEl = card.querySelector('[onclick]');
    if (actionEl) {
      const onclickStr = actionEl.getAttribute('onclick') || '';
      const byOnclick = builtins.find(
        (p) => onclickStr.includes(`'${p.id}'`) || onclickStr.includes(`"${p.id}"`)
      );
      if (byOnclick) return byOnclick;
    }

    const h3 = card.querySelector('h3');
    if (h3) {
      const titleText = h3.textContent.trim();
      const byTitle = builtins.find((p) => p.title.trim() === titleText);
      if (byTitle) return byTitle;
    }

    return null;
  }

  function syncBuiltinCardsState() {
    if (isSyncingGridUI) return;
    const grid = document.getElementById('packages-grid');
    if (!grid) return;

    isSyncingGridUI = true;
    try {
      const builtins = getBuiltinPackagesMeta();
      const hiddenSet = new Set(getHiddenBuiltinIds());
      const adminActive = isAdminModeActive();

      Array.from(grid.children).forEach((card) => {
        const pkg = matchCardToBuiltinPkg(card, builtins);
        if (!pkg) return;

        const isHidden = hiddenSet.has(pkg.id);
        card.classList.toggle('hidden', isHidden);

        const existingBtn = card.querySelector('.gh-card-delete-btn');
        if (adminActive && !isHidden) {
          if (!existingBtn) {
            card.classList.add('relative');
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className =
              'gh-card-delete-btn absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors';
            delBtn.title = `Hapus paket ${pkg.title}`;
            delBtn.textContent = 'Hapus';
            delBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteBuiltinPackage(pkg.id);
            });
            card.appendChild(delBtn);
          }
        } else if (existingBtn) {
          existingBtn.remove();
        }
      });
    } finally {
      isSyncingGridUI = false;
    }
  }

  // ==================== RENDER SEKSI PAKET TAMBAHAN ====================
  function renderCloudSection() {
    const grid = document.getElementById('packages-grid');
    if (!grid || !grid.parentElement) return;

    let wrap = document.getElementById('gh-cloud-packages-section');
    if (!wrap) {
      wrap = document.createElement('section');
      wrap.id = 'gh-cloud-packages-section';
      wrap.className = 'mt-7 sm:mt-8 pt-6 border-t';
      wrap.style.borderColor = 'var(--border-color)';
      grid.parentElement.appendChild(wrap);
    }

    if (!cloudPackages.length) {
      wrap.innerHTML = '';
      wrap.classList.add('hidden');
      return;
    }

    const adminActive = isAdminModeActive();

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-4">
        <h2 class="text-sm sm:text-base font-extrabold tracking-tight text-main">Paket Soal Tambahan</h2>
        <span class="subtle border px-2.5 py-1 rounded-full text-xs font-semibold text-sub">
          ${cloudPackages.length} Paket
        </span>
      </div>
      <div id="gh-cloud-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        ${cloudPackages
          .map(
            (pkg) => `
          <div class="surface border rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-colors hover:border-slate-400 dark:hover:border-zinc-600">
            <div class="space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="badge-pastel px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">${escapeHtml(pkg.code)}</span>
                  ${
                    pkg.hasOsce
                      ? '<span class="badge-osce px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800">+ OSCE</span>'
                      : ''
                  }
                </div>
                ${
                  adminActive
                    ? `<button type="button" data-gh-card-delete="${escapeHtml(pkg.id)}"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-colors shrink-0">
                        Hapus
                      </button>`
                    : ''
                }
              </div>
              <div>
                <h3 class="text-[15px] sm:text-base font-bold text-main leading-snug">${escapeHtml(pkg.title)}</h3>
                <p class="text-xs text-mute mt-0.5">${escapeHtml(pkg.name || 'Try Out Nasional')}</p>
              </div>
              <p class="text-xs text-sub leading-relaxed line-clamp-2">${escapeHtml(pkg.highlights || '')}</p>
            </div>
            <div class="space-y-3 pt-3 border-t" style="border-color: var(--border-color);">
              <div class="flex items-center justify-between text-xs font-medium text-sub">
                <span>${escapeHtml(pkg.questions)} Soal</span>
                <span>${escapeHtml(pkg.duration)}</span>
              </div>
              <button type="button" data-gh-open="${escapeHtml(pkg.id)}"
                class="btn-primary w-full min-h-[42px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                <span>Mulai Simulasi</span>
                <span>→</span>
              </button>
            </div>
          </div>`
          )
          .join('')}
      </div>
    `;

    wrap.querySelectorAll('[data-gh-open]').forEach((btn) => {
      btn.addEventListener('click', () => openCloudPackage(btn.getAttribute('data-gh-open')));
    });

    wrap.querySelectorAll('[data-gh-card-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCloudPackage(btn.getAttribute('data-gh-card-delete'), btn));
    });
  }

  // ==================== MODAL UPLOAD & KELOLA GITHUB (ADMIN) ====================
  function updateAuthBannerUI() {
    const modal = document.getElementById('gh-sync-modal');
    if (!modal) return;

    const cfg = getEffectiveConfig();
    const token = getSavedToken();
    const vaultAvailable = hasCloudVault();

    const unlockBox = modal.querySelector('#gh-unlock-banner');
    const readyBox = modal.querySelector('#gh-ready-banner');
    const setupBox = modal.querySelector('#gh-setup-banner');
    const readyRepoText = modal.querySelector('#gh-ready-repo-text');
    const unlockRepoText = modal.querySelector('#gh-unlock-repo-text');

    unlockBox.classList.add('hidden');
    readyBox.classList.add('hidden');
    setupBox.classList.add('hidden');

    if (token && cfg.owner && cfg.repo) {
      readyRepoText.textContent = `${cfg.owner}/${cfg.repo} (${cfg.branch || 'main'})`;
      readyBox.classList.remove('hidden');
    } else if (vaultAvailable && cfg.owner && cfg.repo) {
      unlockRepoText.textContent = `${cfg.owner}/${cfg.repo} (${cfg.branch || 'main'})`;
      unlockBox.classList.remove('hidden');
    } else {
      setupBox.classList.remove('hidden');
    }
  }

  function ensureAdminModal() {
    let modal = document.getElementById('gh-sync-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'gh-sync-modal';
    modal.className = 'hidden fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="surface border w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden fade-in">
        <div class="flex items-center justify-between px-5 py-4 border-b shrink-0" style="border-color: var(--border-color);">
          <div>
            <h3 class="text-base font-bold text-main">Admin Paket Soal</h3>
            <p class="text-xs text-mute">Unggah, kelola, dan hapus paket soal di portal</p>
          </div>
          <button type="button" id="gh-modal-close" class="btn-secondary w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center">✕</button>
        </div>

        <div class="flex gap-4 px-5 pt-3 border-b text-xs font-bold shrink-0 overflow-x-auto no-scrollbar" style="border-color: var(--border-color);">
          <button type="button" data-gh-tab="upload" class="gh-tab-btn pb-2.5 border-b-2 whitespace-nowrap">Upload Soal</button>
          <button type="button" data-gh-tab="manage" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-mute whitespace-nowrap">Kelola &amp; Hapus Paket</button>
          <button type="button" data-gh-tab="settings" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-mute whitespace-nowrap">Pengaturan</button>
        </div>

        <!-- BANNER STATUS KONEKSI / BUKA KUNCI TOKEN -->
        <div class="px-5 pt-4 shrink-0">
          <!-- Sudah siap -->
          <div id="gh-ready-banner" class="hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <div class="truncate font-semibold">✓ Siap sinkron ke <span id="gh-ready-repo-text" class="font-bold"></span></div>
            <button type="button" id="gh-btn-quick-lock" class="underline font-bold shrink-0">Kunci</button>
          </div>

          <!-- Token terenkripsi tersedia di config.json, belum dibuka di perangkat ini -->
          <div id="gh-unlock-banner" class="hidden subtle border p-3.5 rounded-xl space-y-2.5">
            <div class="text-xs text-main font-bold">
              🔐 Buka Kunci Token (<span id="gh-unlock-repo-text" class="text-sub font-semibold"></span>)
            </div>
            <p class="text-[11px] text-sub leading-relaxed">
              Pengaturan repository sudah tersinkron otomatis. Masukkan <strong>Sandi Enkripsi</strong> untuk mengaktifkan upload &amp; hapus di perangkat ini.
            </p>
            <div class="flex gap-2">
              <input type="password" id="gh-unlock-passphrase" placeholder="Masukkan Sandi Enkripsi..."
                class="input-clean flex-1 px-3 py-2 text-base sm:text-xs rounded-xl" />
              <button type="button" id="gh-btn-unlock-submit" class="btn-primary px-4 py-2 rounded-xl text-xs font-bold shrink-0">
                Buka Kunci
              </button>
            </div>
            <label class="inline-flex items-center gap-2 text-[11px] font-medium text-sub cursor-pointer">
              <input type="checkbox" id="gh-unlock-remember" checked class="w-3.5 h-3.5 rounded" />
              <span>Ingat di perangkat ini (jangan centang jika memakai perangkat umum)</span>
            </label>
            <div id="gh-unlock-status" class="hidden p-2.5 rounded-lg text-xs font-semibold"></div>
          </div>

          <!-- Belum pernah dikonfigurasi -->
          <div id="gh-setup-banner" class="hidden px-3 py-2.5 rounded-xl text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-between gap-2">
            <span class="font-medium">Pengaturan GitHub belum tersimpan. Isi sekali di tab Pengaturan.</span>
            <button type="button" id="gh-btn-goto-settings" class="underline font-bold shrink-0">Atur Sekarang</button>
          </div>
        </div>

        <div class="overflow-y-auto custom-scroll flex-1">
          <!-- TAB 1: UPLOAD HTML -->
          <div id="gh-panel-upload" class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-sub mb-1.5">File Soal (.html)</label>
              <input type="file" id="gh-file-input" accept=".html,.htm"
                class="input-clean block w-full text-xs rounded-xl p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold" />
              <p id="gh-file-info" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5"></p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Kode Singkat</label>
                <input type="text" id="gh-pkg-code" placeholder="Contoh: UGM" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl uppercase" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Institusi</label>
                <input type="text" id="gh-pkg-org" placeholder="Universitas Gadjah Mada" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Judul Paket Soal</label>
              <input type="text" id="gh-pkg-title" placeholder="TO Nasional CBT UKMPPDH 2026" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Jumlah Soal</label>
                <input type="number" id="gh-pkg-qcount" value="100" min="1" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Durasi</label>
                <input type="text" id="gh-pkg-duration" value="100 Menit" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Deskripsi Singkat</label>
              <input type="text" id="gh-pkg-highlights" placeholder="Lengkap dengan pembahasan dan mode latihan." class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <label class="inline-flex items-center gap-2 text-xs font-semibold text-sub cursor-pointer">
              <input type="checkbox" id="gh-pkg-osce" class="w-4 h-4 rounded" />
              <span>Termasuk materi OSCE</span>
            </label>

            <div id="gh-upload-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

            <button type="button" id="gh-btn-upload-submit"
              class="btn-primary w-full min-h-[46px] rounded-xl text-xs sm:text-sm font-bold">
              Upload ke GitHub
            </button>
          </div>

          <!-- TAB 2: KELOLA & HAPUS PAKET -->
          <div id="gh-panel-manage" class="hidden p-5 space-y-4">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-sub">Kelola seluruh paket soal portal</p>
              <button type="button" id="gh-btn-refresh-cloud" class="btn-secondary px-3 h-8 rounded-lg text-xs font-semibold">Muat Ulang</button>
            </div>
            <div id="gh-manage-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>
            <div id="gh-manage-list" class="space-y-4"></div>
          </div>

          <!-- TAB 3: PENGATURAN GITHUB -->
          <div id="gh-panel-settings" class="hidden p-5 space-y-4">
            <div class="subtle border p-3 rounded-xl text-xs text-sub leading-relaxed">
              Simpan pengaturan ke <strong>config.json</strong> di repository agar perangkat lain otomatis mengenali Owner, Repo, dan Token terenkripsi (AES-GCM). Gunakan <strong>Sandi Enkripsi khusus</strong> (bukan PIN bawaan <code>admin2026</code>) serta Fine-Grained PAT dengan izin <strong>Contents: Read and write</strong> hanya pada repository ini.
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Owner</label>
                <input type="text" id="gh-cfg-owner" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Repository</label>
                <input type="text" id="gh-cfg-repo" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Branch</label>
                <input type="text" id="gh-cfg-branch" value="main" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Personal Access Token (PAT)</label>
              <input type="password" id="gh-cfg-token" placeholder="github_pat_..." class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Sandi Enkripsi Token (untuk sinkronisasi lintas perangkat)</label>
              <input type="password" id="gh-cfg-passphrase" placeholder="Buat sandi rahasia minimal 6 karakter..." class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              <p class="text-[11px] text-mute mt-1">Sandi ini tidak pernah disimpan ke GitHub—hanya digunakan untuk mengunci &amp; membuka token di perangkat lain.</p>
            </div>

            <div id="gh-settings-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

            <div class="flex flex-wrap gap-2 pt-1">
              <button type="button" id="gh-btn-sync-config" class="btn-primary px-4 h-10 rounded-xl text-xs font-bold">
                Simpan &amp; Sinkronkan ke GitHub
              </button>
              <button type="button" id="gh-btn-save-settings" class="btn-secondary px-4 h-10 rounded-xl text-xs font-semibold">
                Simpan Lokal Saja
              </button>
              <button type="button" id="gh-btn-test-conn" class="btn-secondary px-4 h-10 rounded-xl text-xs font-semibold">
                Tes Koneksi
              </button>
              <button type="button" id="gh-btn-clear-token" class="btn-secondary px-4 h-10 rounded-xl text-rose-600 text-xs font-semibold">
                Hapus Sesi Lokal
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#gh-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    modal.querySelectorAll('.gh-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchGhTab(btn.getAttribute('data-gh-tab')));
    });

    modal.querySelector('#gh-btn-goto-settings').addEventListener('click', () => switchGhTab('settings'));

    modal.querySelector('#gh-btn-quick-lock').addEventListener('click', () => {
      saveToken('', false);
      modal.querySelector('#gh-cfg-token').value = '';
      updateAuthBannerUI();
    });

    // Buka kunci token dari config.json
    async function handleUnlockVault() {
      const passInput = modal.querySelector('#gh-unlock-passphrase');
      const remember = modal.querySelector('#gh-unlock-remember').checked;
      const pass = (passInput.value || '').trim();
      if (!pass) {
        showStatus('#gh-unlock-status', 'Masukkan Sandi Enkripsi terlebih dahulu.', false);
        passInput.focus();
        return;
      }

      const btn = modal.querySelector('#gh-btn-unlock-submit');
      btn.disabled = true;
      btn.textContent = 'Membuka...';
      try {
        const cfg = getEffectiveConfig();
        const plainToken = await decryptTokenFromVault(cfg.encryptedToken, pass);
        saveToken(plainToken, remember);
        passInput.value = '';
        modal.querySelector('#gh-cfg-token').value = plainToken;
        modal.querySelector('#gh-unlock-status').classList.add('hidden');
        updateAuthBannerUI();
      } catch (err) {
        showStatus('#gh-unlock-status', err.message, false);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Buka Kunci';
      }
    }

    modal.querySelector('#gh-btn-unlock-submit').addEventListener('click', handleUnlockVault);
    modal.querySelector('#gh-unlock-passphrase').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlockVault();
      }
    });

    // Input file soal
    modal.querySelector('#gh-file-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingUploadHtml = String(reader.result || '');
        pendingUploadFileName = slugifyFileName(file.name);
        const sizeKb = (file.size / 1024).toFixed(1);
        modal.querySelector('#gh-file-info').textContent = `✓ ${pendingUploadFileName} (${sizeKb} KB)`;

        const titleMatch = pendingUploadHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const titleInput = modal.querySelector('#gh-pkg-title');
        if (titleMatch && !titleInput.value.trim()) {
          titleInput.value = titleMatch[1].trim();
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    modal.querySelector('#gh-btn-upload-submit').addEventListener('click', handleUploadToGitHub);
    modal.querySelector('#gh-btn-refresh-cloud').addEventListener('click', async () => {
      await loadRepoConfig(true);
      await loadCloudManifest(true);
    });

    // Simpan lokal saja
    modal.querySelector('#gh-btn-save-settings').addEventListener('click', () => {
      const owner = modal.querySelector('#gh-cfg-owner').value.trim();
      const repo = modal.querySelector('#gh-cfg-repo').value.trim();
      const branch = (modal.querySelector('#gh-cfg-branch').value || 'main').trim();
      const token = modal.querySelector('#gh-cfg-token').value.trim();
      saveConfigOverride(owner, repo, branch);
      if (token) saveToken(token, true);
      updateAuthBannerUI();
      showStatus('#gh-settings-status', 'Pengaturan tersimpan di browser perangkat ini saja.', true);
    });

    // Simpan & Sinkronkan ke GitHub (config.json dengan token terenkripsi)
    modal.querySelector('#gh-btn-sync-config').addEventListener('click', async () => {
      const owner = modal.querySelector('#gh-cfg-owner').value.trim();
      const repo = modal.querySelector('#gh-cfg-repo').value.trim();
      const branch = (modal.querySelector('#gh-cfg-branch').value || 'main').trim();
      const token = modal.querySelector('#gh-cfg-token').value.trim() || getSavedToken();
      const passphrase = modal.querySelector('#gh-cfg-passphrase').value.trim();

      if (!owner || !repo) {
        showStatus('#gh-settings-status', 'Owner dan Repository wajib diisi.', false);
        return;
      }
      if (!token) {
        showStatus('#gh-settings-status', 'Masukkan Personal Access Token (PAT) terlebih dahulu.', false);
        return;
      }
      if (passphrase.length < 6) {
        showStatus('#gh-settings-status', 'Buat Sandi Enkripsi minimal 6 karakter untuk mengunci token di config.json.', false);
        modal.querySelector('#gh-cfg-passphrase').focus();
        return;
      }
      if (passphrase.toLowerCase() === 'admin2026') {
        showStatus('#gh-settings-status', 'Jangan gunakan PIN bawaan "admin2026" sebagai Sandi Enkripsi. Gunakan sandi rahasia lain.', false);
        modal.querySelector('#gh-cfg-passphrase').focus();
        return;
      }

      const btn = modal.querySelector('#gh-btn-sync-config');
      btn.disabled = true;
      btn.textContent = 'Menyinkronkan...';
      showStatus('#gh-settings-status', '1/2 Mengenkripsi token & memverifikasi koneksi...', true);

      try {
        const targetCfg = {
          owner,
          repo,
          branch,
          manifestPath: repoConfig.manifestPath || 'data/manifest.json',
          packagesDir: repoConfig.packagesDir || 'data/packages'
        };

        const repoInfo = await githubRequest('', 'GET', null, token, targetCfg);
        if (!repoInfo.permissions || !repoInfo.permissions.push) {
          throw new Error('Token valid, tetapi tidak memiliki izin tulis (Contents: Read and write).');
        }

        const encryptedToken = await encryptTokenToVault(token, passphrase);
        const newConfigObj = {
          owner,
          repo,
          branch,
          manifestPath: targetCfg.manifestPath,
          packagesDir: targetCfg.packagesDir,
          encryptedToken,
          hiddenBuiltinIds: getHiddenBuiltinIds(),
          updatedAt: new Date().toISOString()
        };

        showStatus('#gh-settings-status', '2/2 Menyimpan config.json ke repository GitHub...', true);
        await putRepoFile(
          'config.json',
          JSON.stringify(newConfigObj, null, 2),
          'Update config.json (sinkronisasi repo & token terenkripsi)',
          token,
          targetCfg
        );

        repoConfig = Object.assign({}, repoConfig, newConfigObj);
        clearConfigOverride();
        saveToken(token, true);
        modal.querySelector('#gh-cfg-passphrase').value = '';
        updateAuthBannerUI();

        showStatus(
          '#gh-settings-status',
          'Berhasil! config.json tersimpan di GitHub. Di perangkat lain cukup masukkan Sandi Enkripsi untuk membuka kunci.',
          true
        );
      } catch (err) {
        showStatus('#gh-settings-status', err.message, false);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Simpan & Sinkronkan ke GitHub';
      }
    });

    modal.querySelector('#gh-btn-clear-token').addEventListener('click', () => {
      saveToken('', false);
      clearConfigOverride();
      modal.querySelector('#gh-cfg-token').value = '';
      updateAuthBannerUI();
      showStatus('#gh-settings-status', 'Sesi token di browser ini telah dihapus.', true);
    });

    modal.querySelector('#gh-btn-test-conn').addEventListener('click', async () => {
      const owner = modal.querySelector('#gh-cfg-owner').value.trim();
      const repo = modal.querySelector('#gh-cfg-repo').value.trim();
      const branch = (modal.querySelector('#gh-cfg-branch').value || 'main').trim();
      const token = modal.querySelector('#gh-cfg-token').value.trim() || getSavedToken();

      if (!owner || !repo) {
        showStatus('#gh-settings-status', 'Isi Owner dan Repository terlebih dahulu.', false);
        return;
      }
      if (!token) {
        showStatus('#gh-settings-status', 'Masukkan token atau buka kunci token terlebih dahulu.', false);
        return;
      }
      showStatus('#gh-settings-status', 'Menguji koneksi...', true);
      try {
        const repoInfo = await githubRequest('', 'GET', null, token, { owner, repo, branch });
        const canPush = repoInfo.permissions && repoInfo.permissions.push;
        showStatus(
          '#gh-settings-status',
          `Terhubung ke ${repoInfo.full_name} (Izin tulis: ${canPush ? 'YA' : 'TIDAK'}).`,
          Boolean(canPush)
        );
      } catch (err) {
        showStatus('#gh-settings-status', err.message, false);
      }
    });

    switchGhTab('upload');
    return modal;
  }

  function switchGhTab(tabName) {
    const modal = ensureAdminModal();
    ['upload', 'manage', 'settings'].forEach((name) => {
      const panel = modal.querySelector(`#gh-panel-${name}`);
      const btn = modal.querySelector(`[data-gh-tab="${name}"]`);
      if (name === tabName) {
        panel.classList.remove('hidden');
        btn.style.borderColor = 'var(--text-primary)';
        btn.style.color = 'var(--text-primary)';
      } else {
        panel.classList.add('hidden');
        btn.style.borderColor = 'transparent';
        btn.style.color = 'var(--text-muted)';
      }
    });
  }

  function showStatus(selector, message, isSuccess) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message;
    el.className = `p-3 rounded-xl text-xs font-semibold ${
      isSuccess
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
    }`;
    el.classList.remove('hidden');
  }

  async function handleUploadToGitHub() {
    const modal = ensureAdminModal();
    const token = getSavedToken();
    const cfg = getEffectiveConfig();

    if (!token || !cfg.owner || !cfg.repo) {
      if (hasCloudVault()) {
        showStatus('#gh-upload-status', 'Masukkan Sandi Enkripsi pada kotak Buka Kunci di atas terlebih dahulu.', false);
        const inp = modal.querySelector('#gh-unlock-passphrase');
        if (inp) inp.focus();
      } else {
        showStatus('#gh-upload-status', 'Lengkapi Owner, Repository, dan Token di tab Pengaturan.', false);
        switchGhTab('settings');
      }
      return;
    }
    if (!pendingUploadHtml) {
      showStatus('#gh-upload-status', 'Pilih file soal .html terlebih dahulu.', false);
      return;
    }

    const code = (modal.querySelector('#gh-pkg-code').value || 'BARU').trim().toUpperCase();
    const org = (modal.querySelector('#gh-pkg-org').value || 'Try Out Nasional').trim();
    const title = (modal.querySelector('#gh-pkg-title').value || pendingUploadFileName).trim();
    const questions = parseInt(modal.querySelector('#gh-pkg-qcount').value, 10) || 0;
    const duration = (modal.querySelector('#gh-pkg-duration').value || '100 Menit').trim();
    const highlights = (modal.querySelector('#gh-pkg-highlights').value || 'Paket simulasi CBT lengkap dengan pembahasan.').trim();
    const hasOsce = modal.querySelector('#gh-pkg-osce').checked;

    const id = 'gh_' + Date.now().toString(36);
    const uniqueFileName = `${id}_${pendingUploadFileName}`;
    const pkgFilePath = `${cfg.packagesDir}/${uniqueFileName}`;
    const btn = modal.querySelector('#gh-btn-upload-submit');

    btn.disabled = true;
    btn.textContent = 'Mengunggah...';
    showStatus('#gh-upload-status', '1/2 Mengunggah file soal ke GitHub...', true);

    try {
      await putRepoFile(pkgFilePath, pendingUploadHtml, `Upload paket soal: ${code} - ${title}`, token);

      showStatus('#gh-upload-status', '2/2 Memperbarui manifest...', true);
      const manifestData = await getFileSha(cfg.manifestPath, token);
      let manifestObj = { updatedAt: '', packages: [] };
      if (manifestData.content) {
        try {
          manifestObj = JSON.parse(manifestData.content);
        } catch (e) {}
      }
      if (!Array.isArray(manifestObj.packages)) manifestObj.packages = [];

      manifestObj.packages.unshift({
        id,
        code,
        name: org,
        title,
        fileName: uniqueFileName,
        questions,
        duration,
        hasOsce,
        highlights,
        uploadedAt: new Date().toISOString()
      });
      manifestObj.updatedAt = new Date().toISOString();

      await putRepoFile(
        cfg.manifestPath,
        JSON.stringify(manifestObj, null, 2),
        `Update manifest: tambah paket ${code}`,
        token
      );

      pendingUploadHtml = '';
      pendingUploadFileName = '';
      modal.querySelector('#gh-file-input').value = '';
      modal.querySelector('#gh-file-info').textContent = '';

      showStatus('#gh-upload-status', 'Berhasil diunggah ke GitHub!', true);
      await loadCloudManifest(true);
    } catch (err) {
      showStatus('#gh-upload-status', err.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload ke GitHub';
    }
  }

  // ==================== KELOLA & HAPUS PAKET (CLOUD + BAWAAN) ====================
  function renderManageCloudList() {
    const list = document.getElementById('gh-manage-list');
    if (!list) return;

    const builtins = getBuiltinPackagesMeta();
    const hiddenSet = new Set(getHiddenBuiltinIds());
    const activeBuiltins = builtins.filter((p) => !hiddenSet.has(p.id));
    const removedBuiltins = builtins.filter((p) => hiddenSet.has(p.id));

    const cloudHtml = cloudPackages.length
      ? cloudPackages
          .map(
            (pkg) => `
          <div class="subtle border flex items-center justify-between gap-3 p-3 rounded-xl text-xs">
            <div class="min-w-0">
              <div class="font-bold text-main truncate">[${escapeHtml(pkg.code)}] ${escapeHtml(pkg.title)}</div>
              <div class="text-mute truncate mt-0.5">${escapeHtml(pkg.questions)} soal • ${escapeHtml(pkg.duration)}</div>
            </div>
            <button type="button" data-gh-delete="${escapeHtml(pkg.id)}"
              class="px-3 h-8 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold shrink-0">
              Hapus
            </button>
          </div>`
          )
          .join('')
      : '<p class="text-xs text-mute py-3 text-center subtle border rounded-xl">Belum ada paket tambahan di GitHub.</p>';

    const builtinHtml = activeBuiltins.length
      ? activeBuiltins
          .map(
            (pkg) => `
          <div class="subtle border flex items-center justify-between gap-3 p-3 rounded-xl text-xs">
            <div class="min-w-0">
              <div class="font-bold text-main truncate">[${escapeHtml(pkg.code)}] ${escapeHtml(pkg.title)}</div>
              <div class="text-mute truncate mt-0.5">${escapeHtml(pkg.questions)} soal • ${escapeHtml(pkg.duration)}</div>
            </div>
            <button type="button" data-builtin-delete="${escapeHtml(pkg.id)}"
              class="px-3 h-8 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold shrink-0">
              Hapus
            </button>
          </div>`
          )
          .join('')
      : '<p class="text-xs text-mute py-3 text-center subtle border rounded-xl">Semua paket bawaan sedang disembunyikan.</p>';

    const removedHtml = removedBuiltins.length
      ? `
        <div class="space-y-2 pt-2 border-t" style="border-color: var(--border-color);">
          <div class="text-[11px] font-bold uppercase tracking-wider text-mute">
            Paket Bawaan Terhapus (${removedBuiltins.length})
          </div>
          ${removedBuiltins
            .map(
              (pkg) => `
            <div class="subtle border flex items-center justify-between gap-3 p-2.5 rounded-xl text-xs opacity-80">
              <div class="min-w-0">
                <div class="font-semibold text-sub truncate">[${escapeHtml(pkg.code)}] ${escapeHtml(pkg.title)}</div>
              </div>
              <button type="button" data-builtin-restore="${escapeHtml(pkg.id)}"
                class="btn-secondary px-2.5 h-7 rounded-lg text-[11px] font-bold shrink-0">
                Pulihkan
              </button>
            </div>`
            )
            .join('')}
        </div>`
      : '';

    list.innerHTML = `
      <div class="space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-mute">
          Paket Soal Tambahan GitHub (${cloudPackages.length})
        </div>
        <div class="space-y-2">${cloudHtml}</div>
      </div>

      <div class="space-y-2 pt-2 border-t" style="border-color: var(--border-color);">
        <div class="text-[11px] font-bold uppercase tracking-wider text-mute">
          Paket Soal Utama / Bawaan (${activeBuiltins.length})
        </div>
        <div class="space-y-2">${builtinHtml}</div>
      </div>

      ${removedHtml}
    `;

    list.querySelectorAll('[data-gh-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCloudPackage(btn.getAttribute('data-gh-delete'), btn));
    });

    list.querySelectorAll('[data-builtin-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteBuiltinPackage(btn.getAttribute('data-builtin-delete'), btn));
    });

    list.querySelectorAll('[data-builtin-restore]').forEach((btn) => {
      btn.addEventListener('click', () => handleRestoreBuiltinPackage(btn.getAttribute('data-builtin-restore'), btn));
    });
  }

  async function saveHiddenBuiltinsToCloud(updatedIds, commitMessage) {
    const token = getSavedToken();
    const cfg = getEffectiveConfig();

    setLocalHiddenBuiltinIds(updatedIds);
    syncBuiltinCardsState();
    renderManageCloudList();

    if (!token || !cfg.owner || !cfg.repo) {
      return false;
    }

    const configData = await getFileSha('config.json', token, cfg);
    let currentObj = {};
    if (configData.content) {
      try {
        currentObj = JSON.parse(configData.content);
      } catch (e) {}
    }

    const nextConfigObj = Object.assign(
      {
        owner: cfg.owner,
        repo: cfg.repo,
        branch: cfg.branch || 'main',
        manifestPath: cfg.manifestPath || 'data/manifest.json',
        packagesDir: cfg.packagesDir || 'data/packages',
        encryptedToken: cfg.encryptedToken || null
      },
      currentObj,
      {
        hiddenBuiltinIds: updatedIds,
        updatedAt: new Date().toISOString()
      }
    );

    await putRepoFile(
      'config.json',
      JSON.stringify(nextConfigObj, null, 2),
      commitMessage,
      token,
      cfg
    );
    repoConfig = Object.assign({}, repoConfig, nextConfigObj);
    return true;
  }

  async function handleDeleteBuiltinPackage(pkgId, triggerBtn) {
    const builtins = getBuiltinPackagesMeta();
    const pkg = builtins.find((p) => p.id === pkgId);
    if (!pkg) return;

    if (!confirm(`Hapus paket soal "${pkg.code} — ${pkg.title}" dari portal?`)) return;

    const modalVisible = !ensureAdminModal().classList.contains('hidden');
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Menghapus...';
    }
    if (modalVisible) {
      showStatus('#gh-manage-status', `Menghapus paket ${pkg.code}...`, true);
    }

    try {
      const nextHidden = Array.from(new Set([...getHiddenBuiltinIds(), pkg.id]));
      const synced = await saveHiddenBuiltinsToCloud(
        nextHidden,
        `Hapus paket soal bawaan: ${pkg.code} - ${pkg.title}`
      );

      if (modalVisible) {
        showStatus(
          '#gh-manage-status',
          synced
            ? `Paket "${pkg.title}" berhasil dihapus & disinkronkan ke GitHub.`
            : `Paket "${pkg.title}" dihapus di browser ini. Buka kunci token di atas agar tersinkron ke semua perangkat.`,
          true
        );
      }
    } catch (err) {
      if (modalVisible) {
        showStatus('#gh-manage-status', `Tersimpan lokal, gagal sinkron ke GitHub: ${err.message}`, false);
      } else {
        alert(`Paket dihapus secara lokal, tetapi gagal sinkron ke GitHub: ${err.message}`);
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'Hapus';
      }
    }
  }

  async function handleRestoreBuiltinPackage(pkgId, triggerBtn) {
    const builtins = getBuiltinPackagesMeta();
    const pkg = builtins.find((p) => p.id === pkgId);
    if (!pkg) return;

    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Memulihkan...';
    }
    showStatus('#gh-manage-status', `Memulihkan paket ${pkg.code}...`, true);

    try {
      const nextHidden = getHiddenBuiltinIds().filter((id) => id !== pkg.id);
      const synced = await saveHiddenBuiltinsToCloud(
        nextHidden,
        `Pulihkan paket soal bawaan: ${pkg.code} - ${pkg.title}`
      );

      showStatus(
        '#gh-manage-status',
        synced
          ? `Paket "${pkg.title}" berhasil dipulihkan & disinkronkan ke GitHub.`
          : `Paket "${pkg.title}" dipulihkan di browser ini.`,
        true
      );
    } catch (err) {
      showStatus('#gh-manage-status', `Dipulihkan lokal, gagal sinkron ke GitHub: ${err.message}`, false);
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'Pulihkan';
      }
    }
  }

  async function handleDeleteCloudPackage(pkgId, triggerBtn) {
    const token = getSavedToken();
    const cfg = getEffectiveConfig();
    const modal = ensureAdminModal();
    const modalVisible = !modal.classList.contains('hidden');

    if (!token) {
      if (!modalVisible) {
        await openAdminModalOnTab('manage');
      }
      if (hasCloudVault()) {
        showStatus('#gh-manage-status', 'Masukkan Sandi Enkripsi pada kotak Buka Kunci di atas terlebih dahulu.', false);
        const inp = modal.querySelector('#gh-unlock-passphrase');
        if (inp) inp.focus();
      } else {
        showStatus('#gh-manage-status', 'Masukkan token di tab Pengaturan terlebih dahulu.', false);
      }
      return;
    }

    const pkg = cloudPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    if (!confirm(`Hapus paket "${pkg.code} — ${pkg.title}" secara permanen dari GitHub?`)) return;

    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = 'Menghapus...';
    }
    if (modalVisible) {
      showStatus('#gh-manage-status', `Menghapus paket "${pkg.title}" dari GitHub...`, true);
    }

    try {
      await deleteRepoFile(`${cfg.packagesDir}/${pkg.fileName}`, `Hapus paket soal: ${pkg.code}`, token);

      const manifestData = await getFileSha(cfg.manifestPath, token);
      let manifestObj = { packages: [] };
      if (manifestData.content) {
        try {
          manifestObj = JSON.parse(manifestData.content);
        } catch (e) {}
      }
      manifestObj.packages = (manifestObj.packages || []).filter((p) => p.id !== pkgId);
      manifestObj.updatedAt = new Date().toISOString();

      await putRepoFile(
        cfg.manifestPath,
        JSON.stringify(manifestObj, null, 2),
        `Update manifest: hapus paket ${pkg.code}`,
        token
      );

      if (modalVisible) {
        showStatus('#gh-manage-status', `Paket "${pkg.title}" berhasil dihapus.`, true);
      }
      await loadCloudManifest(true);
    } catch (err) {
      if (modalVisible) {
        showStatus('#gh-manage-status', err.message, false);
      } else {
        alert(err.message);
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'Hapus';
      }
    }
  }

  // ==================== PASANG EVENT PADA TOMBOL ADMIN & OBSERVER ====================
  async function openAdminModalOnTab(tabName) {
    const modal = ensureAdminModal();
    await loadRepoConfig(false);
    const cfg = getEffectiveConfig();
    modal.querySelector('#gh-cfg-owner').value = cfg.owner || '';
    modal.querySelector('#gh-cfg-repo').value = cfg.repo || '';
    modal.querySelector('#gh-cfg-branch').value = cfg.branch || 'main';
    modal.querySelector('#gh-cfg-token').value = getSavedToken();
    updateAuthBannerUI();
    renderManageCloudList();
    if (tabName) switchGhTab(tabName);
    modal.classList.remove('hidden');
  }

  function bindAdminButton() {
    const btn = document.getElementById('btn-open-gh-sync');
    if (!btn || btn.dataset.ghBound === '1') return;
    btn.dataset.ghBound = '1';

    btn.addEventListener('click', () => openAdminModalOnTab('upload'));
  }

  function setupDomObservers() {
    const grid = document.getElementById('packages-grid');
    if (grid && !grid.dataset.ghObserved) {
      grid.dataset.ghObserved = '1';
      const gridObserver = new MutationObserver(() => {
        syncBuiltinCardsState();
      });
      gridObserver.observe(grid, { childList: true });
    }

    const adminObserver = new MutationObserver(() => {
      bindAdminButton();
      syncBuiltinCardsState();
      renderCloudSection();
    });
    adminObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
      subtree: true
    });
  }

  // ==================== INISIALISASI ====================
  async function init() {
    bindAdminButton();
    syncBuiltinCardsState();
    setupDomObservers();
    await loadRepoConfig(false);
    await loadCloudManifest(false);
    syncBuiltinCardsState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
