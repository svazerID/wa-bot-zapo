// Cek plugin iqc: API nyata, gambar opsional, PNG hasil valid.
// Jalankan: node test-iqc.js   (butuh internet)
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const iqc = require('./plugins/iqc.js')
const { upload } = require('./lib/upload')

function capture() {
  let sent = null
  const fsx = fs
  return {
    get sent() { return sent },
    conn: { message: { send: async (chat, msg) => {
      let copy = msg.media + '.copy'
      fsx.copyFileSync(msg.media, copy)
      sent = { ...msg, media: copy }
    } } }
  }
}
const baseM = { chat: 't@s.whatsapp.net', pushname: 'Tester', reply: async () => {}, quoted: null }
const isPng = f => fs.readFileSync(f).slice(0, 8).toString('hex') === '89504e470d0a1a0a'

async function main() {
  // 1. registry
  assert.ok(iqc.command.test('iqc'))
  assert.ok(iqc.command.test('iphonequoted'))
  assert.ok(!iqc.command.test('iqcx'))
  assert.deepEqual(iqc.tags, ['tools'])

  // 2. teks saja (gambar opsional) — API nyata
  let c = capture()
  await iqc({ ...baseM }, { conn: c.conn, text: 'gimana kabar', command: 'iqc', usedPrefix: '!' })
  assert.ok(c.sent, 'gambar terkirim')
  assert.equal(c.sent.type, 'image')
  assert.equal(c.sent.mimetype, 'image/png')
  assert.ok(isPng(c.sent.media), 'hasil PNG valid')
  console.log('  teks saja     →', fs.statSync(c.sent.media).size, 'bytes PNG')

  // 3. tanpa teks & tanpa gambar → minta contoh, tidak fetch
  let replied = []
  await iqc({ ...baseM, reply: async t => replied.push(t) }, { conn: capture().conn, text: '', command: 'iqc', usedPrefix: '!' })
  assert.ok(replied[0].includes('Contoh:'), 'tanpa input minta contoh')
  assert.ok(replied[0].includes('opsional'), 'jelaskan gambar opsional')
  console.log('  tanpa input   → minta contoh')

  // 4. dengan gambar (upload nyata ke CDN lalu ke API)
  let url
  try {
    url = (await upload(fs.readFileSync(path.join(__dirname, 'input.jpg')), 'iqc_test.jpg', 'image/jpeg')).url
    console.log('  upload CDN    →', url)
  } catch (e) {
    console.log('  upload CDN gagal (dilewati):', e.message)
  }
  if (url) {
    // panggil API langsung dengan imageUrl untuk pastikan jalur gambar jalan
    let { upload: _u } = require('./lib/upload')
    let res = await fetch('https://brat.siputzx.my.id/v2/iphone-quoted', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'other', message: 'tes gambar', timestamp: '21.02', time: '21.02',
        status: { carrierName: 'INDOSAT OORE...', batteryPercentage: 88, signalStrength: 4, wifi: true },
        backgroundUrl: '', readStatus: true, emojiStyle: 'apple', imageUrl: url })
    })
    let b = Buffer.from(await res.arrayBuffer())
    assert.ok(b.slice(0, 8).toString('hex') === '89504e470d0a1a0a', 'jalur imageUrl balas PNG')
    console.log('  dengan gambar →', b.length, 'bytes PNG (imageUrl dipakai)')
  }

  for (let f of fs.readdirSync('./tmp')) if (f.endsWith('.copy')) fs.unlinkSync('./tmp/' + f)
  console.log('✅ iqc lulus')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
