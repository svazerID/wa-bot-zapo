const { downloadMediaMessage } = require('zapo-js')
const { writeExif } = require('../lib/exif')
const fs = require('fs')
const path = require('path')

const TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

async function streamToBuffer(stream) {
  let chunks = []
  for await (let chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

let handler = async (m, { conn, args, command }) => {
  // --- STICKER ---
  if (/^(sticker|s)$/i.test(command)) {
    let msg = m.quoted ? m.quoted : m
    let mediaType = getMediaType(msg.message)
    if (!mediaType || mediaType === 'audio' || mediaType === 'document') {
      return m.reply('Reply atau kirim gambar/video dengan caption *!sticker*')
    }

    let stream
    try {
      let qMsg = m.quoted?.message
      stream = await downloadMediaMessage(qMsg || m, { downloadNativeClock: false })
    } catch (e) {
      throw e
    }
    if (!stream) return m.reply('Gagal download media.')
    let buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)

    let ext = mediaType === 'image' ? 'png' : mediaType === 'video' ? 'mp4' : 'webp'
    let mimetype = msg.message?.imageMessage?.mimetype
      || msg.message?.videoMessage?.mimetype
      || msg.message?.stickerMessage?.mimetype
      || `image/${ext}`

    // Sudah webp → langsung kirim
    if (/webp/.test(mimetype) && mediaType === 'sticker') {
      let tmpFile = path.join(TMP, `stk_${Date.now()}.webp`)
      fs.writeFileSync(tmpFile, buffer)
      try {
        await conn.message.send(m.chat, {
          type: 'sticker',
          media: tmpFile,
          mimetype: 'image/webp'
        }, { quote: m })
      } finally {
        fs.unlinkSync(tmpFile)
      }
      return
    }

    // Convert + exif
    let webpBuf = await writeExif(
      { data: buffer, mimetype, ext },
      { packName: global.packname || 'Sticker', packPublish: global.author || 'Bot' }
    )

    if (!webpBuf) return m.reply('Gagal buat sticker.')
    let tmpFile = path.join(TMP, `stk_${Date.now()}.webp`)
    fs.writeFileSync(tmpFile, webpBuf)
    try {
      await conn.message.send(m.chat, {
        type: 'sticker',
        media: tmpFile,
        mimetype: 'image/webp'
      }, { quote: m })
    } finally {
      fs.unlinkSync(tmpFile)
    }
    return
  }

  // --- TOIMG ---
  if (/^(toimg|toimage)$/i.test(command)) {
    let msg = m.quoted ? m.quoted : m
    if (!m.quoted) return m.reply('Reply sticker yang mau dijadikan gambar.')
    if (getMediaType(msg.message) !== 'sticker') return m.reply('Itu bukan sticker.')

    let stream = await downloadMediaMessage(m.quoted?.message || msg.message, { downloadNativeClock: false })
    if (!stream) return m.reply('Gagal download sticker.')
    let buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)

    let tmpFile = path.join(TMP, `toimg_${Date.now()}.webp`)
    fs.writeFileSync(tmpFile, buffer)
    try {
      await conn.message.send(m.chat, {
        type: 'image',
        media: tmpFile,
        mimetype: 'image/webp',
        caption: ''
      }, { quote: m })
    } finally {
      fs.unlinkSync(tmpFile)
    }
    return
  }
}

function getMediaType(message) {
  if (!message) return null
  if (message.stickerMessage) return 'sticker'
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  return null
}

handler.help = ['sticker', 'toimg']
handler.tags = ['tools']
handler.command = /^(sticker|s|toimg|toimage)$/i

module.exports = handler
