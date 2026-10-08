// Cek jalur lengkap: reply gambar → smsg → plugin meme/iqc.
// Fokus: m.quoted terisi DAN downloadMedia menerima bentuk yang benar.
// Jalankan: node test-reply.js
const assert = require('assert')
const { smsg } = require('./lib/simple')

global.lidCache = {}
const client = { message: { send: () => {} } }
const imgMsg = { imageMessage: { mimetype: 'image/jpeg', caption: 'asli' } }

// event nyata: user membalas gambar dengan teks ".meme halo | dunia"
const event = {
  key: { remoteJid: '628111@s.whatsapp.net', fromMe: false },
  pushName: 'Tester',
  message: {
    extendedTextMessage: {
      text: '.meme halo | dunia',
      contextInfo: { quotedMessage: imgMsg, participant: '628222@s.whatsapp.net' }
    }
  }
}

const m = smsg(client, event)

// 1. yang diperiksa plugin: m.quoted truthy & punya imageMessage
assert.ok(m.quoted, 'm.quoted terisi')
assert.equal(m.quoted.message.imageMessage.mimetype, 'image/jpeg', 'quotedMessage = gambar')

// 2. bentuk yang harus dikirim ke downloadMedia: OBJEK MESSAGE, bukan wrapper
//    (bug lama: plugin mengirim m.quoted → {message, sender}, bukan pesannya)
const msgUntukDownload = m.quoted.message
assert.ok(msgUntukDownload.imageMessage, 'bentuk yang benar punya imageMessage')

// 3. deteksi gambar oleh plugin (msg = m.quoted)
assert.ok(!!m.quoted.message.imageMessage, 'plugin mendeteksi ini gambar')

// 4. memastikan wrapper salah TIDAK punya imageMessage di root (itu bug lama)
assert.equal(m.quoted.imageMessage, undefined, 'wrapper tidak punya imageMessage di root — ini bug lama')

// 5. teks terparsing seperti plugin meme lakukan
const [atas, bawah] = m.text.split('|')
assert.equal(atas.trim(), '.meme halo'.trim(), 'teks atas terbaca')
assert.equal(bawah.trim(), 'dunia', 'teks bawah terbaca')

// 6. kasus kirim gambar langsung dengan caption (bukan reply)
const m2 = smsg(client, {
  key: { remoteJid: '628111@s.whatsapp.net', fromMe: false }, pushName: 'T',
  message: { imageMessage: { mimetype: 'image/jpeg', caption: '.meme a | b' } }
})
assert.equal(m2.quoted, null, 'tanpa reply → quoted null')
assert.ok(m2.message.imageMessage, 'tapi pesannya sendiri gambar → msg = m dipakai')
assert.equal(m2.text, '.meme a | b', 'caption terbaca sebagai teks')

console.log('✅ reply gambar lulus')
