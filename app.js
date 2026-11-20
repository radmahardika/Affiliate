'use strict';

// ---------- Penyimpanan ----------

const STORE_SCRIPTS = 'prompter.scripts';
const STORE_SETTINGS = 'prompter.settings';

const DEFAULT_SETTINGS = {
  fontSize: 30,
  height: 40,
  shade: 50,
  speed: 4,
  countdown: true,
  voiceProcessing: false,
  boost: 'medium',
  autoSave: true,
  mirror: false,
  quality: '1080',
  recordMode: 'direct',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Penyimpanan penuh atau diblokir; aplikasi tetap jalan tanpa menyimpan.
  }
}

let scripts = load(STORE_SCRIPTS, []);
let settings = Object.assign({}, DEFAULT_SETTINGS, load(STORE_SETTINGS, {}));
let currentId = null;

const TEMPLATE = `[HOOK – 3 detik pertama]
Kalian yang sering ngalamin *masalahnya di sini*, wajib lihat ini!

[MASALAH]
Dulu aku juga sering banget begitu, sampai capek sendiri.

[tunjukkan produk]
Sampai akhirnya aku nemu *nama produk* ini.

[KEUNGGULAN]
Pertama, keunggulan satu.
Kedua, keunggulan dua.
Dan yang paling aku suka, keunggulan tiga.

[HARGA / PROMO]
Harganya cuma sekian, lagi ada promo juga.

[CTA]
Langsung aja klik *keranjang kuning* di bawah, sebelum promonya habis ya!`;

// ---------- Utilitas ----------

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Catatan dalam [kurung siku] hanya untuk penulis naskah dan tidak ditampilkan.
function renderScript(text) {
  return text
    .replace(/^[ \t]*\[[^\]\n]*\][ \t]*(\n|$)/gm, '')
    .replace(/[ \t]*\[[^\]\n]*\]/g, '')
    .trim()
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => {
      const html = escapeHtml(para)
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      return `<p>${html}</p>`;
    })
    .join('');
}

// Rata-rata bicara santai bahasa Indonesia ±2,3 kata per detik.
function stats(text) {
  const spoken = text.replace(/\[[^\]]*\]/g, ' ');
  const words = (spoken.match(/\S+/g) || []).length;
  return { words, seconds: Math.round(words / 2.3) };
}

function formatStats(text) {
  const s = stats(text);
  return `${s.words} kata · ±${s.seconds} detik`;
}

function show(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
}

// ---------- Daftar naskah ----------

function renderLibrary() {
  const list = $('script-list');
  list.innerHTML = '';
  $('empty-hint').classList.toggle('hidden', scripts.length > 0);
  scripts
    .slice()
    .sort((a, b) => b.updated - a.updated)
    .forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="info">
          <div class="title">${escapeHtml(s.title || 'Tanpa judul')}</div>
          <div class="meta">${formatStats(s.body)}</div>
        </div>
        <button class="btn small ghost danger btn-del" aria-label="Hapus naskah">🗑</button>
        <button class="btn small primary btn-rec">🎥 Rekam</button>`;
      li.querySelector('.info').onclick = () => openEditor(s.id);
      li.querySelector('.btn-del').onclick = () => deleteScript(s.id);
      li.querySelector('.btn-rec').onclick = () => {
        currentId = s.id;
        openRecorder();
      };
      list.appendChild(li);
    });
  show('view-library');
  if (typeof refreshGalleryButton === 'function') refreshGalleryButton();
}

function currentScript() {
  return scripts.find((s) => s.id === currentId);
}

function openEditor(id) {
  if (!id) {
    const s = { id: String(Date.now()), title: '', body: '', updated: Date.now() };
    scripts.push(s);
    id = s.id;
  }
  currentId = id;
  const s = currentScript();
  $('edit-title').value = s.title;
  $('edit-body').value = s.body;
  $('edit-stats').textContent = formatStats(s.body);
  show('view-editor');
}

function saveEditor() {
  const s = currentScript();
  if (!s) return;
  s.title = $('edit-title').value.trim();
  s.body = $('edit-body').value;
  s.updated = Date.now();
  save(STORE_SCRIPTS, scripts);
}

function closeEditor() {
  saveEditor();
  // Naskah kosong tidak perlu disimpan.
  scripts = scripts.filter((s) => s.title || s.body.trim());
  save(STORE_SCRIPTS, scripts);
  renderLibrary();
}

$('btn-new').onclick = () => openEditor(null);
$('btn-editor-back').onclick = closeEditor;
$('edit-title').oninput = saveEditor;
$('edit-body').oninput = () => {
  saveEditor();
  $('edit-stats').textContent = formatStats($('edit-body').value);
};
$('btn-template').onclick = () => {
  const body = $('edit-body');
  if (body.value.trim() && !confirm('Ganti isi naskah dengan template?')) return;
  body.value = TEMPLATE;
  body.oninput();
};
function deleteScript(id) {
  const s = scripts.find((x) => x.id === id);
  if (!s || !confirm(`Hapus naskah "${s.title || 'Tanpa judul'}"?`)) return;
  scripts = scripts.filter((x) => x.id !== id);
  save(STORE_SCRIPTS, scripts);
  renderLibrary();
}

$('btn-delete').onclick = () => deleteScript(currentId);
$('btn-record').onclick = () => {
  saveEditor();
  openRecorder();
};

// ---------- Pengaturan tampilan ----------

function applySettings() {
  const root = document.documentElement.style;
  root.setProperty('--font-size', settings.fontSize + 'px');
  root.setProperty('--prompter-h', settings.height + '%');
  root.setProperty('--shade', settings.shade / 100);
  $('speed-label').textContent = 'Kecepatan ' + settings.speed;
  $('cam').classList.toggle('mirror', facing === 'user');
  save(STORE_SETTINGS, settings);
}

function bindSetting(id, key, prop, parse) {
  const el = $(id);
  el[prop] = settings[key];
  el.oninput = el.onchange = () => {
    settings[key] = parse(el[prop]);
    applySettings();
  };
}

bindSetting('set-font', 'fontSize', 'value', Number);
bindSetting('set-height', 'height', 'value', Number);
bindSetting('set-shade', 'shade', 'value', Number);
bindSetting('set-countdown', 'countdown', 'checked', Boolean);
bindSetting('set-voice', 'voiceProcessing', 'checked', Boolean);
bindSetting('set-boost', 'boost', 'value', String);
bindSetting('set-autosave', 'autoSave', 'checked', Boolean);
$('set-boost').addEventListener('change', () => applyBoost());
$('set-voice').addEventListener('change', () => {
  // Pengaturan mikrofon baru berlaku setelah mikrofon dibuka ulang.
  if (videoTrack && !recording) {
    if (audioTrack) audioTrack.stop();
    ensureAudio();
  }
});
bindSetting('set-mirror', 'mirror', 'checked', Boolean);
bindSetting('set-quality', 'quality', 'value', String);
bindSetting('set-mode', 'recordMode', 'value', String);

$('btn-settings').onclick = () => $('settings').classList.remove('hidden');
$('btn-settings-done').onclick = () => $('settings').classList.add('hidden');

// ---------- Gulir teks ----------

let scrollY = 0;
let scrolling = false;
let lastFrame = 0;

function setScroll(y) {
  const max = Math.max(0, $('prompter-text').scrollHeight - $('prompter').clientHeight * 0.5);
  scrollY = Math.min(Math.max(0, y), max);
  $('prompter-text').style.transform = `translateY(${-scrollY}px)`;
}

function scrollStep(now) {
  if (!scrolling) return;
  const dt = lastFrame ? (now - lastFrame) / 1000 : 0;
  lastFrame = now;
  setScroll(scrollY + settings.speed * settings.fontSize * 0.17 * dt);
  requestAnimationFrame(scrollStep);
}

function setScrolling(on) {
  if (on === scrolling) return;
  scrolling = on;
  $('btn-play').textContent = on ? '❚❚' : '▶︎';
  if (on) {
    lastFrame = 0;
    requestAnimationFrame(scrollStep);
  }
}

$('btn-play').onclick = () => setScrolling(!scrolling);
$('btn-rewind').onclick = () => setScroll(0);
$('btn-slower').onclick = () => {
  settings.speed = Math.max(1, settings.speed - 1);
  applySettings();
};
$('btn-faster').onclick = () => {
  settings.speed = Math.min(15, settings.speed + 1);
  applySettings();
};

// Ketuk area teks untuk jeda/lanjut, geser untuk memindah posisi teks.
(function bindPrompterGestures() {
  const el = $('prompter');
  let startY = null;
  let startScroll = 0;
  let moved = false;
  let wasScrolling = false;

  el.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    startScroll = scrollY;
    moved = false;
    wasScrolling = scrolling;
  });
  el.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    if (pinchBusy()) {
      startY = null;
      return;
    }
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 8) {
      moved = true;
      setScrolling(false);
    }
    if (moved) setScroll(startScroll - dy);
  });
  el.addEventListener('pointerup', () => {
    if (startY === null) return;
    startY = null;
    if (pinchBusy()) return;
    if (moved) setScrolling(wasScrolling);
    else setScrolling(!wasScrolling);
  });
  el.addEventListener('pointercancel', () => {
    startY = null;
  });
})();

// ---------- Kamera ----------

let facing = 'user';
let videoTrack = null;
let audioTrack = null;

// Pemrosesan suara ala telepon (peredam gema/bising) membuat suara tipis, jadi
// bawaannya mati agar suara sejernih aplikasi Kamera.
function audioConstraints() {
  const on = settings.voiceProcessing;
  return { echoCancellation: on, noiseSuppression: on, autoGainControl: on, sampleRate: 48000 };
}
let switching = false;
let wakeLock = null;

function videoConstraints() {
  const long = settings.quality === '1080' ? 1920 : 1280;
  const short = settings.quality === '1080' ? 1080 : 720;
  return { facingMode: facing, width: { ideal: long }, height: { ideal: short }, frameRate: { ideal: 30, max: 30 } };
}

function showMessage(text) {
  const el = $('rec-msg');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

// Mikrofon selalu diminta ulang bersama kamera: di iPhone, meminta kamera lagi
// bisa membuat track mikrofon yang lama ikut mati/bisu.
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: audioConstraints() });
  replaceAudio(stream.getAudioTracks()[0] || null);
  videoTrack = stream.getVideoTracks()[0];
  const cam = $('cam');
  cam.srcObject = new MediaStream([videoTrack]);
  await cam.play().catch(() => {});
  cam.classList.toggle('mirror', facing === 'user');
  lastFrameAt = performance.now();
  watchFrames();
  if (zoomLevel !== 1) setZoom(zoomLevel);
}

function replaceAudio(track) {
  if (audioTrack && audioTrack !== track) audioTrack.stop();
  audioTrack = track;
  connectMic();
}

async function ensureAudio() {
  if (audioTrack && audioTrack.readyState === 'live' && !audioTrack.muted) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() });
    replaceAudio(stream.getAudioTracks()[0] || null);
  } catch (e) {
    // Tetap merekam tanpa suara; layar hasil akan memberi peringatan.
  }
}

function stopCamera() {
  [videoTrack, audioTrack].forEach((t) => t && t.stop());
  videoTrack = audioTrack = null;
  connectMic();
  $('cam').srcObject = null;
}

// Membuka ulang kamera: untuk ganti kamera depan/belakang, atau untuk menyambung
// lagi kamera yang berhenti mengirim gambar di tengah rekaman.
async function restartCamera(newFacing) {
  if (switching) return;
  switching = true;
  $('btn-flip').disabled = true;
  $('btn-shutter').disabled = true;
  const previous = facing;
  facing = newFacing;
  // Mode mulus merekam langsung dari track kamera, jadi klip yang sedang
  // berjalan ditutup dulu dan klip baru dimulai dengan kamera berikutnya.
  const split = recording && !canvasMode();
  try {
    if (split) await finishRecorder();
    // iPhone hanya bisa membuka satu kamera sekaligus, jadi kamera lama dimatikan dulu.
    // Di mode satu file, kanvas menahan frame terakhir selama jeda singkat ini.
    if (videoTrack) videoTrack.stop();
    await startCamera();
  } catch (e) {
    facing = previous;
    try {
      await startCamera();
    } catch (e2) {
      showMessage('Kamera tidak bisa dibuka: ' + e2.message);
    }
  } finally {
    switching = false;
    if (recording) {
      if (split) {
        await ensureAudio();
        startRecorder();
      } else {
        scheduleDraw();
      }
    }
    lastFrameAt = performance.now();
    watchFrames();
    $('btn-flip').disabled = false;
    $('btn-shutter').disabled = false;
  }
}

$('btn-flip').onclick = () => {
  // Rentang zoom tiap kamera berbeda, jadi kamera baru mulai dari 1×.
  zoomLevel = 1;
  restartCamera(facing === 'user' ? 'environment' : 'user');
};

// ---------- Zoom (cubit dua jari) ----------
// Memakai zoom kamera iPhone sendiri (iOS 17+), jadi hasil rekaman ikut ter-zoom.

let zoomLevel = 1;
let zoomFrame = null;
let pinch = null;
let pinchEndedAt = 0;
let zoomLabelTimer = null;

function zoomRange() {
  const caps = videoTrack && videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
  return caps && caps.zoom ? caps.zoom : null;
}

function showZoomLabel(text) {
  const el = $('zoom-label');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(zoomLabelTimer);
  zoomLabelTimer = setTimeout(() => el.classList.add('hidden'), 1200);
}

function setZoom(z) {
  const range = zoomRange();
  if (!range) {
    zoomLevel = 1;
    showZoomLabel('Zoom tidak didukung di HP ini');
    return;
  }
  zoomLevel = Math.min(range.max, Math.max(range.min, z));
  // Satu perubahan per frame layar, agar kamera tidak kebanjiran permintaan.
  if (!zoomFrame) {
    zoomFrame = requestAnimationFrame(() => {
      zoomFrame = null;
      if (videoTrack) videoTrack.applyConstraints({ advanced: [{ zoom: zoomLevel }] }).catch(() => {});
    });
  }
  showZoomLabel(zoomLevel.toFixed(1) + '×');
  $('btn-zoom-reset').classList.toggle('hidden', zoomLevel <= (range.min || 1) + 0.05);
  $('btn-zoom-reset').textContent = zoomLevel.toFixed(1) + '× → 1×';
}

function pinchBusy() {
  return pinch !== null || performance.now() - pinchEndedAt < 300;
}

function touchDistance(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

(function bindPinchZoom() {
  const el = $('view-recorder');
  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { dist: touchDistance(e.touches), zoom: zoomLevel };
  });
  el.addEventListener(
    'touchmove',
    (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      setZoom(pinch.zoom * (touchDistance(e.touches) / pinch.dist));
    },
    { passive: false }
  );
  const end = (e) => {
    if (pinch && e.touches.length < 2) {
      pinch = null;
      pinchEndedAt = performance.now();
    }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
})();

$('btn-zoom-reset').onclick = () => setZoom(1);

// ---------- Penjaga kamera ----------
// iPhone kadang menghentikan kamera di tengah rekaman (misalnya saat pengaturan
// audio berubah), sehingga gambar membeku sementara suara tetap jalan. Bila
// selama 1,5 detik tidak ada gambar baru, kamera dibuka ulang otomatis.

let lastFrameAt = 0;
let frameGen = 0;
let stallCount = 0;

function watchFrames() {
  const cam = $('cam');
  if (!('requestVideoFrameCallback' in cam)) return;
  const gen = ++frameGen;
  const tick = () => {
    if (gen !== frameGen) return;
    lastFrameAt = performance.now();
    cam.requestVideoFrameCallback(tick);
  };
  cam.requestVideoFrameCallback(tick);
}

function cameraStalled() {
  if (!videoTrack) return false;
  if (videoTrack.readyState === 'ended' || videoTrack.muted) return true;
  return 'requestVideoFrameCallback' in $('cam') && performance.now() - lastFrameAt > 1500;
}

setInterval(() => {
  if (recording && !switching && cameraStalled()) {
    stallCount += 1;
    restartCamera(facing);
  }
}, 500);

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {
    wakeLock = null;
  }
}

async function openRecorder() {
  const s = currentScript();
  $('prompter-text').innerHTML = renderScript(s ? s.body : '') || '<p>(Naskah kosong)</p>';
  setScrolling(false);
  show('view-recorder');
  applySettings();
  setScroll(0);
  showMessage('');
  zoomLevel = 1;
  $('btn-zoom-reset').classList.add('hidden');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Browser ini tidak mendukung kamera. Buka lewat Safari dengan alamat https://');
    return;
  }
  try {
    await startCamera();
    requestWakeLock();
  } catch (e) {
    showMessage('Izin kamera/mikrofon ditolak. Buka Pengaturan iPhone → Safari → Kamera & Mikrofon → Izinkan, lalu coba lagi.');
  }
}

async function closeRecorder() {
  if (recording) await stopSession(false);
  setScrolling(false);
  stopCamera();
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
  renderLibrary();
}

$('btn-rec-close').onclick = closeRecorder;

// ---------- Perekaman ----------
// Mode mulus (bawaan): video direkam langsung dari kamera sehingga frame rate-nya
// stabil. Ganti kamera saat merekam menghasilkan klip baru.
// Mode satu file: video direkam dari kanvas yang digambar ulang setiap ada frame
// kamera baru, sehingga ganti kamera tetap menghasilkan satu file 9:16.

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let recording = false; // satu sesi rekam, dari tombol rekam sampai tombol stop
let recorder = null;   // { rec, done } untuk klip yang sedang direkam
let micInfo = '';      // ringkasan pemrosesan mikrofon saat merekam
let sessionStored = Promise.resolve([]); // id rekaman sesi terakhir di penyimpanan aplikasi
let sessionShared = false; // rekaman sesi terakhir sudah dikirim ke menu Simpan
let clips = [];
let recordStart = 0;
let timerId = null;
let drawing = false;
let drawGen = 0;

function canvasMode() {
  return settings.recordMode === 'canvas';
}

// Suara harus AAC (mp4a.40.2): Safari bisa memilih Opus bila tidak disebut,
// dan Opus di dalam MP4 terputar tanpa suara di CapCut.
function pickMimeType() {
  const types = [
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/mp4;codecs="avc1.4d002a,mp4a.40.2"',
    'video/mp4;codecs="avc1.42e01f,mp4a.40.2"',
    'video/mp4;codecs="avc1,mp4a.40.2"',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

function drawFrame(gen) {
  if (!drawing || gen !== drawGen) return;
  const cam = $('cam');
  const vw = cam.videoWidth;
  const vh = cam.videoHeight;
  // Saat kamera sedang diganti, frame terakhir dibiarkan di kanvas.
  if (!switching && vw && vh && cam.readyState >= 2) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.save();
    if (facing === 'user' && settings.mirror) {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cam, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.restore();
  }
  scheduleDraw(gen);
}

// Gambar tepat saat kamera mengirim frame baru agar jarak antar-frame rata.
function scheduleDraw(gen) {
  if (!drawing) return;
  if (gen === undefined) gen = ++drawGen;
  const cam = $('cam');
  if ('requestVideoFrameCallback' in cam) cam.requestVideoFrameCallback(() => drawFrame(gen));
  else requestAnimationFrame(() => drawFrame(gen));
}

// Suara dialirkan lewat Web Audio bila dikeraskan, dan selalu di mode satu file
// (satu perekam sepanjang sesi, jadi mikrofon baru setelah ganti kamera bisa
// disambungkan tanpa memutus rekaman).
// Rantainya: mikrofon → kompresor (meratakan suara pelan/keras) → penguat → limiter.
const BOOST_GAIN = { off: 1, medium: 2, high: 3.2 };
let audioCtx = null;
let audioDest = null;
let audioSrc = null;
let audioIn = null;
let boostGain = null;

function useAudioMixer() {
  return canvasMode() || settings.boost !== 'off';
}

function prepareAudioMixer() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) {
    audioCtx = new AC({ sampleRate: 48000 });
    audioDest = audioCtx.createMediaStreamDestination();

    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;

    boostGain = audioCtx.createGain();

    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -1.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    comp.connect(boostGain).connect(limiter).connect(audioDest);
    audioIn = comp;
  }
  applyBoost();
  // Harus dipanggil langsung dari ketukan agar iPhone mengizinkan audio berjalan.
  audioCtx.resume().catch(() => {});
}

// Pengolah suara dimatikan total bila tidak dipakai, agar tidak mengubah
// pengaturan audio iPhone di latar belakang.
function closeAudioMixer() {
  if (!audioCtx) return;
  if (audioSrc) audioSrc.disconnect();
  audioCtx.close().catch(() => {});
  audioCtx = audioDest = audioSrc = audioIn = boostGain = null;
}

function applyBoost() {
  if (boostGain) boostGain.gain.value = BOOST_GAIN[settings.boost] || 1;
}

function connectMic() {
  if (audioSrc) audioSrc.disconnect();
  audioSrc = null;
  if (!audioCtx || !audioTrack) return;
  audioSrc = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
  audioSrc.connect(audioIn);
}

function recordingAudioTrack() {
  if (!useAudioMixer() || !audioDest) return audioTrack;
  connectMic();
  return audioDest.stream.getAudioTracks()[0];
}

// Pemrosesan yang benar-benar dipakai iPhone, untuk ditampilkan di layar hasil.
function micSummary() {
  const s = audioTrack && audioTrack.getSettings ? audioTrack.getSettings() : null;
  if (!s) return 'tidak diketahui';
  const on = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].filter((k) => s[k] === true);
  const names = { echoCancellation: 'peredam gema', noiseSuppression: 'peredam bising', autoGainControl: 'volume otomatis' };
  const processing = on.length ? on.map((k) => names[k]).join(', ') + ' AKTIF' : 'pemrosesan mati';
  const boost = { off: 'asli', medium: 'keras', high: 'sangat keras' }[settings.boost];
  return `${processing} · volume ${boost}` + (s.sampleRate ? ` · ${s.sampleRate / 1000} kHz` : '');
}

function startRecorder() {
  const tracks = [];
  if (canvasMode()) {
    const short = settings.quality === '1080' ? 1080 : 720;
    canvas.width = short;
    canvas.height = Math.round((short * 16) / 9);
    drawing = true;
    scheduleDraw();
    // Tanpa angka fps: satu gambar di kanvas = satu frame video.
    tracks.push(canvas.captureStream().getVideoTracks()[0]);
  } else {
    tracks.push(videoTrack);
  }
  const audio = recordingAudioTrack();
  if (audio) tracks.push(audio);
  micInfo = micSummary();

  const mimeType = pickMimeType();
  const rec = new MediaRecorder(new MediaStream(tracks), {
    mimeType: mimeType || undefined,
    // Bitrate standar video pendek; lebih tinggi tidak terlihat bedanya setelah
    // diunggah dan membebani encoder iPhone.
    videoBitsPerSecond: settings.quality === '1080' ? 6000000 : 4000000,
    audioBitsPerSecond: 128000,
  });
  const parts = [];
  rec.ondataavailable = (e) => e.data && e.data.size && parts.push(e.data);
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      if (canvasMode()) {
        drawing = false;
        tracks[0].stop();
      }
      resolve(new Blob(parts, { type: rec.mimeType || mimeType || 'video/mp4' }));
    };
  });
  // Data diambil tiap detik. Tanpa ini, rekaman di iPhone bisa membeku setelah
  // belasan detik karena seluruh video ditahan di memori sampai selesai.
  rec.start(1000);
  recorder = { rec, done };
}

async function finishRecorder() {
  const r = recorder;
  if (!r) return;
  recorder = null;
  if (r.rec.state !== 'inactive') r.rec.stop();
  const blob = await r.done;
  if (blob.size) clips.push(blob);
}

function countdown() {
  if (!settings.countdown) return Promise.resolve();
  const el = $('countdown');
  el.classList.remove('hidden');
  return new Promise((resolve) => {
    let n = 3;
    el.textContent = n;
    const id = setInterval(() => {
      n -= 1;
      if (n === 0) {
        clearInterval(id);
        el.classList.add('hidden');
        resolve();
      } else {
        el.textContent = n;
      }
    }, 1000);
  });
}

function updateTimer() {
  const sec = Math.floor((Date.now() - recordStart) / 1000);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  const part = clips.length ? ` · klip ${clips.length + 1}` : '';
  $('rec-timer').textContent = `● ${mm}:${ss}${part}`;
}

let starting = false;

async function startSession() {
  if (!videoTrack || starting) return;
  if (!window.MediaRecorder || (canvasMode() && !canvas.captureStream)) {
    showMessage('Perekaman butuh iOS 14.3 atau lebih baru.');
    return;
  }
  starting = true;
  $('btn-shutter').disabled = true;
  if (useAudioMixer()) prepareAudioMixer();
  else closeAudioMixer();
  setScrolling(false);
  await countdown();
  await ensureAudio();
  // Pastikan kamera masih mengirim gambar sebelum mulai merekam.
  if (cameraStalled()) await restartCamera(facing);
  stallCount = 0;
  starting = false;
  $('btn-shutter').disabled = false;

  clips = [];
  recording = true;
  startRecorder();

  recordStart = Date.now();
  updateTimer();
  timerId = setInterval(updateTimer, 500);
  $('rec-timer').classList.remove('hidden');
  $('btn-shutter').classList.add('recording');
  setScrolling(true);
}

async function stopSession(keep = true) {
  if (!recording) return;
  recording = false;
  clearInterval(timerId);
  $('rec-timer').classList.add('hidden');
  $('btn-shutter').classList.remove('recording');
  setScrolling(false);
  await finishRecorder();
  closeAudioMixer();
  if (!keep || !clips.length) {
    clips = [];
    return;
  }
  openReview();
  // Simpan dulu di aplikasi supaya tidak hilang, lalu langsung buka menu
  // "Simpan Video" selagi ketukan tombol stop masih dianggap baru.
  const s = currentScript();
  sessionStored = storeClips(clips, s && s.title);
  sessionShared = false;
  sessionStored.then((ids) => {
    if (sessionShared) return;
    setSaveStatus(
      ids.length
        ? '✓ Tersimpan otomatis di aplikasi (menu 🎞 Rekaman). Ketuk ⬇︎ Simpan video untuk memasukkan ke galeri Foto.'
        : 'Tidak bisa menyimpan di aplikasi. Ketuk ⬇︎ Simpan video agar rekaman tidak hilang.'
    );
  });
  // Hanya bila ada menu Bagikan; di browser lain tidak mengunduh tanpa diminta.
  if (settings.autoSave && navigator.canShare && navigator.canShare({ files: sessionFiles() })) saveSession();
}

$('btn-shutter').onclick = () => (recording ? stopSession(true) : startSession());

// Jika aplikasi ditinggal (misal ada telepon), rekaman disimpan agar tidak hilang.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && recording) stopSession(true);
  else if (!document.hidden && $('view-recorder').classList.contains('active')) requestWakeLock();
});

// ---------- Hasil rekaman ----------

function videoFileName(blob, index) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const part = clips.length > 1 ? `-klip${index + 1}` : '';
  return `affiliate-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${part}.${ext}`;
}

function playClip(index) {
  const pb = $('playback');
  if (pb.src) URL.revokeObjectURL(pb.src);
  pb.src = URL.createObjectURL(clips[index]);
  $('no-audio').classList.add('hidden');
  const stalls = stallCount ? ` · ⚠︎ kamera terhenti ${stallCount}× lalu disambung ulang` : '';
  $('clip-format').textContent = `Format: ${clips[index].type || 'tidak diketahui'} · Mic: ${micInfo}${stalls}`;
  pb.onloadedmetadata = () => {
    // Safari bisa melaporkan jumlah track suara; browser lain dilewati.
    if (pb.audioTracks && pb.audioTracks.length === 0) $('no-audio').classList.remove('hidden');
  };
  $('clip-tabs').querySelectorAll('button').forEach((b, i) => b.classList.toggle('primary', i === index));
}

function openReview() {
  // Kamera dimatikan selama melihat hasil supaya hemat baterai.
  stopCamera();
  const tabs = $('clip-tabs');
  tabs.innerHTML = '';
  tabs.classList.toggle('hidden', clips.length < 2);
  clips.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = 'Klip ' + (i + 1);
    b.onclick = () => playClip(i);
    tabs.appendChild(b);
  });
  $('btn-save').textContent = clips.length > 1 ? `⬇︎ Simpan ${clips.length} video` : '⬇︎ Simpan video';
  setSaveStatus('Menyimpan…');
  playClip(0);
  show('view-review');
}

$('btn-review-done').onclick = () => {
  const pb = $('playback');
  pb.pause();
  if (pb.src) URL.revokeObjectURL(pb.src);
  pb.removeAttribute('src');
  renderLibrary();
};

$('btn-retake').onclick = () => {
  $('playback').pause();
  openRecorder();
};

// Mengembalikan 'shared', 'cancelled', 'blocked' (iPhone menolak karena bukan dari
// ketukan langsung) atau 'downloaded' (browser tanpa menu Bagikan).
async function shareVideos(files) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      if (e.name === 'NotAllowedError') return 'blocked';
    }
  }
  files.forEach((file) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });
  return 'downloaded';
}

function sessionFiles() {
  return clips.map((blob, i) => new File([blob], videoFileName(blob, i), { type: blob.type }));
}

function setSaveStatus(text) {
  $('save-status').textContent = text;
}

async function saveSession() {
  const result = await shareVideos(sessionFiles());
  if (result === 'shared' || result === 'downloaded') {
    sessionShared = true;
    setSaveStatus('✓ Terkirim ke menu Simpan. Rekaman juga tetap ada di menu 🎞 Rekaman.');
    const ids = await sessionStored;
    markExported(ids).catch(() => {});
  } else if (result === 'blocked') {
    setSaveStatus('Ketuk ⬇︎ Simpan video untuk memasukkan ke galeri Foto.');
  }
}

$('btn-save').onclick = saveSession;

// ---------- Mulai ----------

applySettings();
renderLibrary();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
