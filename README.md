# Racik Naskah VO

Web app untuk merumuskan naskah voice over affiliate (±20 detik, maksimal 25 detik).

Input: **Masalah** (hook), **Solusi**, **Nama produk**, **Ajakan/CTA**.
Output: 5 versi naskah (Pertanyaan Relate, Stop Scroll, Curhat/POV, Fakta Mengejutkan, Promo Langsung)
lengkap dengan timestamp per bagian, estimasi durasi, dan arahan baca.

Cara pakai: buka `index.html` di browser. Tidak perlu server atau API key.

- Durasi diestimasi dari jumlah suku kata (Santai 5,2 / Normal 5,8 / Cepat 6,5 suku kata per detik) plus jeda tanda baca.
- Bagian opsional (agitasi, benefit, urgensi) otomatis ditambah selama durasi masih muat di target, tidak pernah melewati 25 detik.
- "Acak ulang" mengganti variasi kalimat.

`app.html` adalah versi yang sama tanpa kerangka `<html>`, dipakai untuk publish sebagai Artifact.
