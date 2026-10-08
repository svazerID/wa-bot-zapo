let sharp, ffmpeg

try { sharp = require('sharp') } catch { sharp = null }
try { ffmpeg = require('fluent-ffmpeg') } catch { ffmpeg = null }

async function generateImageThumbnail(input, maxEdge) {
  if (!sharp) return null
  let buffer = await readInput(input)
  let pipeline = sharp(buffer).rotate().resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
  let meta = await pipeline.metadata().catch(() => ({}))
  let jpegThumbnail = await pipeline.jpeg({ quality: 75 }).toBuffer()
  return {
    jpegThumbnail: new Uint8Array(jpegThumbnail),
    width: meta.width || 0,
    height: meta.height || 0
  }
}

// fluent-ffmpeg HANYA menerima path file atau stream — kalau diberi Buffer
// dia lempar "No input specified" secara sync, jadi thumbnail video selalu null
// dan preview di WhatsApp jadi abu-abu. Wajib lewat file path.
// Frame pertama sering gelap (fade-in/black opening), jadi ambil frame ~
// 1 detik masuk, bukan frame 0 — itu penyebab thumbnail hitam/abu.
const THUMB_SEEK_SEC = 1

// Batas ffmpeg paralel. Tiap ffmpeg spawn banyak thread; di container dengan
// cpu.max=2, 4 proses paralel bikin stalling (proses nge-spin tanpa keluar).
// Antre aja biar nggak rebut CPU.
const MAX_FFMPEG_CONCURRENT = 2
let ffmpegQueue = 0
let ffmpegWaiters = []

function acquireFfmpegSlot() {
  return new Promise(resolve => {
    if (ffmpegQueue < MAX_FFMPEG_CONCURRENT) {
      ffmpegQueue++
      return resolve(releaseFfmpegSlot)
    }
    ffmpegWaiters.push(() => {
      ffmpegQueue++
      resolve(releaseFfmpegSlot)
    })
  })
}

function releaseFfmpegSlot() {
  ffmpegQueue--
  let next = ffmpegWaiters.shift()
  if (next) next()
}

async function generateVideoThumbnail(input, maxEdge) {
  if (!ffmpeg) return null
  let buffer
  try {
    buffer = await readInput(input)
  } catch {
    return null
  }

  let tmpPath = writeTempInput(buffer)
  let release = await acquireFfmpegSlot()
  try {
    // durasi < THUMB_SEEK_SEC (mis. video 0.4s) -> ffmpeg nggak nemu frame,
    // output kosong. Coba lagi dari frame 0 buat kasus itu.
    for (let seek of [THUMB_SEEK_SEC, 0]) {
      let thumb = await runThumb(ffmpeg(tmpPath.file)
        .on('stderr', () => {})
        .outputOptions([
          '-ss', String(seek),
          '-vf', `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease`,
          '-frames:v', '1',
          '-q:v', '5'
        ])
        .format('mjpeg'))
      if (thumb) return thumb
    }
    return null
  } finally {
    release()
    cleanupTemp(tmpPath)
  }
}

// Resolve thumb | null. null = output bukan JPEG valid (caller boleh retry).
function runThumb(proc) {
  return new Promise(resolve => {
    let chunks = []
    let done = false
    let collect = () => {
      if (done) return
      done = true
      let buf = Buffer.concat(chunks)
      // magic bytes JPEG ffd8ff wajib; output kosong/half-written berarti gagal
      if (buf.length < 100 || buf.slice(0, 3).toString('hex') !== 'ffd8ff') return resolve(null)
      resolve({ jpegThumbnail: new Uint8Array(buf), width: 0, height: 0 })
    }
    proc.on('error', () => { if (!done) { done = true; resolve(null) } })
    let stream = proc.pipe()
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', collect)
    // aman kalau ffmpeg mati sebelum stream emit 'end'
    proc.on('end', collect)
  })
}

let tmpSeq = 0
function writeTempInput(buffer) {
  let fs = require('fs')
  let os = require('os')
  let path = require('path')
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-thumb-'))
  let p = path.join(dir, `in-${process.pid}-${tmpSeq++}.mp4`)
  fs.writeFileSync(p, buffer)
  return { dir, file: p }
}

function cleanupTemp(entry) {
  if (!entry) return
  try { require('fs').rmSync(entry.dir, { recursive: true, force: true }) } catch {}
}

// Sama seperti generateVideoThumbnail: ffprobe juga butuh file path, bukan
// Buffer. Dan ikut antre di slot yang sama biar ga rebut CPU.
async function probeMedia(input) {
  if (!ffmpeg) return {}
  let buffer
  try {
    buffer = await readInput(input)
  } catch {
    return {}
  }

  let tmpPath = writeTempInput(buffer)
  let release = await acquireFfmpegSlot()
  try {
    let data = await new Promise(resolve => {
      ffmpeg.ffprobe(tmpPath.file, (err, d) => resolve(err ? null : d))
    })
    if (!data) return {}
    let v = data.streams?.find(s => s.codec_type === 'video') || {}
    return {
      durationSeconds: data.format?.duration ? Math.round(data.format.duration) : undefined,
      width: v.width || undefined,
      height: v.height || undefined
    }
  } catch {
    return {}
  } finally {
    release()
    cleanupTemp(tmpPath)
  }
}

async function readInput(input) {
  if (Buffer.isBuffer(input)) return input
  if (input instanceof Uint8Array) return Buffer.from(input)
  if (typeof input === 'string') {
    let fs = require('fs')
    return fs.promises.readFile(input)
  }
  // stream
  let fs = require('fs')
  let chunks = []
  for await (let c of input) chunks.push(c)
  return Buffer.concat(chunks)
}

// Download media pesan + ambil Buffer-nya. Timeout default zapo 30s terlalu
// pendek di koneksi lambat (sticker/video sering "transfer timed out") — naikkan.
async function downloadMedia(message, { timeoutMs = 120000 } = {}) {
  let { downloadMediaMessage } = require('zapo-js')
  let stream = await downloadMediaMessage(message, { downloadNativeClock: false, timeoutMs })
  if (!stream) return null
  return readInput(stream)
}

module.exports = {
  generateImageThumbnail,
  generateVideoThumbnail,
  probeMedia,
  readInput,
  downloadMedia,
  acquireFfmpegSlot
}
