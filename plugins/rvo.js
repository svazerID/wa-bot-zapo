const fs = require('fs')
const path = require('path')
const { downloadMedia } = require('../lib/mediaProcessor')

const TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

// Envelope view-once: pesan aslinya ada di dalam .message.
// zapo unwrap ini untuk atribut stanza, tapi payload yang sampai ke plugin
// masih berbentuk envelope — jadi plugin buka sendiri. V2Extension tidak
// ikut di-unwrap zapo, makanya ikut didaftarkan.
const ENVELOPES = [
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'ephemeralMessage',
  'documentWithCaptionMessage'
]

function unwrap(message) {
  let msg = message
  for (let i = 0; i < 5; i++) {
    let inner
    for (let key of ENVELOPES) {
      if (msg?.[key]?.message) { inner = msg[key].message; break }
    }
    if (!inner) break
    msg = inner
  }
  return msg
}

function jenisMedia(msg) {
  if (!msg) return null
  if (msg.imageMessage) return 'image'
  if (msg.videoMessage) return 'video'
  if (msg.audioMessage) return 'audio'
  return null
}

let handler = async (m, { conn, usedPrefix, command }) => {
  if (!m.quoted) {
    return m.reply(`Reply pesan *sekali lihat* (foto/video/audio) dengan *${usedPrefix}${command}*.\n\n` +
      `Pesan yang sudah dibuka tidak bisa diambil lagi — reply pesan yang belum kamu buka.`)
  }

  let inner = unwrap(m.quoted.message)
  let jenis = jenisMedia(inner)

  if (!jenis) {
    // Beri petunjuk jelas kalau yang di-reply bukan media sekali lihat.
    let adaEnvelope = !!(m.quoted.message?.viewOnceMessage || m.quoted.message?.viewOnceMessageV2 || m.quoted.message?.viewOnceMessageV2Extension)
    if (adaEnvelope) return m.reply('❌ Isi pesan sekali lihat ini bukan foto/video/audio (mungkin teks).')
    return m.reply('❌ Itu bukan pesan sekali lihat.')
  }

  await m.reply('⏳ Mengambil media...')

  // downloadMedia butuh objek message, jadi kirim yang sudah di-unwrap.
  let buffer
  try {
    buffer = await downloadMedia(inner)
  } catch (e) {
    return m.reply('❌ Gagal download: ' + (e.message || e))
  }
  if (!buffer) return m.reply('❌ Media kosong / sudah kedaluwarsa.')

  let caption = inner[jenis + 'Message']?.caption || ''
  let ext = jenis === 'image' ? 'jpg' : jenis === 'video' ? 'mp4' : 'ogg'
  let tmpFile = path.join(TMP, `rvo_${Date.now()}.${ext}`)
  fs.writeFileSync(tmpFile, buffer)

  try {
    if (jenis === 'audio') {
      await conn.message.send(m.chat, {
        type: 'audio',
        media: tmpFile,
        mimetype: inner.audioMessage.mimetype || 'audio/ogg',
        ptt: false
      }, { quote: m })
    } else {
      await conn.message.send(m.chat, {
        type: jenis,
        media: tmpFile,
        mimetype: inner[jenis + 'Message'].mimetype || (jenis === 'image' ? 'image/jpeg' : 'video/mp4'),
        caption
      }, { quote: m })
    }
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

handler.description = "Buka pesan sekali lihat (reply pesan view-once → dikirim ulang sebagai media biasa)."
handler.help = ['rvo']
handler.tags = ['tools']
handler.command = /^(rvo|readviewonce)$/i

module.exports = handler
