// Cek plugin translate: API nyata + parsing target bahasa.
// Jalankan: node test-translate.js   (butuh internet)
const assert = require('assert')
const tr = require('./plugins/translate.js')

function capture() {
  let replies = []
  return { replies, conn: { message: { send: async () => {} } } }
}
const m = { chat: 't@s.whatsapp.net', pushname: 'T', reply: async t => capture0.replies.push(t) }
let capture0

async function main() {
  // 1. registry
  assert.ok(tr.command.test('tr'))
  assert.ok(tr.command.test('translate'))
  assert.ok(!tr.command.test('trx'))

  // 2. tanpa teks → contoh, tidak fetch
  capture0 = capture()
  await tr({ ...m, reply: async t => capture0.replies.push(t) }, { conn: capture0.conn, text: '', args: [], usedPrefix: '!', command: 'tr' })
  assert.ok(capture0.replies[0].includes('Contoh:'), 'tanpa teks minta contoh')
  console.log('  tanpa teks  → minta contoh')

  // 3. teks biasa → target id (API nyata)
  capture0 = capture()
  await tr({ ...m }, { conn: capture0.conn, text: 'hello world', args: ['hello', 'world'], usedPrefix: '!', command: 'tr' })
  assert.ok(capture0.replies[0].includes('halo dunia'), 'hello world → halo dunia (target id)')
  assert.ok(capture0.replies[0].includes('en → id'), 'tampilkan arah bahasa')
  console.log('  default id  →', JSON.stringify(capture0.replies[0].split('\n')[2]))

  // 4. target eksplisit: "!tr en selamat pagi"
  capture0 = capture()
  await tr({ ...m }, { conn: capture0.conn, text: 'en selamat pagi', args: ['en', 'selamat', 'pagi'], usedPrefix: '!', command: 'tr' })
  assert.ok(capture0.replies[0].includes('good morning'), 'selamat pagi → good morning (target en)')
  console.log('  target en   →', JSON.stringify(capture0.replies[0].split('\n')[2]))

  // 5. target eksplisit lain: "!tr ja hai" (arah bahasa dari API bisa auto-deteksi)
  capture0 = capture()
  await tr({ ...m }, { conn: capture0.conn, text: 'ja hai', args: ['ja', 'hai'], usedPrefix: '!', command: 'tr' })
  assert.ok(capture0.replies[0].includes('→ ja'), 'target ja dipakai di arah bahasa')
  console.log('  target ja   →', JSON.stringify(capture0.replies[0].split('\n')[2]))

  // 6. reply pesan → translate isi quoted (text kosong tapi ada m.quoted)
  capture0 = capture()
  const mm = {
    chat: 't@s.whatsapp.net', pushname: 'T', reply: async t => capture0.replies.push(t),
    quoted: { message: { conversation: 'good night' }, sender: '628222@s.whatsapp.net' }
  }
  await tr(mm, { conn: capture0.conn, text: '', args: [], usedPrefix: '!', command: 'tr' })
  assert.ok(capture0.replies[0].includes('Selamat malam'), 'quoted "good night" → Selamat malam')
  console.log('  reply teks  →', JSON.stringify(capture0.replies[0].split('\n').pop()))

  console.log('✅ translate lulus')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
