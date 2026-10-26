'use strict';

// Generator naskah & hook. Tanpa API key memakai template; dengan API key
// Anthropic memakai Claude. Hasil yang dipilih langsung dikirim ke prompter.

const STORE_GEN = 'prompter.generator';
const STORE_APIKEY = 'prompter.apiKey';

// Versi SDK dipatok agar perilakunya tidak berubah tiba-tiba.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
// Haiku: cepat dan murah, cukup untuk naskah pendek.
const MODEL = 'claude-haiku-5-5';

let genResult = null;
let selectedHook = 0;

// ---------- Utilitas ----------

function formatPrice(raw) {
  const t = raw.trim();
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  // "89000", "89.000", "Rp 89.000" → "Rp89.000"; "89rb" dibiarkan apa adanya.
  if (digits && /^(rp\.?\s*)?[\d.,\s]+$/i.test(t)) return 'Rp' + Number(digits).toLocaleString('id-ID');
  return t;
}

// Teks yang disalin dari halaman produk sering diawali bullet/emoji dan diakhiri titik.
function cleanBenefit(raw) {
  let t = raw
    .trim()
    .replace(/^[\s•\-–—*✓✔✅☑▪►>\uFE0F]+/u, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/[\s.!;,]+$/, '')
    .trim();
  // Huruf pertama dikecilkan agar enak disambung ke kalimat, kecuali singkatan (BPOM, SPF).
  if (t.length > 1 && t[1] !== t[1].toUpperCase()) t = t[0].toLowerCase() + t.slice(1);
  return t;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readInput() {
  return {
    product: $('gen-product').value.trim(),
    price: formatPrice($('gen-price').value),
    benefits: ['gen-b1', 'gen-b2', 'gen-b3'].map((id) => cleanBenefit($(id).value)).filter(Boolean),
  };
}

// ---------- Mesin template ----------

function generateWithTemplate({ product: p, price, benefits }) {
  const [b1, b2 = b1, b3 = b2] = benefits;
  const hookPool = [
    `Jangan beli ${p} sebelum lihat video ini!`,
    `Aku nyesel baru tahu ${p} sekarang.`,
    `Racun banget! ${p} ini ${b1}.`,
    `Kalau kamu cari yang ${b1}, wajib lihat ini.`,
    `3 alasan aku nggak bisa lepas dari ${p}.`,
    `Ini alasan ${p} lagi banyak dicari.`,
    `Stop scroll dulu, ini ${p} yang lagi aku pakai.`,
    `Coba tebak, ${p} ini harganya berapa?`,
    `Jujur, awalnya aku ragu sama ${p}.`,
  ];
  if (price) {
    hookPool.push(`Cuma ${price}, tapi ${b1}!`, `Harga ${price}, tapi kualitasnya bikin kaget.`);
  }

  const demo = pick([
    `Lihat nih, ${b1}. Terus ${b2}.`,
    `Coba lihat sendiri, ${b1}. Ditambah lagi ${b2}.`,
    `Pas dipakai langsung kerasa, ${b1}. Dan ${b2}.`,
  ]);
  const closeup = pick([
    `Detailnya juga rapi, dan yang paling aku suka, ${b3}.`,
    `Lihat dari dekat deh, ${b3}.`,
    `Yang bikin aku makin yakin, ${b3}.`,
  ]);
  const cta = price
    ? pick([
        `Harganya cuma ${price}. Langsung klik *keranjang kuning* di bawah, mumpung masih promo!`,
        `Cuma ${price} aja. Klik *keranjang kuning* sekarang sebelum kehabisan!`,
      ])
    : pick([
        `Cek harganya di *keranjang kuning* di bawah, lagi ada promo!`,
        `Langsung klik *keranjang kuning* di bawah sebelum promonya habis!`,
      ]);

  return {
    hooks: shuffle(hookPool).slice(0, 5),
    hook_shot: 'Wajah ke kamera, pegang produk, ekspresi antusias',
    demo: { text: demo, shot: 'Produk dipakai/dicoba, kamera belakang' },
    closeup: { text: closeup, shot: 'Kamera dekat ke detail, tekstur, atau label' },
    cta: { text: cta, shot: 'Kembali ke wajah, tunjuk ke bawah layar' },
  };
}

// ---------- Mesin AI (Claude) ----------

const SECTION = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Kalimat yang diucapkan' },
    shot: { type: 'string', description: 'Instruksi shot singkat, maksimal 8 kata' },
  },
  required: ['text', 'shot'],
  additionalProperties: false,
};

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    hooks: { type: 'array', items: { type: 'string' }, description: 'Tepat 5 hook berbeda' },
    hook_shot: { type: 'string', description: 'Instruksi shot untuk hook, maksimal 8 kata' },
    demo: SECTION,
    closeup: SECTION,
    cta: SECTION,
  },
  required: ['hooks', 'hook_shot', 'demo', 'closeup', 'cta'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Kamu copywriter video affiliate pendek (TikTok/Shopee Video) untuk kreator Indonesia. Naskahnya dibacakan kreator lewat teleprompter sambil merekam dengan iPhone.

Tulis dalam bahasa Indonesia santai sehari-hari, seperti orang ngobrol ke teman, bukan bahasa iklan kaku. Kalimat pendek dan mudah diucapkan dalam sekali napas.

Buat:
- 5 hook yang benar-benar berbeda pendekatannya (misalnya rasa penasaran, masalah pembeli, harga, testimoni pribadi, larangan/peringatan). Tiap hook maksimal 12 kata dan bisa diucapkan dalam 3 detik.
- Isi naskah untuk bagian demo, close-up, dan CTA. Bersama satu hook, total naskah harus 15–20 detik saat diucapkan (sekitar 35–45 kata). Isi naskah harus nyambung dengan hook mana pun.
- CTA mengajak klik keranjang kuning. Sebut harga bila diberikan.
- Instruksi shot untuk tiap bagian: apa yang direkam dan dari kamera mana, maksimal 8 kata.

Gunakan hanya keunggulan yang diberikan; jangan mengarang klaim, angka, atau sertifikasi baru. Kata yang perlu ditekankan boleh diapit tanda bintang, misalnya *keranjang kuning*.`;

let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import(SDK_URL)
      .then((m) => m.default)
      .catch((e) => {
        sdkPromise = null;
        throw e;
      });
  }
  return sdkPromise;
}

async function generateWithAI(input, apiKey) {
  const Anthropic = await loadSdk();
  // API key milik pengguna sendiri dan hanya tersimpan di HP-nya, jadi
  // memanggil API langsung dari browser bisa diterima untuk aplikasi pribadi ini.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const lines = [`Nama produk: ${input.product}`];
  if (input.price) lines.push(`Harga: ${input.price}`);
  input.benefits.forEach((b, i) => lines.push(`Keunggulan ${i + 1}: ${b}`));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: SCRIPT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: lines.join('\n') }],
  });

  if (response.stop_reason === 'refusal') throw new Error('refusal');
  if (response.stop_reason === 'max_tokens') throw new Error('Jawaban AI terpotong.');
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const data = JSON.parse(text);
  if (!Array.isArray(data.hooks) || data.hooks.length === 0) throw new Error('Format jawaban AI tidak sesuai.');
  data.hooks = data.hooks.slice(0, 5);
  return data;
}

async function describeAIError(e) {
  let Anthropic = null;
  try {
    Anthropic = await loadSdk();
  } catch (ignored) {
    return 'Tidak bisa memuat modul AI. Periksa koneksi internet.';
  }
  if (e.message === 'refusal') return 'AI menolak membuat naskah untuk produk ini.';
  if (e instanceof Anthropic.AuthenticationError) return 'API key tidak valid. Periksa lagi di Pengaturan AI.';
  if (e instanceof Anthropic.RateLimitError) return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (e instanceof Anthropic.APIConnectionError) return 'Tidak tersambung ke internet.';
  if (e instanceof Anthropic.APIError) {
    if (e.type === 'billing_error') return 'Saldo akun Anthropic habis atau belum diisi.';
    return 'Layanan AI sedang bermasalah (' + (e.status || 'error') + ').';
  }
  return e.message || 'Terjadi kesalahan.';
}

// ---------- Tampilan ----------

// Naskah untuk prompter hanya berisi kalimat yang diucapkan; daftar shot
// cukup ditampilkan di layar generator.
function buildBody(result, hookIndex) {
  return [result.hooks[hookIndex], result.demo.text, result.closeup.text, result.cta.text].join('\n\n');
}

// Teks VO: hanya kalimat yang diucapkan, tanpa penanda shot dan tanda bintang.
function voText(result, hookIndex) {
  return [result.hooks[hookIndex], result.demo.text, result.closeup.text, result.cta.text]
    .map((t) => t.replace(/\[[^\]]*\]/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Cadangan untuk browser yang menolak Clipboard API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

async function copyVO() {
  if (!genResult) return;
  const btn = $('btn-gen-copy');
  const ok = await copyText(voText(genResult, selectedHook));
  btn.textContent = ok ? '✓ Tersalin' : 'Gagal menyalin';
  setTimeout(() => (btn.textContent = '📋 Salin teks VO'), 2000);
}

function renderResult() {
  const hooks = $('gen-hooks');
  hooks.innerHTML = '';
  genResult.hooks.forEach((h, i) => {
    const b = document.createElement('button');
    b.className = 'hook' + (i === selectedHook ? ' selected' : '');
    b.textContent = h;
    b.onclick = () => {
      selectedHook = i;
      renderResult();
    };
    hooks.appendChild(b);
  });

  const body = buildBody(genResult, selectedHook);
  $('gen-script').innerHTML = renderScript(body);
  const s = stats(body);
  $('gen-stats').textContent = `${s.words} kata · ±${s.seconds} detik`;

  const shots = [
    ['Hook', genResult.hook_shot],
    ['Demo', genResult.demo.shot],
    ['Close-up', genResult.closeup.shot],
    ['CTA', genResult.cta.shot],
  ];
  $('gen-shots').innerHTML = shots.map(([label, shot]) => `<li><b>${label}:</b> ${escapeHtml(shot)}</li>`).join('');
  $('gen-result').classList.remove('hidden');
}

function setStatus(text) {
  const el = $('gen-status');
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

function apiKey() {
  return $('gen-apikey').value.trim();
}

function updateEngineBadge() {
  const ai = Boolean(apiKey());
  $('gen-engine').textContent = ai ? 'AI · Claude' : 'Template';
  $('gen-engine').classList.toggle('ai', ai);
}

function saveGenerator() {
  save(STORE_GEN, {
    product: $('gen-product').value,
    price: $('gen-price').value,
    b: ['gen-b1', 'gen-b2', 'gen-b3'].map((id) => $(id).value),
  });
}

function openGenerator() {
  const saved = load(STORE_GEN, null);
  if (saved) {
    $('gen-product').value = saved.product || '';
    $('gen-price').value = saved.price || '';
    ['gen-b1', 'gen-b2', 'gen-b3'].forEach((id, i) => ($(id).value = (saved.b && saved.b[i]) || ''));
  }
  $('gen-apikey').value = load(STORE_APIKEY, '');
  updateEngineBadge();
  setStatus('');
  show('view-generator');
}

async function runGenerator() {
  const input = readInput();
  if (!input.product || input.benefits.length === 0) {
    setStatus('Isi nama produk dan minimal 1 keunggulan.');
    return;
  }
  saveGenerator();
  const run = $('btn-gen-run');
  const again = $('btn-gen-again');
  run.disabled = again.disabled = true;

  const key = apiKey();
  if (key) {
    setStatus('Claude sedang menulis naskah… (±10–30 detik)');
    try {
      genResult = await generateWithAI(input, key);
      setStatus('');
    } catch (e) {
      genResult = generateWithTemplate(input);
      setStatus((await describeAIError(e)) + ' Sementara dibuatkan dari template.');
    }
  } else {
    genResult = generateWithTemplate(input);
    setStatus('');
  }

  selectedHook = 0;
  renderResult();
  run.disabled = again.disabled = false;
  $('gen-hooks').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sendToPrompter() {
  if (!genResult) return;
  const s = {
    id: String(Date.now()),
    title: $('gen-product').value.trim() || 'Naskah baru',
    body: buildBody(genResult, selectedHook),
    updated: Date.now(),
  };
  scripts.push(s);
  save(STORE_SCRIPTS, scripts);
  currentId = s.id;
  openRecorder();
}

$('btn-generate').onclick = openGenerator;
$('btn-gen-back').onclick = () => {
  saveGenerator();
  renderLibrary();
};
$('btn-gen-run').onclick = runGenerator;
$('btn-gen-again').onclick = runGenerator;
$('btn-gen-send').onclick = sendToPrompter;
$('btn-gen-copy').onclick = copyVO;
$('gen-apikey').oninput = () => {
  save(STORE_APIKEY, apiKey());
  updateEngineBadge();
};
