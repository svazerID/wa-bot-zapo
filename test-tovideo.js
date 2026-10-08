// Cek !tovideo: sticker animasi (webp ANIM) → mp4; sticker statis → ditolak.
// Jalankan: node test-tovideo.js   (butuh internet)
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { webpAnimToMp4 } = require('./lib/webpAnim')

async function bratAnim(text) {
  let url = `https://brat.siputzx.my.id/mp4?text=${encodeURIComponent(text)}` +
    `&background=%23ffffff&color=%23000000&blur=2&emojiStyle=apple&delay=500&endDelay=1000`
  return Buffer.from(await fetch(url).then(r => r.arrayBuffer()))
}

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

async function main() {
  // 1. registry
  const base = require('./plugins/sticker.js')
  assert.ok(base.command.test('tovideo'), 'tovideo dikenali')
  assert.ok(base.command.test('tovid'), 'tovid dikenali')
  assert.ok(base.command.test('tomp4'), 'tomp4 dikenali')
  // 2. konverter langsung: animasi → mp4
  let webp = await bratAnim('hai kamu apa kabar')
  assert.ok(webp.slice(0, 64).toString('latin1').includes('ANIM'), 'sumber webp animasi')
  let mp4 = await webpAnimToMp4(webp)
  assert.ok(mp4, 'animasi menghasilkan mp4')
  assert.equal(mp4.slice(4, 8).toString(), 'ftyp', 'mp4 punya ftyp box')
  console.log('  konverter   →', mp4.length, 'bytes mp4')

  // 3. webp statis → null (bukan animasi)
  let statis = Buffer.from(await fetch('https://brat.siputzx.my.id/image?text=hi&background=%23ffffff&color=%23000000&blur=2&emojiStyle=apple').then(r => r.arrayBuffer()))
  assert.equal(await webpAnimToMp4(statis), null, 'PNG statis → null')

  // 4. lewat handler: sticker animasi → video terkirim.
  //    handler memanggil downloadMedia() dari modul; stub lewat cache modul
  //    SEBELUM sticker.js require, jadi urutannya penting: reload sticker.js
  //    setelah stub dipasang.
  const { writeExif } = require('./lib/exif')
  let stickerWebp = await writeExif({ data: webp, mimetype: 'image/webp', ext: 'webp' }, { packName: 'x', packPublish: 'y' })
  assert.ok(stickerWebp.slice(0, 64).toString('latin1').includes('ANIM'), 'sticker hasil masih animasi')

  const mp = require('./lib/mediaProcessor')
  const origDownload = mp.downloadMedia
  mp.downloadMedia = async () => stickerWebp
  delete require.cache[require.resolve('./plugins/sticker.js')]
  const sticker2 = require('./plugins/sticker.js')

  let c = capture()
  let replied = []
  const m = {
    chat: 't@s.whatsapp.net', pushname: 'T', reply: async t => replied.push(t),
    quoted: { message: { stickerMessage: { mimetype: 'image/webp' } } }
  }
  try {
    await sticker2(m, { conn: c.conn, command: 'tovideo', usedPrefix: '!', args: [], text: '' })
  } finally {
    mp.downloadMedia = origDownload
    delete require.cache[require.resolve('./plugins/sticker.js')]
  }
  assert.ok(c.sent, 'video terkirim')
  assert.equal(c.sent.type, 'video', 'tipe video')
  assert.equal(c.sent.mimetype, 'video/mp4')
  let out = fs.readFileSync(c.sent.media)
  assert.equal(out.slice(4, 8).toString(), 'ftyp', 'hasil video valid')
  console.log('  handler     →', out.length, 'bytes video terkirim')

  // 5. bukan reply → minta reply
  replied = []
  await require('./plugins/sticker.js')({ ...m, quoted: null }, { conn: c.conn, command: 'tovideo', usedPrefix: '!', args: [], text: '' })
  assert.ok(replied[0].includes('Reply'), 'tanpa reply minta reply')
  console.log('  tanpa reply → minta reply sticker')

  for (let f of fs.readdirSync('./tmp')) if (f.endsWith('.copy')) fs.unlinkSync('./tmp/' + f)
  console.log('✅ tovideo lulus')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
