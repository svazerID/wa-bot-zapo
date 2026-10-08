// Cek parsing packName/packPublish + exif benar-benar tertulis ke webp.
// Jalankan: node test-sticker.js
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { writeExif } = require('./lib/exif')
const { Image } = require('node-webpmux')

// --- 1. salinan logika parsing dari plugins/sticker.js ---
const GLOBAL_PACK = 'wa-bot-zapo', GLOBAL_AUTH = 'zapo-js'
const DATE = '07/10/2026'
function parsePack(args, pushname = '') {
  let packName = GLOBAL_PACK
  let packPublish = GLOBAL_AUTH
  let raw = args.join(' ').trim()
  if (raw) {
    let [n, p] = raw.split('|')
    if (p === undefined) {
      packName = n.trim() || packName
      packPublish = ''
    } else {
      if (n?.trim()) packName = n.trim()
      if (p?.trim()) packPublish = p.trim()
    }
  } else {
    packName = 'Created by'
    packPublish = pushname ? `${pushname}\n${DATE}` : DATE
  }
  return { packName, packPublish }
}

// tanpa argumen + pushname → default "Created by" + nama\ntanggal
assert.deepEqual(parsePack([], 'alfi'), { packName: 'Created by', packPublish: `alfi\n${DATE}` }, 'default + pushname')
// tanpa argumen, pushname kosong → hanya tanggal
assert.deepEqual(parsePack([]), { packName: 'Created by', packPublish: DATE }, 'default tanpa pushname')
// "!s alfi" → hanya nama pack, publisher KOSONG
assert.deepEqual(parsePack(['alfi'], 'alfi'), { packName: 'alfi', packPublish: '' }, 'nama saja → publisher kosong')
// "!s created by | alfi"
assert.deepEqual(parsePack(['created', 'by', '|', 'alfi']),
  { packName: 'created by', packPublish: 'alfi' }, 'nama | publisher')
// multi-kata tanpa pipe → publisher tetap kosong, trim
assert.deepEqual(parsePack(['  Nama  Panjang  '], 'alfi'),
  { packName: 'Nama  Panjang', packPublish: '' }, 'multi-kata tanpa pipe')
// pipe dengan publisher → keduanya terisi, trim
assert.deepEqual(parsePack(['  Nama  Panjang  ', '|', '  Pub  ']),
  { packName: 'Nama  Panjang', packPublish: 'Pub' }, 'multi-kata & trim')
// pipe kosong di kanan → publisher tidak jadi kosong
assert.deepEqual(parsePack(['alfi |']), { packName: 'alfi', packPublish: GLOBAL_AUTH }, 'pipe kosong')
// hanya pipe → semuanya default, tidak error
assert.deepEqual(parsePack(['|']), { packName: GLOBAL_PACK, packPublish: GLOBAL_AUTH }, 'pipe saja')

// --- 2. exif benar-benar tertulis ---
;(async () => {
  let img = fs.readFileSync(path.join(__dirname, 'input.jpg'))
  let buf = await writeExif({ data: img, mimetype: 'image/jpeg', ext: 'jpg' }, { packName: 'created by', packPublish: 'alfi' })
  assert.ok(Buffer.isBuffer(buf), 'hasil writeExif harus Buffer')
  assert.ok(buf.length > 0, 'buffer tidak kosong')

  let m = new Image()
  await m.load(buf)
  let exif = JSON.parse(m.exif.slice(22).toString())
  assert.equal(exif['sticker-pack-name'], 'created by', 'pack name di exif')
  assert.equal(exif['sticker-pack-publisher'], 'alfi', 'publisher di exif')
  assert.ok(/RIFF/.test(buf.slice(0, 4).toString()), 'header webp valid')

  // "!s alfi" versi nyata: publisher benar-benar kosong di exif, bukan ikut default
  let buf2 = await writeExif({ data: img, mimetype: 'image/jpeg', ext: 'jpg' }, { packName: 'alfi', packPublish: '' })
  let m2 = new Image()
  await m2.load(buf2)
  let exif2 = JSON.parse(m2.exif.slice(22).toString())
  assert.equal(exif2['sticker-pack-name'], 'alfi', 'pack name alfi')
  assert.equal(exif2['sticker-pack-publisher'], '', 'publisher kosong saat tanpa pipe')

  // default tanpa args: "Created by" + pushname di baris baru
  let buf3 = await writeExif({ data: img, mimetype: 'image/jpeg', ext: 'jpg' }, { packName: 'Created by', packPublish: 'alfi\n07/10/2026' })
  let m3 = new Image()
  await m3.load(buf3)
  let exif3 = JSON.parse(m3.exif.slice(22).toString())
  assert.equal(exif3['sticker-pack-name'], 'Created by', 'default pack name')
  assert.equal(exif3['sticker-pack-publisher'], 'alfi\n07/10/2026', 'newline ikut tersimpan di exif')

  console.log('✅ parsing pack + exif lulus')
  console.log('   exif:', JSON.stringify(exif))
})().catch(e => { console.error('❌', e.message); process.exit(1) })
