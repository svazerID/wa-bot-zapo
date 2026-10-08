// Cek pushName benar-benar sampai ke plugin, pakai event bentuk zapo-js yang nyata.
// Jalankan: node test-pushname.js
const assert = require('assert')
const { smsg } = require('./lib/simple')

global.lidCache = {}
const client = { message: { send: () => {} } }

// 1. Pesan grup dengan pushName → m.pushname terisi
let m = smsg(client, {
  key: { remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false, participant: '628111@s.whatsapp.net' },
  pushName: 'Alfi / tag only',
  message: { conversation: '!s' }
})
assert.equal(m.pushname, 'Alfi / tag only', 'pushName dari event masuk ke m.pushname')

// 2. pushName tidak ada → string kosong, bukan undefined (biar template aman)
m = smsg(client, {
  key: { remoteJid: '628111@s.whatsapp.net', isGroup: false, fromMe: true },
  message: { conversation: '!s' }
})
assert.equal(m.pushname, '', 'tanpa pushName → string kosong')

// 3. Nilai default publisher yang dipakai plugin
const tanggal = '07/10/2026'
const pub = m.pushname ? `${m.pushname}\n${tanggal}` : tanggal
assert.equal(pub, tanggal, 'pushname kosong → publisher hanya tanggal')

m = smsg(client, {
  key: { remoteJid: '628111@s.whatsapp.net', isGroup: false, fromMe: false },
  pushName: 'Alfi',
  message: { conversation: '!s' }
})
const pub2 = m.pushname ? `${m.pushname}\n${tanggal}` : tanggal
assert.equal(pub2, `Alfi\n${tanggal}`, 'pushname ada → dua baris')

console.log('✅ pushname lulus')
console.log('   contoh publisher:', JSON.stringify(pub2))
