# FIX LOG - zapo-js pairing tidak bisa (2026-10-07)

## Gejala
`node main.js` menampilkan "Masukkan nomor WhatsApp" terus, atau kode pairing muncul
tapi pairing tidak pernah selesai. PM2 app `wa-bot-zapo` hilang, `node_modules` kosong.

## Root cause (3 lapis)

### 1. node_modules hilang + better-sqlite3 gagal compile
`npm install` gagal exit 134 (SIGABRT) di better-sqlite3 (node-gyp rebuild).
node_modules tak pernah selesai -> `Cannot find module 'chalk'` -> bot tidak boot.

Fix: drop better-sqlite3; pakai driver bawaan node:sqlite (Node 22.13+, tanpa native build):
`createSqliteStore({ path: '.auth/state.sqlite', driver: 'node' })`

### 2. Kode pairing di-mint ulang tiap reconnect (loop)
Handler `connection: close` set `pairingRequested = false`. `auth_qr` fire ulang
(QR rotate ~20-60s) -> `requestPairingCode()` dipanggil lagi -> kode BARU, sementara
user sedang mengetik kode lama -> zapo `handlePrimaryHello` menolak
("primary_hello ref mismatch ignored") -> putus -> mint lagi -> loop selamanya.

Fix: mint sekali. Patokan state zapo sendiri (`getState().hasPairingCode`) + TTL 170s
(< `PAIRING_CODE_MAX_AGE_SECONDS` 180). Hapus `pairingRequested = false` di handler close.

### 3. Nomor pairing tidak ada sumbernya
`PHONE_NUMBER` hanya dari env; kosong -> block stdin (headless/PM2 tak bisa input).

Fix (SEMULA): fallback ke `global.owner[0]` dari config.js.

**KOREKSI (commit f8c20ec):** fallback itu SALAH. `global.owner` = nomor
user yang boleh kontrol bot, BUKAN nomor bot yang di-pairing. Kalau bot
dipairing ke nomor owner milik orang lain, sesi bot tersambung ke akun
WhatsApp orang itu — owner bisa kirim pesan sebagai bot dari akun tersebut.
Jadi fallback DIHAPUS. Sumber nomor bot yang benar, berurutan:
1. env `PHONE_NUMBER` (isi manual: `PHONE_NUMBER=628xxx npm start`)
2. prompt interaktif `askPhone()` — hanya jalan kalau ada TTY; di PM2/headless
   tidak ada stdin sehingga bot diam saja (ini SADAR, bukan bug)

`PHONE_NUMBER` yang ada tapi ga valid (<10 digit) -> stop dengan pesan jelas,
bukan diam-diam jatuh ke prompt. Nomor bisa ditulis format bebas
(`+62 812-3456-7890`) lalu dinormalisasi ke `6281234567890`.

## Bukti verifikasi
- Probe standalone: kode terbit 1.1s, `connect() RESOLVED`, tanpa error
  -> library & transport OK, bug memang di orkestrasi bot.
- `node main.js` fresh `.auth`: kode `QEXQ-MRF4` terbit SEKALI, lalu
  `Pairing berhasil -> 62895401438129:84@s.whatsapp.net`.
- Session persisten: `me_jid` terisi di `auth_credentials` (sebelumnya `None`).
- Restart tanpa `rm -rf .auth`: `Terhubung ke WhatsApp!` + pesan grup nyata masuk
  -> tidak pairing ulang.
- PM2 `wa-bot-zapo:13` online; error log run baru hanya warning phash metadata
  (`ackError: undefined` = pesan tetap terkirim), bukan crash.

## Perubahan file
- `main.js`: driver `node`, mint kode sekali + guard `hasPairingCode`, handler
  `auth_passkey_required`, log `auth_pairing_code`.
- `main.js` (f8c20ec): hapus fallback `global.owner`; `normalizePhone()`; validasi
  env `PHONE_NUMBER`.
- `package.json`: `zapo-js` `^1.9.0`, `@zapo-js/store-sqlite` `^1.3.0`, hapus `better-sqlite3`.

---

# FIX LOG - preview video blank abu-abu (commit cd25e36)

## Gejala
Thumbnail/preview video di WhatsApp abu-abu. Fix sebelumnya (commit
`10ad874`) Wiring `mediaProcessor` seemed to fix gambar saja — video tetap
abu-abu.

## Root cause (2 lapis, bukan 1)

### 1. `ffmpeg(buffer)` — thumbnail video SELALU null
`fluent-ffmpeg` hanya terima **path file** atau stream. Kalau diberi Buffer dia
lempah `Error: No input specified` secara **sync** di dalam `.then()`, jadi
langsung ketangkap `.catch()` -> `resolve(null)`. Tidak ada error di log.
Dampaknya: `jpegThumbnail` nggak pernah ada, WhatsApp render abu-abu.

Bukti: sebelum fix, `dark-first.mp4` dan `normal.mp4` dua-duanya `NULL`.

Fix: tulis buffer ke temp file (`fs.mkdtempSync`), ffmpeg baca dari path,
temp dihapus di `finally`. `probeMedia` suffers bug yang sama (`ffprobe` juga
perlu path) — ikut dibenerin.

### 2. Ambil frame 0 -> thumbnail hitam
`-frames:v 1` tanpa seek ambil frame pertama. Video yang buka dengan
fade-in/hitam dapat thumbnail gelap. Bukti: video 1s hitam + 3s testsrc ->
frame 0 brightness 0, frame 1s brightness 127.

Fix: `-ss 1`. Kalau video < 1s, retry dari frame 0 (3gp pendek, dll).

## Tambahan (penting)
- Validasi magic bytes JPEG `ffd8ff` + min 100 byte, jangan masukin output
  setengah jadi.
- **Limiter 2 ffmpeg konkuren.** Di container dengan `cpu.max=2` (verified via
  `/sys/fs/cgroup/cpu.max` = `200000 100000`), 4 proses ffmpeg paralel bikin
  stalling — proses spin tanpa keluar, `pipe()` nggak pernah emit `end`.
  Terverifikasi juga CLI murni tanpa involvement kode, jadi murni limit
  container, bukan bug. `MAX_FFMPEG_CONCURRENT = 2` + antrian.

## Bukti verifikasi (semua via fungsi, bukan e2e WhatsApp)
| Input | Thumbnail | probeMedia |
|---|---|---|
| frame gelap (0s hitam) | 1593b, bright 127 | 640x360, 4s |
| normal mp4 | 1618b, bright 127 | 640x360, 3s |
| pendek 0.4s | 1594b (retry frame 0) | ok |
| portrait | 1752b | 360x640 |
| rotasi 90deg | 1611b | 360x640 |
| .3gp | 2151b | ok |
| .webm | 1620b | ok |
| audio-only | NULL (benar) | 2s |
| file korup | NULL (benar) | {} |
| 8x paralel | semua ok | semua ok |
| 3x video 3.1MB | semua ok, RSS 34MB | — |

Sisa temp file: 0 di semua skenario.

## Catatan operasional
- `width`/`height` di return thumbnail video masih `0` (probe yang supplying
  dimensi ke zapo). Kalau preview masih abu-abu setelah fix ini, kemungkinan
  masalahnya aspect ratio dari `width`/`height`, bukan thumbnail — kasus
  berbeda, perlu test end-to-end di WhatsApp dulu.
- Fix ini belum diuji end-to-end dari sisi client WhatsApp (hanya unit-level
  via fungsi + ukur brightness). Verifikasi terakhir: kirim video dari
  WhatsApp, cek preview.

## Catatan operasional (pairing, dari entri di atas)
- Pairing code berlaku ~180s - masukkan cepat.
- Kalau server minta passkey (Shortcake), log tampil "Server minta passkey"
  `hasSigner=false`; jalur pairing-code tak bisa selesai headless tanpa
  `signPasskeyAssertion`. Belum terjadi di sesi ini.
- Jangan `rm -rf .auth` setelah paired - sesi hilang, harus pairing ulang.
