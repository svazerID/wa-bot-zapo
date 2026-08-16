let fs = require('fs')
let path = require('path')

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!args[0]) return m.reply(`Contoh: ${usedPrefix}${command} https://vt.tiktok.com/xxxxx/`)
  let url = args[0]
  if (!/tiktok\.com/i.test(url)) return m.reply('URL tidak valid, harus link TikTok')

  await m.reply('⏳ Mengambil video...')
  try {
    let res = await fetch(`https://api.alfisy.my.id/api/download/tiktok?url=${encodeURIComponent(url)}`)
    let json = await res.json()
    if (!json.status) return m.reply('❌ Gagal: ' + (json.message || 'unknown error'))

    let data = json.data
    let videoUrl = data.download
    if (!videoUrl) return m.reply('❌ Tidak ada video di link tersebut')

    // Download ke file sementara (zapo prefer file path untuk media)
    let tmpDir = path.join(__dirname, '..', 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    let tmpFile = path.join(tmpDir, `tiktok_${Date.now()}.mp4`)

    let videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error('Download video gagal: HTTP ' + videoRes.status)
    let buffer = Buffer.from(await videoRes.arrayBuffer())
    fs.writeFileSync(tmpFile, buffer)

    let caption = [
      `*🎬 TikTok Downloader*`,
      ``,
      `📝 ${data.title || '-'}`,
      `👤 @${data.author?.username || 'unknown'} (${data.author?.nickname || '-'})`,
      `❤️ ${(data.like || 0).toLocaleString()} likes`,
      `👁️ ${(data.views || 0).toLocaleString()} views`,
      `💬 ${(data.comment || 0).toLocaleString()} comments`,
      `⏱️ ${data.duration || '-'}`
    ].join('\n')

    await conn.message.send(m.chat, {
      type: 'video',
      media: tmpFile,
      mimetype: 'video/mp4',
      caption
    }, { quote: m })

    // Cleanup
    fs.unlinkSync(tmpFile)
  } catch (e) {
    m.reply('❌ Error: ' + (e.message || e)).catch(() => {})
  }
}
handler.help = ['tiktok', 'tt'].map(v => v + ' <url>')
handler.tags = ['downloader']
handler.command = /^(tiktok|tt)$/i

module.exports = handler
