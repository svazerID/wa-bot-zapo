let fs = require('fs')
let path = require('path')
let { execFile } = require('child_process')

let API = 'https://api.alfisy.my.id/api'
let TMP = path.join(__dirname, '..', 'tmp')
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true })

// SAMA PERSIS dengan perintah fetch yang sudah terbukti berhasil:
// plain fetch + User-Agent saja. Tanpa AbortSignal, tanpa header tambahan,
// tanpa opsi redirect — kombinasi itulah yang memicu "terminated" di undici.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function apiGet(pathname, params) {
  let url = new URL(API + pathname)
  for (let [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

function runCurlOnce(url, outFile, timeoutSec) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      [
        '-L', '-sS', '--fail',
        '--http1.1',          // paksa HTTP/1.1: beberapa CDN bermasalah di HTTP/2
        '-C', '-',            // RESUME: lanjutkan dari byte terakhir file yang sudah ada
        '--max-time', String(timeoutSec),
        '-A', UA,
        '-o', outFile,
        url,
      ],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || '').trim() || err.message))
        resolve()
      }
    )
  })
}

// Fallback curl dengan resume otomatis: koneksi diputus → lanjut dari byte terakhir
async function downloadWithCurl(url, { maxAttempts = 10, timeoutSec = 90 } = {}) {
  const tmpFile = path.join(TMP, `dl_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`)
  let lastErr = null
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runCurlOnce(url, tmpFile, timeoutSec)
        let size = fs.existsSync(tmpFile) ? fs.statSync(tmpFile).size : 0
        if (!size) throw new Error('file kosong dari server')
        return fs.readFileSync(tmpFile)
      } catch (e) {
        lastErr = e
        // Error 33 = server tidak support range → hapus file, mulai dari awal
        if (/range/i.test(e.message)) {
          try { fs.unlinkSync(tmpFile) } catch {}
          continue
        }
        // Koneksi diputus tapi sudah ada progres → resume di attempt berikut
        let size = fs.existsSync(tmpFile) ? fs.statSync(tmpFile).size : 0
        if (size > 0 && attempt < maxAttempts) {
          await sleep(400 * attempt)
          continue
        }
        throw e
      }
    }
    throw lastErr || new Error('curl: percobaan habis')
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

async function download(url, { retries = 3 } = {}) {
  // Jalur 1: plain fetch, IDENTIK dengan perintah fetch yang berhasil
  let lastErr = null
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) throw new Error('file kosong dari server')
      return buf
    } catch (e) {
      lastErr = e
      if (attempt < retries) await sleep(700 * attempt)
    }
  }

  // Jalur 2: curl resume (pengaman kalau fetch tetap kena "terminated")
  try {
    return await downloadWithCurl(url)
  } catch (e) {
    throw new Error(lastErr ? `${lastErr.message} | ${e.message}` : e.message)
  }
}

function cleanTitle(title, max = 70) {
  let t = String(title || 'tanpa judul').replace(/[|*_~`]/g, '').replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}

function fmtSize(bytes) {
  let mb = (bytes || 0) / 1048576
  return mb >= 1 ? mb.toFixed(1) + ' MB' : ((bytes || 0) / 1024).toFixed(0) + ' KB'
}

function fmtDuration(seconds) {
  let n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return '-'
  let m = Math.floor(n / 60), s = Math.round(n % 60)
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

module.exports = {
  name: 'play',
  description: 'Cari lagu di YouTube lalu kirim thumbnail + audio.',
  aliases: ['yt', 'ytdl', 'song'],
  tags: ['downloader'],
  permissions: {},
  command: /^(play|yt|ytdl|song)$/i,
  run: async (m, { conn, args, text, usedPrefix, command }) => {
    let query = args.join(' ').trim()
    if (!query) {
      return m.reply(`❌ Contoh: ${usedPrefix}${command} runtuh`)
    }

    await m.reply(`🔎 Mencari "${query}"...`)

    // 1. Cari
    let search
    try {
      search = await apiGet('/search/yts', { q: query })
    } catch (e) {
      return m.reply('❌ Gagal searching: ' + (e.message || e))
    }
    if (!search.status) return m.reply('❌ API error: ' + (search.message || 'unknown'))
    let first = (search.result || [])[0]
    if (!first) return m.reply(`❌ Nggak nemu "${query}".`)

    await m.reply('⏳ Ambil audio...')

    // Helper: ambil link audio fresh dari API
    const getTrack = async () => {
      let info = await apiGet('/download/youtube', { url: first.url })
      if (!info.status) throw new Error('API error: ' + (info.message || 'unknown'))
      let track = (info.videos || [])[0]
      if (!track?.url) throw new Error('Nggak ada sumber audio.')
      return info
    }

    // 2. Ambil link audio
    let info
    try {
      info = await getTrack()
    } catch (e) {
      return m.reply('❌ Gagal ambil link: ' + (e.message || e))
    }
    let track = (info.videos || [])[0]

    let title = cleanTitle(info.title || first.title)
    let files = []
    let caption = [
      `🎵 *${title}*`,
      `⏱️ ${fmtDuration(info.duration)} · 💾 ${fmtSize(track.size)}`,
      '',
      first.url
    ].join('\n')

    // PENTING: mulai download audio SEGERA setelah link didapat.
    // Link download sering kedaluwarsa; jangan tunggu thumbnail terkirim dulu.
    let audioPromise = download(track.url)

    // 3. Thumbnail + info dulu, biar user langsung lihat cover
    if (info.thumbnail) {
      try {
        let buf = await download(info.thumbnail)
        let f = path.join(TMP, `yt_thumb_${Date.now()}.jpg`)
        fs.writeFileSync(f, buf)
        files.push(f)
        await conn.message.send(m.chat, {
          type: 'image',
          media: f,
          mimetype: 'image/jpeg',
          caption
        }, { quote: m })
      } catch (e) {
        console.error('Thumbnail gagal:', e.message || e)
        await m.reply(caption).catch(() => {})
      }
    } else {
      await m.reply(caption).catch(() => {})
    }

    // 4. Tunggu audio yang sudah mulai didownload sejak tadi.
    //    Kalau gagal (mis. link kedaluwarsa), refresh link sekali lalu coba lagi.
    try {
      let buf
      try {
        buf = await audioPromise
      } catch (e1) {
        console.log('Download gagal, refresh link:', e1.message)
        info = await getTrack()
        track = (info.videos || [])[0]
        buf = await download(track.url)
      }

      let ext = track.type || 'mp3'
      let f = path.join(TMP, `yt_${Date.now()}.${ext}`)
      fs.writeFileSync(f, buf)
      files.push(f)
      await conn.message.send(m.chat, {
        type: 'audio',
        media: f,
        mimetype: track.mimeType || 'audio/mpeg',
        fileName: `${cleanTitle(info.title || first.title, 50)}.${ext}`,
        ptt: false
      }, { quote: m })
    } catch (e) {
      return m.reply('❌ Gagal download: ' + (e.message || e))
    } finally {
      for (let f of files) {
        try { fs.unlinkSync(f) } catch {}
      }
    }
  }
}