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

function generateVideoThumbnail(input, maxEdge) {
  return new Promise(resolve => {
    if (!ffmpeg) return resolve(null)
    readInput(input).then(buffer => {
      let chunks = []
      let proc = ffmpeg(buffer)
        .on('stderr', () => {})
        .inputFormat('mp4')
        .outputOptions([
          '-vf', `scale='min(${maxEdge},iw)':'min(${maxEdge},ih)':force_original_aspect_ratio=decrease`,
          '-frames:v', '1',
          '-q:v', '5'
        ])
        .format('mjpeg')
        .on('error', () => resolve(null))
        .on('data', chunk => chunks.push(chunk))
        .pipe()
      proc.on('end', () => resolve({
        jpegThumbnail: new Uint8Array(Buffer.concat(chunks)),
        width: 0,
        height: 0
      }))
    }).catch(() => resolve(null))
  })
}

function probeMedia(input) {
  return new Promise(resolve => {
    if (!ffmpeg) return resolve({})
    readInput(input).then(buffer => {
      ffmpeg.ffprobe(buffer, (err, data) => {
        if (err || !data) return resolve({})
        let v = data.streams?.find(s => s.codec_type === 'video') || {}
        let a = data.streams?.find(s => s.codec_type === 'audio') || {}
        resolve({
          durationSeconds: data.format?.duration ? Math.round(data.format.duration) : undefined,
          width: v.width,
          height: v.height
        })
      })
    }).catch(() => resolve({}))
  })
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

module.exports = {
  generateImageThumbnail,
  generateVideoThumbnail,
  probeMedia
}
