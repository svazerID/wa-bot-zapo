// Cek plugin brat: fetch nyata dari API → webp valid + exif pack terisi.
// Jalankan: node test-brat.js   (butuh internet)
const assert = require('assert')
const { Image } = require('node-webpmux')
const brat = require('./plugins/brat.js')  // format function: module.exports = handler

async function main() {
  // 1. plugin terdaftar benar di menu
  assert.ok(brat.command.test('brat'), 'brat dikenali')
  assert.ok(brat.command.test('bratvid'), 'bratvid dikenali')
  assert.ok(!brat.command.test('bratx'), 'bratx tidak dikenali')
  assert.deepEqual(brat.tags, ['tools'])

  // 2. fetch + convert nyata: jalankan handler dengan m tiruan
  let sent = null
  const m = {
    chat: 'test@s.whatsapp.net',
    pushname: 'Tester',
    reply: async () => {},
    quoted: null
  }
  const fsx = require('fs')
  // plugin menghapus file setelah kirim — salin dulu supaya bisa diperiksa
  const conn = { message: { send: async (chat, msg) => {
    let copy = msg.media + '.copy'
    fsx.copyFileSync(msg.media, copy)
    sent = { ...msg, media: copy }
  } } }

  await brat(m, { conn, args: ['hai', 'dunia'], text: 'hai dunia', command: 'brat', usedPrefix: '!' })
  assert.ok(sent, 'sticker terkirim')
  assert.equal(sent.type, 'sticker')
  assert.equal(sent.mimetype, 'image/webp')

  let buf = fsx.readFileSync(sent.media)
  assert.ok(buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP', 'hasil webp valid')

  let img = new Image()
  await img.load(sent.media)
  let exif = JSON.parse(img.exif.slice(22).toString())
  assert.equal(exif['sticker-pack-name'], 'Created by', 'default pack name')
  assert.ok(exif['sticker-pack-publisher'].startsWith('Tester'), 'publisher pakai pushname')
  console.log('  brat     →', img.width + 'x' + img.height, buf.length, 'bytes | pack:', exif['sticker-pack-name'])

  // 3. bratvid → webp animasi
  sent = null
  await brat({ ...m }, { conn, args: ['teks', 'panjang', 'biar', 'animasi'], text: 'teks panjang biar animasi', command: 'bratvid', usedPrefix: '!' })
  assert.ok(sent, 'bratvid terkirim')
  buf = fsx.readFileSync(sent.media)
  let anim = buf.slice(0, 64).toString('latin1').includes('ANIM')
  assert.ok(anim, 'bratvid menghasilkan webp animasi')
  console.log('  bratvid  →', buf.length, 'bytes | animasi:', anim)

  // 4. publisher custom lewat "|"
  sent = null
  await brat({ ...m }, { conn, args: [], text: 'halo | Budi', command: 'brat', usedPrefix: '!' })
  assert.ok(sent, 'brat dengan publisher terkirim')
  let im4 = new Image()
  await im4.load(sent.media)
  let ex4 = JSON.parse(im4.exif.slice(22).toString())
  assert.equal(ex4['sticker-pack-publisher'], 'Budi', 'publisher dari "|" dipakai')
  console.log('  publisher "|" → ', JSON.stringify(ex4['sticker-pack-publisher']))

  // 5. tanpa teks → tidak fetch, cuma minta contoh
  let replied = []
  await brat({ ...m, reply: async t => replied.push(t) }, { conn, args: [], text: '', command: 'brat', usedPrefix: '!' })
  assert.ok(replied[0].includes('Contoh:'), 'tanpa teks minta contoh')
  console.log('  tanpa teks → minta contoh')

  for (let f of fsx.readdirSync('./tmp')) if (f.endsWith('.copy')) fsx.unlinkSync('./tmp/' + f)
  console.log('✅ brat lulus')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
