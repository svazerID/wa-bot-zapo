// WebP animasi (ANIM loop=inf) tidak bisa didekode ffmpeg 5.1 di container ini.
// Tap
// i node-webpmux sudah punya tiap frame terdekode (img.frames[i].vp8.raw),
// jadi bangun webp statis per frame → ffmpeg baca → mp4.
const fs = require('fs')
const path = require('path')
const os = require('os')
const { Image } = require('node-webpmux')

function wrapVp8InWebp(vp8) {
  // RIFF container minimal: VP8 chunk saja
  let chunk = Buffer.alloc(8)
  chunk.write('VP8 ', 0, 'latin1')
  chunk.writeUInt32LE(vp8.length, 4)
  let body = Buffer.concat([Buffer.from('WEBP', 'latin1'), chunk, vp8, vp8.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)])
  let header = Buffer.alloc(8)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

async function extractFrames(webpBuffer) {
  // Bukan RIFF/WEBP (mis. PNG hasil /image) → bukan animasi, jangan sampai
  // node-webpmux throw "Bad header" ke pemanggil.
  if (webpBuffer.slice(0, 4).toString('latin1') !== 'RIFF' ||
      webpBuffer.slice(8, 12).toString('latin1') !== 'WEBP') return null

  let img = new Image()
  await img.load(webpBuffer)
  if (!img.frames?.length) return null
  return img.frames.map(f => ({ vp8: f.vp8?.raw, delay: f.delay || 100 }))
}

/**
 * WebP animasi → MP4. ffmpeg 5.1 di container tidak bisa dekode ANIM loop=inf
 * ("image data not found"), jadi frame diekstrak dulu lewat node-webpmux
 * (frame-nya sudah terdekode di situ), dibungkus webp statis per frame,
 * lalu digabung ffmpeg concat dengan durasi asli tiap frame.
 * @param {Buffer} webpBuffer isi file .webp (animasi)
 * @returns {Promise<Buffer|null>} mp4, atau null kalau bukan animasi
 */
async function webpAnimToMp4(webpBuffer, { fps = 10 } = {}) {
  let frames = await extractFrames(webpBuffer)
  if (!frames) return null

  let ff = require('fluent-ffmpeg')
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp8-'))
  try {
    let lines = []
    frames.forEach((f, i) => {
      let p = path.join(dir, `f${i}.webp`)
      fs.writeFileSync(p, wrapVp8InWebp(f.vp8))
      // concat demuxer: 'duration' berlaku untuk file SEBELUMnya
      lines.push(`file '${p}'`)
      lines.push(`duration ${(f.delay / 1000).toFixed(3)}`)
    })
    // frame terakhir wajib diulang, kalau tidak durasinya hangus
    lines.push(`file '${path.join(dir, `f${frames.length - 1}.webp`)}'`)
    let listFile = path.join(dir, 'list.txt')
    fs.writeFileSync(listFile, lines.join('\n'))

    let outFile = path.join(dir, 'out.mp4')
    await new Promise((resolve, reject) => {
      ff(listFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-vsync vfr',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
          '-r', String(fps)
        ])
        .on('error', reject)
        .on('end', () => resolve(true))
        .save(outFile)
    })
    return fs.readFileSync(outFile)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

module.exports = { wrapVp8InWebp, extractFrames, webpAnimToMp4 }

// --- self-check: jalankan langsung untuk verifikasi ---
if (require.main === module) {
  ;(async () => {
    let buf = fs.readFileSync(process.argv[2] || '/tmp/t2.webp')
    let frames = await extractFrames(buf)
    console.log('frames:', frames.length)
    let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp8-'))
    // buat concat list dengan durasi per frame
    let lines = []
    frames.forEach((f, i) => {
      let p = path.join(dir, `f${i}.webp`)
      fs.writeFileSync(p, wrapVp8InWebp(f.vp8))
      lines.push(`file '${p}'`)
      lines.push(`duration ${(f.delay / 1000).toFixed(3)}`)
    })
    // ffmpeg concat butuh file terakhir diulang
    lines.push(`file '${path.join(dir, `f${frames.length - 1}.webp`)}'`)
    fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'))
    console.log('dir:', dir)
    for (let i = 0; i < frames.length; i++) console.log(' f' + i, fs.statSync(path.join(dir, `f${i}.webp`)).size, 'bytes delay', frames[i].delay)
    console.log(path.join(dir, 'list.txt'))
  })()
}
