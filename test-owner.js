// Cek: sender LID bisa di-resolve ke nomor owner lewat lidCache yang diisi smsg().
// Jalankan: node test-owner.js
const assert = require('assert')
const { smsg } = require('./lib/simple')

const OWNER = '62895615063060'
global.owner = [OWNER]
global.lidCache = {}

const client = { message: { send: () => {} } }
// event tiruan seperti yang dikirim zapo-js
const mkEvent = key => ({ key, message: { conversation: '!ping' } })

const normalize = jid => (jid || '').split('@')[0].split(':')[0]
const isOwner = m => {
  let num = normalize(m.sender)
  return m.fromMe || global.owner.some(o => normalize(o) === (global.lidCache[num] || num))
}

// 1. Grup: participant = LID, participantAlt = PN
let m = smsg(client, mkEvent({
  remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false,
  participant: '110969237823648:12@lid', participantAlt: `${OWNER}@s.whatsapp.net`
}))
assert.equal(isOwner(m), true, 'grup: participant LID + participantAlt PN')
assert.equal(global.lidCache['110969237823648'], OWNER, 'lidCache terisi')

// 2. Grup kebalikannya: participant = PN, participantAlt = LID
global.lidCache = {}
m = smsg(client, mkEvent({
  remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false,
  participant: `${OWNER}@s.whatsapp.net`, participantAlt: '110969237823648@lid'
}))
assert.equal(isOwner(m), true, 'grup: participant PN + participantAlt LID')

// 3. DM: sender = LID, remoteJidAlt = PN
global.lidCache = {}
m = smsg(client, mkEvent({
  remoteJid: '110969237823648@lid', isGroup: false, fromMe: false,
  remoteJidAlt: `${OWNER}@s.whatsapp.net`
}))
assert.equal(isOwner(m), true, 'DM: sender LID + remoteJidAlt PN')

// 4. Bukan owner — jangan sampai lolos
global.lidCache = {}
m = smsg(client, mkEvent({
  remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false,
  participant: '999999999999999@lid', participantAlt: '62899999999999@s.whatsapp.net'
}))
assert.equal(isOwner(m), false, 'LID orang lain bukan owner')

// 5. Tanpa alt sama sekali — tidak crash, perilaku lama
global.lidCache = {}
m = smsg(client, mkEvent({
  remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false,
  participant: `${OWNER}@s.whatsapp.net`
}))
assert.equal(isOwner(m), true, 'PN langsung, tanpa alt')

// 6. Pesan dari bot sendiri tetap owner
global.lidCache = {}
m = smsg(client, mkEvent({
  remoteJid: '110969237823648@lid', isGroup: false, fromMe: true
}))
assert.equal(isOwner(m), true, 'fromMe')

// 7. Nilai lidCache tidak boleh ketimpa PN jadi LID (arah salah)
global.lidCache = {}
smsg(client, mkEvent({
  remoteJid: '120363207338528857@g.us', isGroup: true, fromMe: false,
  participant: `${OWNER}@s.whatsapp.net`, participantAlt: '110969237823648@lid'
}))
assert.equal(global.lidCache[OWNER], undefined, 'nomor HP tidak dijadikan key lid')

console.log('✅ semua cek owner lulus')
