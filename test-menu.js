// Cek menu dengan link preview: content terbentuk benar + fallback tanpa thumb.
// Jalankan: node test-menu.js
const assert = require('assert')
const fs = require('fs')

global.plugins = {
  'a.js': { names: ['menu', 'help'], tags: ['info'], description: 'Menu utama.' },
  'b.js': { names: ['sticker', 's', 'swm'], tags: ['tools'], description: 'Buat sticker.' },
  'c.js': { names: ['tr', 'translate'], tags: ['tools'], description: 'Translate.' },
  'd.js': { names: [], tags: ['info'], description: 'tanpa names — harus di-skip' }
}
global.packname = 'wa-bot-zapo'
const menu = require('./plugins/menu.js')

async function main() {
  let sent = null
  const conn = { message: { send: async (chat, content, opts) => { sent = { chat, content, opts } } } }
  const m = { chat: 't@s.whatsapp.net', reply: async () => {} }

  // 1. dengan thumbnail ada (input.jpg ada di root project)
  await menu.run(m, { conn, usedPrefix: '!' })
  assert.ok(sent, 'pesan terkirim')
  assert.equal(sent.content.type, 'text')
  // URL di depan, sisanya ZWSP + menu → link "invisible"
  assert.ok(sent.content.text.startsWith('https://github.com/himanackerman'), 'URL di awal teks')
  assert.ok(sent.content.text.includes('\u200B'.repeat(400)), '400 zero-width space')
  assert.ok(sent.content.text.includes('*wa-bot-zapo*'), 'judul pack')
  assert.ok(sent.content.text.includes('!sticker | s | swm'), 'alias digabung')
  assert.ok(sent.content.text.includes('> Buat sticker.'), 'description ada')
  assert.ok(sent.content.text.includes('Total: 7 perintah'), 'total dihitung dari names (2+3+2)')
  // linkPreview override
  assert.ok(sent.content.linkPreview, 'linkPreview override ada')
  assert.equal(sent.content.linkPreview.matchedText, 'https://github.com/himanackerman')
  assert.equal(sent.content.linkPreview.title, 'wa-bot-zapo')
  assert.ok(sent.content.linkPreview.thumbnail.bytes instanceof Uint8Array, 'thumbnail bytes')
  assert.ok(sent.content.linkPreview.thumbnail.bytes.byteLength <= 64 * 1024, 'thumbnail <= 64KB inline limit')
  assert.equal(sent.content.linkPreview.thumbnail.width, 1280)
  assert.equal(sent.content.linkPreview.thumbnail.height, 720)
  assert.ok(sent.opts.quote === m, 'quote m')
  console.log('  dengan thumb →', sent.content.linkPreview.thumbnail.bytes.byteLength, 'bytes thumbnail')

  // 2. thumbnail tidak ada → teks polos tanpa linkPreview
  fs.renameSync('./input.jpg', './input.jpg.bak')
  try {
    sent = null
    await menu.run(m, { conn, usedPrefix: '!' })
    assert.ok(sent, 'pesan terkirim (fallback)')
    assert.equal(sent.content.linkPreview, undefined, 'tanpa thumb → tanpa linkPreview')
    assert.ok(sent.content.text.includes('*wa-bot-zapo*'), 'teks tetap utuh')
    console.log('  tanpa thumb  → teks polos, tanpa linkPreview')
  } finally {
    fs.renameSync('./input.jpg.bak', './input.jpg')
  }

  console.log('✅ menu lulus')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
