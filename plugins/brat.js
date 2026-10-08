const fs = require('fs')
const path = require('path')
const { writeExif } = require('../lib/exif')

const TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

const API = 'https://brat.siputzx.my.id'

// ponytail: emojiStyle=apple satu-satunya yang jalan (google balas JSON error).
// background/color/blur dipakai default API; tambah knob kalau user minta.
async function fetchBrat(text, endpoint) {
  let url = `${API}/${endpoint}?text=${encodeURIComponent(text)}` +
    `&background=%23ffffff&color=%23000000&blur=2&emojiStyle=apple` +
    (endpoint === 'mp4' ? '&delay=500&endDelay=1000' : '')
  let res = await fetch(url)
  let buf = Buffer.from(await res.arrayBuffer())
  // API balas JSON error dengan HTTP 200 — cek magic bytes, bukan status.
  if (!/^(\x89PNG|RIFF)/.test(buf.slice(0, 4).toString('latin1'))) {
    throw new Error(buf.slice(0, 120).toString().trim() || 'respons tidak dikenali')
  }
  return buf
}

// PNG dari /image atau WebP dari /mp4 → webp ber-exif
async function toSticker(data, { packName, packPublish }) {
  let isPng = data.slice(0, 8).toString('hex') === '89504e470d0a1a0a'
  return writeExif(
    { data, mimetype: isPng ? 'image/png' : 'image/webp', ext: isPng ? 'png' : 'webp' },
    { packName, packPublish }
  )
}

// Pack name: teks sebelum "|" = packName, sesudahnya publisher. Tanpa "|"
// seluruh teks tetap jadi payload brat dan pack-nya default.
function splitPack(text) {
  let i = text.indexOf('|')
  let date = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return {
    payload: (i === -1 ? text : text.slice(0, i)).trim(),
    publisher: i === -1 ? null : text.slice(i + 1).trim(),
    date
  }
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
  let anim = /^bratvid$/i.test(command)
  if (!text) return m.reply(`Contoh: ${usedPrefix}${command} halo dunia`)

  // "teks brat | publisher" → packName jadi "teks brat"? Tidak: teks brat tetap
  // gambar brat-nya. Jadi packName selalu default, hanya publisher yang bisa di-set.
  let { payload, publisher, date } = splitPack(text)
  if (!payload) return m.reply(`Contoh: ${usedPrefix}${command} halo dunia`)

  await m.reply(anim ? '⏳ Membuat brat animasi...' : '⏳ Membuat brat...')

  let buffer
  try {
    buffer = await fetchBrat(payload, anim ? 'mp4' : 'image')
  } catch (e) {
    return m.reply('❌ Gagal: ' + (e.message || e))
  }

  let webp
  try {
    webp = await toSticker(buffer, {
      packName: 'Created by',
      packPublish: publisher !== null
        ? publisher
        : (m.pushname ? `${m.pushname}\n${date}` : date)
    })
  } catch (e) {
    return m.reply('❌ Gagal buat sticker: ' + (e.message || e))
  }
  if (!webp) return m.reply('❌ Gagal buat sticker.')

  let tmpFile = path.join(TMP, `brat_${Date.now()}.webp`)
  fs.writeFileSync(tmpFile, webp)
  try {
    await conn.message.send(m.chat, {
      type: 'sticker',
      media: tmpFile,
      mimetype: 'image/webp'
    }, { quote: m })
  } finally {
    fs.unlinkSync(tmpFile)
  }
}

handler.description = "Buat sticker brat dari teks (!brat) atau brat animasi (!bratvid)."
handler.help = ['brat <teks>', 'bratvid <teks>']
handler.tags = ['tools']
handler.command = /^(brat|bratvid)$/i

module.exports = handler
