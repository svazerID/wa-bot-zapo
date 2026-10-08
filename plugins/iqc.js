const fs = require('fs')
const path = require('path')
const { downloadMedia } = require('../lib/mediaProcessor')
const { upload } = require('../lib/upload')

const TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

const API = 'https://brat.siputzx.my.id/v2/iphone-quoted'

// ponytail: sender harus "other" dan imageUrl harus DIHILANGKAN (bukan null/kosong
// dikirim) — null bikin API 500. Field lain dipakai default API.
async function buildIqc({ message, imageUrl }) {
  let body = {
    sender: 'other',
    message,
    timestamp: jamMenit(),
    time: jamMenit(),
    status: {
      carrierName: 'INDOSAT OORE...',
      batteryPercentage: 88,
      signalStrength: 4,
      wifi: true
    },
    backgroundUrl: '',
    readStatus: true,
    emojiStyle: 'apple'
  }
  if (imageUrl) body.imageUrl = imageUrl

  let res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  let buf = Buffer.from(await res.arrayBuffer())
  // Error datang sebagai JSON walau kadang HTTP 200 — cek magic PNG.
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    let msg = buf.slice(0, 200).toString().replace(/[^\x20-\x7e\n]/g, '').trim()
    throw new Error(msg || 'respons bukan gambar')
  }
  return buf
}

function jamMenit() {
  let d = new Date()
  return String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0')
}

let handler = async (m, { conn, text, quoted, mentionedJid, usedPrefix, command }) => {
  let msg = m.quoted ? m.quoted : m
  let isImage = !!(msg.message?.imageMessage)
  if (!isImage && !text) {
    return m.reply(`Contoh: ${usedPrefix}${command} gimana kabar\n\n` +
      `Gambar opsional — reply/kirim foto dengan caption *${usedPrefix}${command} <pesan>*`)
  }

  // Upload gambar dari pesan (opsional) buat dipakai sebagai foto profil chat.
  let imageUrl = null
  if (isImage) {
    await m.reply('⏳ Mengunggah gambar...')
    let buffer
    try {
      buffer = await downloadMedia(msg.message)
    } catch (e) {
      return m.reply('❌ Gagal download gambar: ' + (e.message || e))
    }
    if (buffer) {
      try {
        imageUrl = (await upload(buffer, `iqc_${Date.now()}.jpg`, msg.message.imageMessage.mimetype || 'image/jpeg')).url
      } catch (e) {
        // Gambar gagal upload bukan alasan gagalkan seluruhnya — lanjut tanpa gambar.
        m.reply('⚠️ Gagal upload gambar, lanjut tanpa foto: ' + (e.message || e)).catch(() => {})
      }
    }
  }

  await m.reply('⏳ Membuat iPhone quoted...')

  let buffer
  try {
    buffer = await buildIqc({ message: text || 'gimana', imageUrl })
  } catch (e) {
    return m.reply('❌ Gagal: ' + (e.message || e))
  }

  let tmpFile = path.join(TMP, `iqc_${Date.now()}.png`)
  fs.writeFileSync(tmpFile, buffer)
  try {
    await conn.message.send(m.chat, {
      type: 'image',
      media: tmpFile,
      mimetype: 'image/png',
      caption: ''
    }, { quote: m })
  } finally {
    fs.unlinkSync(tmpFile)
  }
}

module.exports = handler

handler.description = "Buat gambar iPhone quoted (chat bubble iPhone) dari teks, gambar opsional."
handler.help = ['iqc <pesan>']
handler.tags = ['tools']
handler.command = /^(iqc|iphonequoted|iqchat)$/i
