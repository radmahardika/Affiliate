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
  mirror: false,
  quality: '1080',
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

function renderScript(text) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => {
      const html = escapeHtml(para.trim())
        .replace(/\[([^\]\n]+)\]/g, '<span class="cue">[$1]</span>')
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
        <button class="btn small primary">🎥 Rekam</button>`;
      li.querySelector('.info').onclick = () => openEditor(s.id);
      li.querySelector('button').onclick = () => {
        currentId = s.id;
        openRecorder();
      };
      list.appendChild(li);
    });
  show('view-library');
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
$('btn-delete').onclick = () => {
  if (!confirm('Hapus naskah ini?')) return;
  scripts = scripts.filter((s) => s.id !== currentId);
  save(STORE_SCRIPTS, scripts);
  renderLibrary();
};
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
bindSetting('set-mirror', 'mirror', 'checked', Boolean);
bindSetting('set-quality', 'quality', 'value', String);

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
let switching = false;
let wakeLock = null;

function videoConstraints() {
  const long = settings.quality === '1080' ? 1920 : 1280;
  const short = settings.quality === '1080' ? 1080 : 720;
  return { facingMode: facing, width: { ideal: long }, height: { ideal: short }, frameRate: { ideal: 30 } };
}

function showMessage(text) {
  const el = $('rec-msg');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

async function startCamera(withAudio) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints(),
    audio: withAudio ? { echoCancellation: true, noiseSuppression: true } : false,
  });
  if (withAudio) audioTrack = stream.getAudioTracks()[0] || null;
  videoTrack = stream.getVideoTracks()[0];
  const cam = $('cam');
  cam.srcObject = new MediaStream([videoTrack]);
  await cam.play().catch(() => {});
  cam.classList.toggle('mirror', facing === 'user');
}

function stopCamera() {
  [videoTrack, audioTrack].forEach((t) => t && t.stop());
  videoTrack = audioTrack = null;
  $('cam').srcObject = null;
}

async function flipCamera() {
  if (switching) return;
  switching = true;
  $('btn-flip').disabled = true;
  const previous = facing;
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    // iPhone hanya bisa membuka satu kamera sekaligus, jadi kamera lama dimatikan dulu.
    // Selama jeda singkat ini kanvas rekaman menahan frame terakhir.
    if (videoTrack) videoTrack.stop();
    await startCamera(false);
  } catch (e) {
    facing = previous;
    try {
      await startCamera(false);
    } catch (e2) {
      showMessage('Kamera tidak bisa dibuka: ' + e2.message);
    }
  } finally {
    switching = false;
    $('btn-flip').disabled = false;
  }
}

$('btn-flip').onclick = flipCamera;

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

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage('Browser ini tidak mendukung kamera. Buka lewat Safari dengan alamat https://');
    return;
  }
  try {
    await startCamera(true);
    requestWakeLock();
  } catch (e) {
    showMessage('Izin kamera/mikrofon ditolak. Buka Pengaturan iPhone → Safari → Kamera & Mikrofon → Izinkan, lalu coba lagi.');
  }
}

function closeRecorder() {
  if (recorder) stopRecording(false);
  setScrolling(false);
  stopCamera();
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
  renderLibrary();
}

$('btn-rec-close').onclick = closeRecorder;

// ---------- Perekaman ----------
// Video direkam dari kanvas, bukan langsung dari kamera. Dengan begitu kamera bisa
// diganti di tengah rekaman tanpa memutus file, dan hasilnya selalu 9:16.

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let recorder = null;
let chunks = [];
let recordStart = 0;
let timerId = null;
let drawing = false;
let keepRecording = true;
let lastBlob = null;

function pickMimeType() {
  const types = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

function drawFrame() {
  if (!drawing) return;
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
  requestAnimationFrame(drawFrame);
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
  $('rec-timer').textContent = `● ${mm}:${ss}`;
}

let starting = false;

async function startRecording() {
  if (!videoTrack || starting) return;
  if (!window.MediaRecorder || !canvas.captureStream) {
    showMessage('Perekaman butuh iOS 14.3 atau lebih baru.');
    return;
  }
  starting = true;
  $('btn-shutter').disabled = true;
  setScrolling(false);
  await countdown();
  starting = false;
  $('btn-shutter').disabled = false;

  const short = settings.quality === '1080' ? 1080 : 720;
  canvas.width = short;
  canvas.height = Math.round((short * 16) / 9);
  drawing = true;
  drawFrame();

  const tracks = canvas.captureStream(30).getVideoTracks();
  if (audioTrack) tracks.push(audioTrack);
  const mimeType = pickMimeType();
  chunks = [];
  keepRecording = true;
  recorder = new MediaRecorder(new MediaStream(tracks), {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: short === 1080 ? 8000000 : 5000000,
  });
  recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    drawing = false;
    tracks[0].stop();
    if (!keepRecording) return;
    lastBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/mp4' });
    recorder = null;
    openReview();
  };
  recorder.start(1000);

  recordStart = Date.now();
  updateTimer();
  timerId = setInterval(updateTimer, 500);
  $('rec-timer').classList.remove('hidden');
  $('btn-shutter').classList.add('recording');
  setScrolling(true);
}

function stopRecording(keep = true) {
  if (!recorder) return;
  keepRecording = keep;
  clearInterval(timerId);
  $('rec-timer').classList.add('hidden');
  $('btn-shutter').classList.remove('recording');
  setScrolling(false);
  if (recorder.state !== 'inactive') recorder.stop();
  if (!keep) recorder = null;
}

$('btn-shutter').onclick = () => (recorder ? stopRecording(true) : startRecording());

// Jika aplikasi ditinggal (misal ada telepon), rekaman disimpan agar tidak hilang.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && recorder) stopRecording(true);
  else if (!document.hidden && $('view-recorder').classList.contains('active')) requestWakeLock();
});

// ---------- Hasil rekaman ----------

function videoFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ext = lastBlob.type.includes('mp4') ? 'mp4' : 'webm';
  return `affiliate-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

function openReview() {
  // Kamera dimatikan selama melihat hasil supaya hemat baterai.
  stopCamera();
  const pb = $('playback');
  if (pb.src) URL.revokeObjectURL(pb.src);
  pb.src = URL.createObjectURL(lastBlob);
  show('view-review');
}

$('btn-retake').onclick = () => {
  $('playback').pause();
  openRecorder();
};

$('btn-save').onclick = async () => {
  const name = videoFileName();
  const file = new File([lastBlob], name, { type: lastBlob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastBlob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
};

// ---------- Mulai ----------

applySettings();
renderLibrary();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
