// Cek plugin meme: API nyata, parsing "atas | bawah", jalur upload.
// Jalankan: node test-meme.js   (butuh internet)
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const mp = require('./lib/mediaProcessor')
const origDownload = mp.downloadMedia
// stub dipasang SEBELUM require plugin — plugin men-destructure saat load
const img0 = fs.readFileSync(path.join(__dirname, 'input.jpg'))
mp.downloadMedia = async () => img0
const meme = require('./plugins/meme.js')

function capture() {
  let sent = null
  return {
    get sent() { return sent },
    conn: { message: { send: async (chat, msg) => {
      let copy = msg.media + '.copy'
      fs.copyFileSync(msg.media, copy)
      sent = { ...msg, media: copy }
    } } }
  }
}
const isPng = f => fs.readFileSync(f).slice(0, 8).toString('hex') === '89504e470d0a1a0a'

// quoted berisi gambar; downloadMedia distub supaya tidak perlu WhatsApp asli
const quotedImage = { message: { imageMessage: { mimetype: 'image/jpeg' } } }
const baseM = { chat: 't@s.whatsapp.net', pushname: 'T', reply: async () => {}, quoted: quotedImage }

async function main() {
  // 1. registry
  assert.ok(meme.command.test('meme'))
  assert.ok(meme.command.test('memegen'))
  assert.ok(meme.command.test('smeme'), 'alias smeme dikenali')
  assert.ok(!meme.command.test('memex'))
  assert.deepEqual(meme.tags, ['tools'])


  // 2. "atas | bawah" → meme dibuat lewat API nyata
  let c = capture()
  await meme({ ...baseM }, { conn: c.conn, text: 'halo | dunia', usedPrefix: '!', command: 'meme' })
  assert.ok(c.sent, 'meme terkirim')
  assert.equal(c.sent.type, 'sticker', 'hasil dikirim sebagai sticker')
  assert.equal(c.sent.mimetype, 'image/webp')
  const isWebp = f2 => fs.readFileSync(f2).slice(0, 4).toString() === 'RIFF'
  assert.ok(isWebp(c.sent.media), 'hasil webp valid')
  const { Image } = require('node-webpmux')
  const im = new Image(); await im.load(c.sent.media)
  const ex = JSON.parse(im.exif.slice(22).toString())
  assert.equal(ex['sticker-pack-name'], 'Created by', 'exif pack terisi')
  console.log('  atas | bawah →', fs.statSync(c.sent.media).size, 'bytes webp | pack:', ex['sticker-pack-name'])

  // 3. tanpa "|" → semua jadi teks atas
  c = capture()
  await meme({ ...baseM }, { conn: c.conn, text: 'cuma atas', usedPrefix: '!', command: 'meme' })
  assert.ok(c.sent && c.sent.type === 'sticker', 'tanpa "|" tetap jalan (teks atas)')
  console.log('  tanpa "|"    →', fs.statSync(c.sent.media).size, 'bytes webp')

  // 4. tanpa teks → minta teks, tidak fetch
  let replied = []
  await meme({ ...baseM, reply: async t => replied.push(t) }, { conn: capture().conn, text: '', usedPrefix: '!', command: 'meme' })
  assert.ok(replied[0].includes('Kasih teksnya'), 'tanpa teks minta teks')
  console.log('  tanpa teks   → minta teks')

  // 5. tanpa gambar → minta reply gambar
  replied = []
  await meme({ ...baseM, quoted: null, reply: async t => replied.push(t) }, { conn: capture().conn, text: 'a | b', usedPrefix: '!', command: 'meme' })
  assert.ok(replied[0].includes('Reply'), 'tanpa gambar minta gambar')
  assert.ok(replied[0].includes('atas | teks bawah'), 'jelaskan format')
  console.log('  tanpa gambar → minta reply gambar')

  mp.downloadMedia = origDownload
  for (let f of fs.readdirSync('./tmp')) if (f.endsWith('.copy')) fs.unlinkSync('./tmp/' + f)
  console.log('✅ meme lulus')
}

main().catch(e => { mp.downloadMedia = origDownload; console.error('❌', e.message); process.exit(1) })
