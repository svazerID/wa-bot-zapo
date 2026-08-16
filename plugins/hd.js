const { downloadMediaMessage } = require('zapo-js')
const { upload } = require('../lib/upload')
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
  let msg = m.quoted ? m.quoted : m
  let mediaType = msg.message?.imageMessage ? 'image' : null
  if (!mediaType) return m.reply('Reply gambar dengan *!hd* untuk upscale.')

  await m.reply('⏳ Memproses gambar HD...')

  // 1. Download gambar
  let stream = await downloadMediaMessage(m.quoted?.message || msg.message, { downloadNativeClock: false })
  let buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)

  let tmpIn = path.join(TMP, `hd_${Date.now()}.jpg`)
  fs.writeFileSync(tmpIn, buffer)

  try {
    // 2. Upload ke CDN
    let uploaded = await upload(buffer, 'image.jpg', 'image/jpeg')
    if (!uploaded.url) return m.reply('❌ Gagal upload gambar.')

    // 3. HD enlarge
    let hdUrl = `https://api.alfisy.my.id/api/tools/imglarger?url=${encodeURIComponent(uploaded.url)}&type=enlarger`
    let hdRes = await fetch(hdUrl)
    let hdData = await hdRes.json()
    if (!hdData.status || !hdData.data?.output_url) {
      return m.reply('❌ Gagal memproses HD.')
    }

    // 4. Download hasil HD
    let hdImgRes = await fetch(hdData.data.output_url)
    let hdBuffer = Buffer.from(await hdImgRes.arrayBuffer())

    let tmpOut = path.join(TMP, `hd_out_${Date.now()}.png`)
    fs.writeFileSync(tmpOut, hdBuffer)

    await conn.message.send(m.chat, {
      type: 'image',
      media: tmpOut,
      mimetype: 'image/png',
      caption: `✅ HD selesai (${hdData.data.model})`
    }, { quote: m })

    fs.unlinkSync(tmpOut)
  } finally {
    fs.unlinkSync(tmpIn)
  }
}

handler.help = ['hd']
handler.tags = ['tools']
handler.command = /^hd$/i

module.exports = handler
