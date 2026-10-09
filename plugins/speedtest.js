const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')

const TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

const execPromise = promisify(exec)
const CMD = 'curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py | python3 - --share'

// Ponytail: speedtest-cli menaruh latency di baris
//   "Hosted by <isp> (<kota>) [<jarak> km]: 28.916 ms"
// BUKAN "Latency: ..." — regex snippet asli akan selalu N/A.
// "Latency:" tetap dicoba sebagai fallback kalau formatnya berubah.
function parseSpeedtest(stdout) {
  let ping = stdout.match(/Latency:\s+([\d.]+)\s*ms/i)?.[1] ||
    stdout.match(/\]\s*:\s*([\d.]+)\s*ms/i)?.[1]
  let host = stdout.match(/Hosted by (.+?)\s*\[/)?.[1]
  return {
    ping: ping ? `${ping} ms` : 'N/A',
    download: stdout.match(/Download:\s+([\d.]+)\s*Mbit\/s/i)?.[1] || null,
    upload: stdout.match(/Upload:\s+([\d.]+)\s*Mbit\/s/i)?.[1] || null,
    share: stdout.match(/Share results:\s+(https?:\/\/[^\s]+)/)?.[1] || null,
    server: host || null
  }
}

let handler = async (m, { conn }) => {
  await m.reply('⏳ Menjalankan speedtest (~30-60 detik)...')

  let stdout = ''
  try {
    let res = await execPromise(CMD, { timeout: 180000, cwd: __dirname })
    stdout = res.stdout || ''
  } catch (e) {
    // exec melempar kalau exit != 0 ATAU timeout, tapi stdout sering tetap ada.
    stdout = e.stdout || ''
    if (!stdout) return m.reply('❌ Gagal speedtest: ' + (e.message || e))
  }
  if (!stdout.trim()) return m.reply('❌ Tidak ada output dari speedtest-cli.')

  let r = parseSpeedtest(stdout)
  // Ping wajib ada; download/upload bisa "N/A" kalau server mati di tengah tes.
  if (r.ping === 'N/A' && !r.download && !r.upload) {
    return m.reply('❌ Speedtest tidak menghasilkan data (server mungkin menolak).')
  }

  let lines = [
    '📊 *Hasil Speedtest*',
    `• *Ping*: ${r.ping}`,
    `• *Download*: ${r.download ? r.download + ' Mbit/s' : 'N/A'}`,
    `• *Upload*: ${r.upload ? r.upload + ' Mbit/s' : 'N/A'}`
  ]
  if (r.server) lines.push(`• *Server*: ${r.server}`)
  let caption = lines.join('\n')

  // Hasil share speedtest itu gambar PNG — kirim sebagai gambar + caption,
  // bukan link mentah. Kalau gagal, fallback ke teks biasa.
  if (r.share) {
    try {
      let res = await fetch(r.share)
      if (res.ok) {
        let buf = Buffer.from(await res.arrayBuffer())
        // hasil speedtest selalu PNG; kalau bukan, jangan kirim sampah.
        if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
          let tmpFile = path.join(TMP, `spd_${Date.now()}.png`)
          fs.writeFileSync(tmpFile, buf)
          try {
            await conn.message.send(m.chat, {
              type: 'image',
              media: tmpFile,
              mimetype: 'image/png',
              caption
            }, { quote: m })
          } finally {
            try { fs.unlinkSync(tmpFile) } catch {}
          }
          return
        }
      }
    } catch (e) {
      console.log('speedtest: gagal ambil gambar hasil:', e.message || e)
    }
  }

  await m.reply(caption)
}

handler.description = "Tes kecepatan internet server (ping, download, upload)."
handler.help = ['speedtest']
handler.tags = ['info']
handler.command = /^(speedtest|spdtest|sts)$/i

module.exports = handler
