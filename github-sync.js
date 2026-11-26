(function () {
  'use strict';

  const TOKEN_STORAGE_KEY = 'portal_ukmppdh_gh_token';
  const CFG_OVERRIDE_KEY = 'portal_ukmppdh_gh_cfg';

  let repoConfig = {
    owner: 'bhadreswara2509611047',
    repo: 'Portal-Soal-UKMPPDH',
    branch: 'main',
    manifestPath: 'data/manifest.json',
    packagesDir: 'data/packages'
  };

  let cloudPackages = [];
  let pendingUploadHtml = '';
  let pendingUploadFileName = '';

  // ==================== UTILITAS ENCODING UTF-8 <-> BASE64 ====================
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    const binary = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function encodeRepoPath(filePath) {
    return String(filePath || '')
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }

  function slugifyFileName(name) {
    const base = String(name || 'paket_soal')
      .replace(/\.html?$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (base || 'paket_soal') + '.html';
  }

  function getSavedToken() {
    try {
      return (localStorage.getItem(TOKEN_STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function saveToken(token) {
    try {
      const clean = String(token || '').trim();
      if (clean) localStorage.setItem(TOKEN_STORAGE_KEY, clean);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  }

  function getEffectiveConfig() {
    try {
      const override = JSON.parse(localStorage.getItem(CFG_OVERRIDE_KEY) || 'null');
      if (override && override.owner && override.repo) {
        return Object.assign({}, repoConfig, {
          owner: String(override.owner).trim(),
          repo: String(override.repo).trim(),
          branch: String(override.branch || repoConfig.branch || 'main').trim()
        });
      }
    } catch (e) {}
    return repoConfig;
  }

  function saveConfigOverride(owner, repo, branch) {
    try {
      const cleanOwner = String(owner || '').trim();
      const cleanRepo = String(repo || '').trim();
      const cleanBranch = String(branch || 'main').trim();
      if (!cleanOwner || !cleanRepo) return;
      localStorage.setItem(
        CFG_OVERRIDE_KEY,
        JSON.stringify({
          owner: cleanOwner,
          repo: cleanRepo,
          branch: cleanBranch
        })
      );
    } catch (e) {}
  }

  // ==================== LOAD CONFIG & MANIFEST ====================
  async function loadRepoConfig() {
    try {
      const res = await fetch('./config.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (data.owner && String(data.owner).trim()) repoConfig.owner = String(data.owner).trim();
        if (data.repo && String(data.repo).trim()) repoConfig.repo = String(data.repo).trim();
        if (data.branch && String(data.branch).trim()) repoConfig.branch = String(data.branch).trim();
        if (data.manifestPath && String(data.manifestPath).trim()) repoConfig.manifestPath = String(data.manifestPath).trim();
        if (data.packagesDir && String(data.packagesDir).trim()) repoConfig.packagesDir = String(data.packagesDir).trim();
      }
    } catch (e) {
      console.warn('[GitHubSync] config.json belum terbaca, memakai konfigurasi bawaan:', e);
    }
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
        const res = await fetch(url);
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
  async function githubRequest(path, method, bodyObj, token) {
    const cfg = getEffectiveConfig();
    if (!cfg.owner || !cfg.repo) {
      throw new Error('Owner dan nama repository belum diisi di Tab Pengaturan GitHub.');
    }

    const cleanToken = token ? String(token).trim() : '';
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (cleanToken) headers.Authorization = `Bearer ${cleanToken}`;
    if (bodyObj) headers['Content-Type'] = 'application/json';

    const cleanPath = path ? '/' + String(path).replace(/^\/+/, '') : '';
    const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner.trim())}/${encodeURIComponent(cfg.repo.trim())}${cleanPath}`;

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

  async function getFileSha(filePath, token) {
    const cfg = getEffectiveConfig();
    try {
      const data = await githubRequest(
        `contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(cfg.branch)}`,
        'GET',
        null,
        token
      );
      return { sha: data.sha || null, content: data.content ? base64ToUtf8(data.content) : null };
    } catch (e) {
      if (String(e.message).includes('(404)')) {
        return { sha: null, content: null };
      }
      throw e;
    }
  }

  async function putRepoFile(filePath, contentString, commitMessage, token) {
    const cfg = getEffectiveConfig();
    const existing = await getFileSha(filePath, token);
    const payload = {
      message: commitMessage,
      content: utf8ToBase64(contentString),
      branch: cfg.branch
    };
    if (existing.sha) payload.sha = existing.sha;

    return githubRequest(`contents/${encodeRepoPath(filePath)}`, 'PUT', payload, token);
  }

  async function deleteRepoFile(filePath, commitMessage, token) {
    const cfg = getEffectiveConfig();
    const existing = await getFileSha(filePath, token);
    if (!existing.sha) return;

    return githubRequest(
      `contents/${encodeRepoPath(filePath)}`,
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
        const res = await fetch(url);
        if (res.ok) {
          htmlContent = await res.text();
          break;
        }
      } catch (e) {}
    }

    if (!htmlContent) {
      alert('Gagal memuat file soal dari GitHub. Coba muat ulang beberapa detik lagi.');
      return;
    }

    const overlay = ensureCloudRunnerOverlay();
    const titleEl = overlay.querySelector('#gh-runner-title');
    const iframe = overlay.querySelector('#gh-runner-frame');
    const newTabBtn = overlay.querySelector('#gh-runner-newtab');

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
    newTabBtn.onclick = () => window.open(blobUrl, '_blank', 'noopener');

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function ensureCloudRunnerOverlay() {
    let el = document.getElementById('gh-cloud-runner');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gh-cloud-runner';
    el.className = 'hidden fixed inset-0 z-[90] flex flex-col bg-white dark:bg-zinc-950';
    el.innerHTML = `
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-white text-slate-900">
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" id="gh-runner-close"
            class="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-semibold">
            ← Kembali ke Portal
          </button>
          <span id="gh-runner-title" class="text-sm font-bold truncate">Simulasi CBT</span>
        </div>
        <button type="button" id="gh-runner-newtab"
          class="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-semibold shrink-0">
          Buka Tab Baru ↗
        </button>
      </div>
      <iframe id="gh-runner-frame" class="w-full flex-1 border-0 bg-white"></iframe>
    `;
    document.body.appendChild(el);

    el.querySelector('#gh-runner-close').addEventListener('click', () => {
      el.classList.add('hidden');
      document.body.style.overflow = '';
    });

    return el;
  }

  // ==================== RENDER SEKSI PAKET CLOUD DI PORTAL ====================
  function renderCloudSection() {
    const grid = document.getElementById('packages-grid');
    if (!grid || !grid.parentElement) return;

    let wrap = document.getElementById('gh-cloud-packages-section');
    if (!wrap) {
      wrap = document.createElement('section');
      wrap.id = 'gh-cloud-packages-section';
      wrap.className = 'mt-8';
      grid.parentElement.appendChild(wrap);
    }

    if (!cloudPackages.length) {
      wrap.innerHTML = '';
      return;
    }

    wrap.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 class="text-base font-extrabold tracking-tight">Paket Soal Tambahan (Cloud GitHub)</h2>
          <p class="text-xs text-slate-500">Diunggah langsung melalui GitHub API dan otomatis tersedia untuk semua pengguna.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          ${cloudPackages.length} Paket Tersinkron
        </span>
      </div>
      <div id="gh-cloud-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${cloudPackages
          .map(
            (pkg) => `
          <div class="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4 shadow-sm">
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">${escapeHtml(pkg.code)}</span>
                <span class="text-xs text-slate-500">${escapeHtml(pkg.questions)} Soal • ${escapeHtml(pkg.duration)}</span>
              </div>
              <h3 class="font-bold text-sm leading-snug mb-1">${escapeHtml(pkg.title)}</h3>
              <p class="text-xs text-slate-500 mb-2">${escapeHtml(pkg.name || 'Paket Cloud GitHub')}</p>
              <p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(pkg.highlights || '')}</p>
            </div>
            <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              ${
                pkg.hasOsce
                  ? '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800">CBT + OSCE</span>'
                  : '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">CBT</span>'
              }
              <button type="button" data-gh-open="${escapeHtml(pkg.id)}"
                class="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold">
                Mulai Simulasi →
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
  }

  // ==================== MODAL UPLOAD & KELOLA GITHUB API (ADMIN) ====================
  function ensureAdminModal() {
    let modal = document.getElementById('gh-sync-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'gh-sync-modal';
    modal.className = 'hidden fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 class="text-base font-extrabold">Upload & Sinkronisasi Soal via GitHub API</h3>
            <p class="text-xs text-slate-500">Unggah file soal HTML langsung ke repository GitHub Pages Anda.</p>
          </div>
          <button type="button" id="gh-modal-close" class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">Tutup ✕</button>
        </div>

        <div class="flex gap-2 px-6 pt-4 border-b border-slate-200 text-xs font-bold">
          <button type="button" data-gh-tab="upload" class="gh-tab-btn pb-2.5 border-b-2 border-zinc-900">1. Upload Paket HTML</button>
          <button type="button" data-gh-tab="manage" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-slate-500">2. Kelola Paket Cloud</button>
          <button type="button" data-gh-tab="settings" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-slate-500">3. Pengaturan GitHub API</button>
        </div>

        <!-- TAB 1: UPLOAD HTML -->
        <div id="gh-panel-upload" class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold mb-1.5">Pilih File Soal (.html)</label>
            <input type="file" id="gh-file-input" accept=".html,.htm"
              class="block w-full text-xs border border-slate-300 rounded-lg p-2" />
            <p id="gh-file-info" class="text-xs text-slate-500 mt-1"></p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold mb-1">Kode Singkat (misal: UGM / IPB)</label>
              <input type="text" id="gh-pkg-code" placeholder="UGM" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1">Institusi / Sumber</label>
              <input type="text" id="gh-pkg-org" placeholder="Universitas Gadjah Mada" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1">Judul Paket Soal</label>
            <input type="text" id="gh-pkg-title" placeholder="TO Nasional CBT UKMPPDH 2026" class="w-full px-3 py-2 text-xs rounded-lg border" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold mb-1">Jumlah Soal</label>
              <input type="number" id="gh-pkg-qcount" value="100" min="1" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1">Durasi</label>
              <input type="text" id="gh-pkg-duration" value="100 Menit" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1">Deskripsi Singkat</label>
            <input type="text" id="gh-pkg-highlights" placeholder="Lengkap dengan pembahasan dan mode latihan." class="w-full px-3 py-2 text-xs rounded-lg border" />
          </div>

          <label class="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" id="gh-pkg-osce" />
            <span>Paket ini menyertakan latihan OSCE</span>
          </label>

          <div id="gh-upload-status" class="hidden p-3 rounded-lg text-xs font-semibold"></div>

          <button type="button" id="gh-btn-upload-submit"
            class="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold">
            Upload & Commit ke GitHub
          </button>
        </div>

        <!-- TAB 2: KELOLA PAKET -->
        <div id="gh-panel-manage" class="hidden p-6 space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs text-slate-500">Daftar paket di <code class="font-mono">data/manifest.json</code></p>
            <button type="button" id="gh-btn-refresh-cloud" class="px-3 py-1.5 rounded-lg border text-xs font-bold">Refresh Daftar</button>
          </div>
          <div id="gh-manage-list" class="space-y-2.5"></div>
          <div id="gh-manage-status" class="hidden p-3 rounded-lg text-xs font-semibold"></div>
        </div>

        <!-- TAB 3: PENGATURAN GITHUB API -->
        <div id="gh-panel-settings" class="hidden p-6 space-y-4">
          <div class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Keamanan:</strong> Token disimpan hanya di <code>localStorage</code> browser perangkat Admin ini dan tidak pernah dikirim ke file repository. Gunakan <em>Fine-Grained Personal Access Token</em> khusus untuk 1 repository ini dengan izin <strong>Contents: Read and write</strong>.
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold mb-1">GitHub Owner</label>
              <input type="text" id="gh-cfg-owner" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1">Nama Repository</label>
              <input type="text" id="gh-cfg-repo" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1">Branch</label>
              <input type="text" id="gh-cfg-branch" value="main" class="w-full px-3 py-2 text-xs rounded-lg border" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold mb-1">GitHub Personal Access Token (PAT)</label>
            <input type="password" id="gh-cfg-token" placeholder="github_pat_..." class="w-full px-3 py-2 text-xs rounded-lg border" />
          </div>

          <div id="gh-settings-status" class="hidden p-3 rounded-lg text-xs font-semibold"></div>

          <div class="flex flex-wrap gap-2">
            <button type="button" id="gh-btn-save-settings" class="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold">
              Simpan Pengaturan
            </button>
            <button type="button" id="gh-btn-test-conn" class="px-4 py-2 rounded-lg border text-xs font-bold">
              Tes Koneksi GitHub API
            </button>
            <button type="button" id="gh-btn-clear-token" class="px-4 py-2 rounded-lg border text-rose-600 text-xs font-bold">
              Hapus Token dari Browser
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event Tutup & Tab
    modal.querySelector('#gh-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    modal.querySelectorAll('.gh-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchGhTab(btn.getAttribute('data-gh-tab')));
    });

    // Event Baca File HTML Lokal + Auto-Deteksi Judul
    modal.querySelector('#gh-file-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingUploadHtml = String(reader.result || '');
        pendingUploadFileName = slugifyFileName(file.name);
        const sizeKb = (file.size / 1024).toFixed(1);
        modal.querySelector('#gh-file-info').textContent = `Siap diunggah: ${pendingUploadFileName} (${sizeKb} KB)`;

        const titleMatch = pendingUploadHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const titleInput = modal.querySelector('#gh-pkg-title');
        if (titleMatch && !titleInput.value.trim()) {
          titleInput.value = titleMatch[1].trim();
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    // Event Upload ke GitHub
    modal.querySelector('#gh-btn-upload-submit').addEventListener('click', handleUploadToGitHub);

    // Event Refresh Cloud
    modal.querySelector('#gh-btn-refresh-cloud').addEventListener('click', () => loadCloudManifest(true));

    // Event Settings
    modal.querySelector('#gh-btn-save-settings').addEventListener('click', () => {
      const owner = modal.querySelector('#gh-cfg-owner').value;
      const repo = modal.querySelector('#gh-cfg-repo').value;
      const branch = modal.querySelector('#gh-cfg-branch').value;
      const token = modal.querySelector('#gh-cfg-token').value;
      saveConfigOverride(owner, repo, branch);
      if (token.trim()) saveToken(token);
      showStatus('#gh-settings-status', 'Pengaturan & token tersimpan di browser ini.', true);
    });

    modal.querySelector('#gh-btn-clear-token').addEventListener('click', () => {
      saveToken('');
      modal.querySelector('#gh-cfg-token').value = '';
      showStatus('#gh-settings-status', 'Token berhasil dihapus dari browser ini.', true);
    });

    modal.querySelector('#gh-btn-test-conn').addEventListener('click', async () => {
      const token = modal.querySelector('#gh-cfg-token').value.trim() || getSavedToken();
      saveConfigOverride(
        modal.querySelector('#gh-cfg-owner').value,
        modal.querySelector('#gh-cfg-repo').value,
        modal.querySelector('#gh-cfg-branch').value
      );
      if (!token) {
        showStatus('#gh-settings-status', 'Masukkan GitHub PAT terlebih dahulu.', false);
        return;
      }
      showStatus('#gh-settings-status', 'Menguji koneksi ke GitHub API...', true);
      try {
        const repoInfo = await githubRequest('', 'GET', null, token);
        const canPush = repoInfo.permissions && repoInfo.permissions.push;
        showStatus(
          '#gh-settings-status',
          `Terhubung ke ${repoInfo.full_name} (Izin tulis: ${canPush ? 'YA' : 'TIDAK — cek izin Contents'}).`,
          Boolean(canPush)
        );
      } catch (err) {
        showStatus('#gh-settings-status', err.message, false);
      }
    });

    return modal;
  }

  function switchGhTab(tabName) {
    const modal = ensureAdminModal();
    ['upload', 'manage', 'settings'].forEach((name) => {
      const panel = modal.querySelector(`#gh-panel-${name}`);
      const btn = modal.querySelector(`[data-gh-tab="${name}"]`);
      if (name === tabName) {
        panel.classList.remove('hidden');
        btn.classList.add('border-zinc-900');
        btn.classList.remove('border-transparent', 'text-slate-500');
      } else {
        panel.classList.add('hidden');
        btn.classList.remove('border-zinc-900');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });
  }

  function showStatus(selector, message, isSuccess) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message;
    el.className = `p-3 rounded-lg text-xs font-semibold ${
      isSuccess
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        : 'bg-rose-50 text-rose-800 border border-rose-200'
    }`;
    el.classList.remove('hidden');
  }

  async function handleUploadToGitHub() {
    const modal = ensureAdminModal();
    const token = getSavedToken() || modal.querySelector('#gh-cfg-token').value.trim();
    const cfg = getEffectiveConfig();

    if (!token || !cfg.owner || !cfg.repo) {
      showStatus('#gh-upload-status', 'Isi Owner, Repo, dan Token di Tab "3. Pengaturan GitHub API" terlebih dahulu.', false);
      switchGhTab('settings');
      return;
    }
    if (!pendingUploadHtml) {
      showStatus('#gh-upload-status', 'Pilih file soal .html terlebih dahulu.', false);
      return;
    }

    const code = (modal.querySelector('#gh-pkg-code').value || 'BARU').trim().toUpperCase();
    const org = (modal.querySelector('#gh-pkg-org').value || 'Paket Cloud').trim();
    const title = (modal.querySelector('#gh-pkg-title').value || pendingUploadFileName).trim();
    const questions = parseInt(modal.querySelector('#gh-pkg-qcount').value, 10) || 0;
    const duration = (modal.querySelector('#gh-pkg-duration').value || '100 Menit').trim();
    const highlights = (modal.querySelector('#gh-pkg-highlights').value || 'Paket soal CBT tambahan.').trim();
    const hasOsce = modal.querySelector('#gh-pkg-osce').checked;

    const id = 'gh_' + Date.now().toString(36);
    const uniqueFileName = `${id}_${pendingUploadFileName}`;
    const pkgFilePath = `${cfg.packagesDir}/${uniqueFileName}`;
    const btn = modal.querySelector('#gh-btn-upload-submit');

    btn.disabled = true;
    btn.textContent = 'Mengunggah ke GitHub...';
    showStatus('#gh-upload-status', '1/2 Mengunggah file HTML soal ke repository...', true);

    try {
      // 1. Upload file HTML ke data/packages/
      await putRepoFile(pkgFilePath, pendingUploadHtml, `Upload paket soal: ${code} - ${title}`, token);

      // 2. Ambil manifest terbaru lalu update
      showStatus('#gh-upload-status', '2/2 Memperbarui data/manifest.json...', true);
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

      showStatus(
        '#gh-upload-status',
        'Berhasil diunggah ke GitHub! Paket langsung bisa dibuka (GitHub Pages juga akan otomatis rebuild dalam ~1 menit).',
        true
      );
      await loadCloudManifest(true);
    } catch (err) {
      showStatus('#gh-upload-status', err.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload & Commit ke GitHub';
    }
  }

  function renderManageCloudList() {
    const list = document.getElementById('gh-manage-list');
    if (!list) return;

    if (!cloudPackages.length) {
      list.innerHTML = '<p class="text-xs text-slate-500">Belum ada paket soal di Cloud GitHub.</p>';
      return;
    }

    list.innerHTML = cloudPackages
      .map(
        (pkg) => `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 text-xs">
        <div class="min-w-0">
          <div class="font-bold truncate">[${escapeHtml(pkg.code)}] ${escapeHtml(pkg.title)}</div>
          <div class="text-slate-500 truncate">${escapeHtml(pkg.fileName)} • ${escapeHtml(pkg.questions)} soal</div>
        </div>
        <button type="button" data-gh-delete="${escapeHtml(pkg.id)}"
          class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold shrink-0">
          Hapus
        </button>
      </div>`
      )
      .join('');

    list.querySelectorAll('[data-gh-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCloudPackage(btn.getAttribute('data-gh-delete')));
    });
  }

  async function handleDeleteCloudPackage(pkgId) {
    const modal = ensureAdminModal();
    const token = getSavedToken() || modal.querySelector('#gh-cfg-token').value.trim();
    const cfg = getEffectiveConfig();
    if (!token) {
      showStatus('#gh-manage-status', 'Masukkan GitHub PAT di Tab Pengaturan terlebih dahulu.', false);
      return;
    }
    const pkg = cloudPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    if (!confirm(`Hapus paket "${pkg.title}" dari repository GitHub?`)) return;

    showStatus('#gh-manage-status', 'Menghapus file dan memperbarui manifest...', true);
    try {
      await deleteRepoFile(`${cfg.packagesDir}/${pkg.fileName}`, `Hapus paket soal: ${pkg.code}`, token);

      const manifestData = await getFileSha(cfg.manifestPath, token);
      const manifestObj = manifestData.content ? JSON.parse(manifestData.content) : { packages: [] };
      manifestObj.packages = (manifestObj.packages || []).filter((p) => p.id !== pkgId);
      manifestObj.updatedAt = new Date().toISOString();

      await putRepoFile(
        cfg.manifestPath,
        JSON.stringify(manifestObj, null, 2),
        `Update manifest: hapus paket ${pkg.code}`,
        token
      );

      showStatus('#gh-manage-status', 'Paket berhasil dihapus dari GitHub.', true);
      await loadCloudManifest(true);
    } catch (err) {
      showStatus('#gh-manage-status', err.message, false);
    }
  }

  // ==================== SUNTIK TOMBOL ADMIN DI HEADER PORTAL ====================
  function injectAdminButton() {
    const adminActions = document.getElementById('admin-header-actions');
    if (!adminActions || document.getElementById('btn-open-gh-sync')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-open-gh-sync';
    btn.type = 'button';
    btn.className = 'px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors';
    btn.textContent = '☁ Upload ke GitHub';
    btn.addEventListener('click', () => {
      const modal = ensureAdminModal();
      const cfg = getEffectiveConfig();
      modal.querySelector('#gh-cfg-owner').value = cfg.owner || '';
      modal.querySelector('#gh-cfg-repo').value = cfg.repo || '';
      modal.querySelector('#gh-cfg-branch').value = cfg.branch || 'main';
      modal.querySelector('#gh-cfg-token').value = getSavedToken();
      renderManageCloudList();
      modal.classList.remove('hidden');
    });

    adminActions.appendChild(btn);
  }

  // ==================== INISIALISASI ====================
  async function init() {
    await loadRepoConfig();
    injectAdminButton();
    await loadCloudManifest(false);

    // Pastikan tombol tetap tersedia jika DOM admin berubah setelah login
    const observer = new MutationObserver(() => {
      injectAdminButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
