let handler = async (m, { text, args, conn }) => {
  let url = args[0]
  if (!url || !/^https?:\/\//.test(url)) throw 'Awali *URL* dengan http:// atau https://'

  let res
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
  } catch (e) {
    return m.reply('❌ Gagal fetch: ' + e.message)
  }

  let contentType = res.headers.get('content-type') || ''
  let contentLength = Number(res.headers.get('content-length') || 0)

  if (contentLength > 200 * 1024 * 1024) {
    return m.reply('🚩 File terlalu besar (' + formatSize(contentLength) + '), max 200 MB.')
  }

  if (/json/i.test(contentType)) {
    let json = await res.json()
    return m.reply(JSON.stringify(json, null, 2))
  }

  if (/text|html|xml|javascript|css|csv/i.test(contentType)) {
    let t = await res.text()
    if (t.length > 4000) t = t.slice(0, 3900) + '\n\n... (dipotong)'
    return m.reply(t)
  }

  // Binary: download & send
  let buf = Buffer.from(await res.arrayBuffer())
  let ext = getExt(contentType)
  let name = url.split('/').pop().split('?')[0] || 'file'
  if (!name.includes('.')) name += ext

  await conn.message.send(m.chat, buf, {
    filename: name,
    mimetype: contentType,
    quote: m
  })
}

handler.help = ['fetch <url>', 'get <url>']
handler.tags = ['tools']
handler.command = /^(fetch|get)$/i

module.exports = handler

function formatSize(bytes) {
  if (!bytes) return '?'
  let k = 1024
  let sizes = ['Bytes', 'KB', 'MB', 'GB']
  let i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

function getExt(contentType) {
  let map = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/webp': '.webp', 'video/mp4': '.mp4', 'audio/mpeg': '.mp3',
    'application/pdf': '.pdf', 'application/zip': '.zip'
  }
  for (let [mime, ext] of Object.entries(map)) {
    if (contentType.includes(mime)) return ext
  }
  return '.bin'
}
