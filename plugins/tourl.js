const { downloadMediaMessage } = require('zapo-js')
const { upload } = require('../lib/upload')

async function streamToBuffer(stream) {
  let chunks = []
  for await (let chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

let handler = async (m, { conn }) => {
  let msg = m.quoted ? m.quoted : m
  let mediaType = getMediaType(msg.message)
  if (!mediaType || mediaType === 'sticker') return m.reply('Reply media (gambar/video/audio/document) dengan *!tourl*')

  let stream = await downloadMediaMessage(m.quoted?.message || msg.message, { downloadNativeClock: false })
  let buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)

  let mimetypes = {
    image: msg.message?.imageMessage?.mimetype || 'image/jpeg',
    video: msg.message?.videoMessage?.mimetype || 'video/mp4',
    audio: msg.message?.audioMessage?.mimetype || 'audio/mpeg',
    document: msg.message?.documentMessage?.mimetype || 'application/octet-stream'
  }

  let ext = mimetypes[mediaType].split('/')[1]?.split(';')[0] || 'bin'
  let filename = `media.${ext}`

  let result = await upload(buffer, filename, mimetypes[mediaType])

  let caption = `✅ *URL:* ${result.url}\n📦 *Size:* ${(result.size / 1024).toFixed(1)} KB\n📎 *Type:* ${result.mimetype}`
  await m.reply(caption)
}

function getMediaType(message) {
  if (!message) return null
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  return null
}

handler.help = ['tourl']
handler.tags = ['tools']
handler.command = /^tourl$/i

module.exports = handler
