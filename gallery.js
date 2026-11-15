'use strict';

// Rekaman disimpan otomatis di dalam aplikasi (IndexedDB). Web app tidak boleh
// menulis langsung ke galeri Foto, jadi pengguna tetap perlu mengetuk
// "Simpan Video", tapi rekamannya tidak hilang sebelum itu.

const DB_NAME = 'prompter';
const DB_STORE = 'videos';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

async function dbRun(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, mode);
    const req = fn(t.objectStore(DB_STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// Menyimpan klip satu sesi; mengembalikan id-nya (kosong bila penyimpanan gagal).
async function storeClips(blobs, title) {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const now = Date.now();
    const items = blobs.map((blob, i) => ({
      id: `${now}-${i}`,
      created: now,
      title: (title || 'Tanpa judul') + (blobs.length > 1 ? ` · klip ${i + 1}` : ''),
      name: videoFileName(blob, i),
      type: blob.type,
      size: blob.size,
      blob,
      exported: false,
    }));
    await dbRun('readwrite', (st) => {
      items.forEach((it) => st.put(it));
    });
    return items.map((it) => it.id);
  } catch (e) {
    return [];
  }
}

function listVideos() {
  return dbRun('readonly', (st) => st.getAll()).then((all) => all.sort((a, b) => b.created - a.created));
}

function deleteVideo(id) {
  return dbRun('readwrite', (st) => st.delete(id));
}

async function markExported(ids) {
  if (!ids.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction(DB_STORE, 'readwrite');
    const st = t.objectStore(DB_STORE);
    ids.forEach((id) => {
      const req = st.get(id);
      req.onsuccess = () => req.result && st.put(Object.assign(req.result, { exported: true }));
    });
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

// ---------- Halaman Rekaman ----------

function formatSize(bytes) {
  return bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(bytes / 1e6)) + ' MB';
}

function formatDate(ms) {
  return new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function refreshGalleryButton() {
  try {
    const n = (await listVideos()).length;
    $('btn-gallery').textContent = n ? `🎞 Rekaman tersimpan (${n})` : '🎞 Rekaman tersimpan';
  } catch (e) {
    $('btn-gallery').textContent = '🎞 Rekaman tersimpan';
  }
}

async function renderGallery() {
  const list = $('video-list');
  list.querySelectorAll('video').forEach((v) => URL.revokeObjectURL(v.src));
  list.innerHTML = '';
  let videos = [];
  try {
    videos = await listVideos();
  } catch (e) {
    $('gallery-hint').textContent = 'Penyimpanan di HP ini tidak bisa dibuka.';
  }
  $('gallery-empty').classList.toggle('hidden', videos.length > 0);

  let usage = '';
  try {
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    if (est && est.usage) usage = ` Terpakai ±${formatSize(est.usage)}.`;
  } catch (e) {
    // Perkiraan ruang tidak wajib.
  }
  $('gallery-hint').textContent =
    'Rekaman otomatis tersimpan di aplikasi. Ketuk ⬇︎ lalu pilih "Simpan Video" agar masuk ke galeri Foto, lalu hapus di sini agar HP tidak penuh.' + usage;

  videos.forEach((v) => {
    const li = document.createElement('li');
    li.className = 'video-item';
    li.innerHTML = `
      <div class="video-row">
        <div class="info">
          <div class="title">${escapeHtml(v.title)}</div>
          <div class="meta">${formatDate(v.created)} · ${formatSize(v.size)} · ${v.exported ? '<span class="ok">✓ sudah disimpan</span>' : 'belum disimpan ke Foto'}</div>
        </div>
        <button class="btn small ghost btn-play" aria-label="Putar">▶︎</button>
        <button class="btn small ghost danger btn-del" aria-label="Hapus rekaman">🗑</button>
        <button class="btn small primary btn-save" aria-label="Simpan ke Foto">⬇︎</button>
      </div>`;
    li.querySelector('.btn-play').onclick = () => {
      const existing = li.querySelector('video');
      if (existing) {
        URL.revokeObjectURL(existing.src);
        existing.remove();
        return;
      }
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(v.blob);
      li.appendChild(video);
      video.play().catch(() => {});
    };
    li.querySelector('.btn-save').onclick = async () => {
      const result = await shareVideos([new File([v.blob], v.name, { type: v.type })]);
      if (result === 'shared' || result === 'downloaded') {
        await markExported([v.id]).catch(() => {});
        renderGallery();
      }
    };
    li.querySelector('.btn-del').onclick = async () => {
      const warn = v.exported ? '' : '\n\nRekaman ini BELUM disimpan ke galeri Foto.';
      if (!confirm(`Hapus rekaman "${v.title}" (${formatDate(v.created)})?${warn}`)) return;
      await deleteVideo(v.id).catch(() => {});
      renderGallery();
    };
    list.appendChild(li);
  });
}

function openGallery() {
  show('view-gallery');
  renderGallery();
}

$('btn-gallery').onclick = openGallery;
$('btn-gallery-back').onclick = () => {
  $('video-list').querySelectorAll('video').forEach((v) => {
    v.pause();
    URL.revokeObjectURL(v.src);
  });
  renderLibrary();
};

refreshGalleryButton();
