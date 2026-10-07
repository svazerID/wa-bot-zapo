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
Fix: fallback ke `global.owner[0]` dari config.js.

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
- `main.js`: driver `node`, mint kode sekali + guard `hasPairingCode`, fallback nomor ke
  `global.owner[0]`, handler `auth_passkey_required`, log `auth_pairing_code`.
- `package.json`: `zapo-js` `^1.9.0`, `@zapo-js/store-sqlite` `^1.3.0`, hapus `better-sqlite3`.

## Catatan operasional
- Pairing code berlaku ~180s - masukkan cepat.
- Kalau server minta passkey (Shortcake), log tampil "Server minta passkey"
  `hasSigner=false`; jalur pairing-code tak bisa selesai headless tanpa
  `signPasskeyAssertion`. Belum terjadi di sesi ini.
- Jangan `rm -rf .auth` setelah paired - sesi hilang, harus pairing ulang.
