// Cek m.quoted terisi dari contextInfo di tipe pesan APA PUN, bukan cuma
// extendedTextMessage. Jalankan: node test-quoted.js
const assert = require('assert')
const { smsg } = require('./lib/simple')

global.lidCache = {}
const client = { message: { send: () => {} } }
const Q = { imageMessage: { mimetype: 'image/jpeg', caption: 'gambar asli' } }  // pesan yang di-reply

function mk(inner) {
  return { key: { remoteJid: '628111@s.whatsapp.net', fromMe: false }, message: inner }
}

// 1. teks biasa membalas sesuatu (kasus lama, harus tetap jalan)
let m = smsg(client, mk({ extendedTextMessage: { text: '.meme halo | dunia', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net' } } }))
assert.ok(m.quoted, 'extendedText: m.quoted terisi')
assert.ok(m.quoted.message.imageMessage, 'extendedText: quotedMessage = gambar')
assert.equal(m.quoted.sender, '628222@s.whatsapp.net')
assert.deepEqual(m.mentionedJid, [])
console.log('  extendedText → quoted ok')

// 2. GAMBAR dengan caption membalas sesuatu (kasus yang bug)
m = smsg(client, mk({ imageMessage: { caption: '.meme halo | dunia', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net', mentionedJid: ['628333@s.whatsapp.net'] } } }))
assert.ok(m.quoted, 'imageMessage: m.quoted terisi')
assert.ok(m.quoted.message.imageMessage, 'imageMessage: quotedMessage benar')
assert.equal(m.quoted.sender, '628222@s.whatsapp.net')
assert.deepEqual(m.mentionedJid, ['628333@s.whatsapp.net'], 'mentionedJid dari imageMessage')
assert.equal(m.text, '.meme halo | dunia', 'caption tetap terbaca')
console.log('  image        → quoted ok (ini yang tadinya gagal)')

// 3. video dengan caption
m = smsg(client, mk({ videoMessage: { caption: '.sticker', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net' } } }))
assert.ok(m.quoted, 'videoMessage: m.quoted terisi')
console.log('  video        → quoted ok')

// 4. sticker membalas sesuatu
m = smsg(client, mk({ stickerMessage: { mimetype: 'image/webp', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net' } } }))
assert.ok(m.quoted, 'stickerMessage: m.quoted terisi')
console.log('  sticker      → quoted ok')

// 5. document / audio
for (let [name, inner] of [
  ['document', { documentMessage: { fileName: 'a.pdf', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net' } } }],
  ['audio', { audioMessage: { mimetype: 'audio/ogg', contextInfo: { quotedMessage: Q, participant: '628222@s.whatsapp.net' } } }]
]) {
  m = smsg(client, mk(inner))
  assert.ok(m.quoted, `${name}: m.quoted terisi`)
  console.log(`  ${name.padEnd(12)} → quoted ok`)
}

// 6. TIDAK membalas apa pun → quoted null, tidak crash
m = smsg(client, mk({ extendedTextMessage: { text: '.meme a | b' } }))
assert.equal(m.quoted, null, 'tanpa reply → quoted null')
console.log('  tanpa reply  → quoted null')

// 7. field internal proto (_stats) tidak boleh dibaca sebagai contextInfo
m = smsg(client, mk({ extendedTextMessage: { text: 'hai', _stats: { contextInfo: { quotedMessage: Q } } } }))
assert.equal(m.quoted, null, 'field _ tidak dianggap contextInfo')
console.log('  field _stats → diabaikan')

// 8. pesan kosong → tidak crash
m = smsg(client, mk({}))
assert.equal(m.quoted, null)
assert.deepEqual(m.mentionedJid, [])
console.log('  pesan kosong → tidak crash')

console.log('✅ quoted lulus')
