const fs = require('node:fs')
const path = require('node:path')
const { downloadMedia } = require('../lib/mediaProcessor')

const MEDIA_DIR = path.join(__dirname, '..', 'data', 'list-store-media')
fs.mkdirSync(MEDIA_DIR, { recursive: true })
const MAX_NAME = 50
const MAX_MEDIA_BYTES = 20 * 1024 * 1024
const MAX_PER_GROUP = 200
const COOLDOWN_MS = 3000
const cooldown = new Map()

function normName(s) {
  s = String(s || '').trim().toLowerCase()
  return s && s.length <= MAX_NAME && !/^[!/#.]/.test(s) ? s : null
}
function dbEntries(chat) {
  let settings = global.db.data.settings || (global.db.data.settings = {})
  let key = `liststore:${chat}`
  return (settings[key] || (settings[key] = { entries: {} })).entries || (settings[key].entries = {})
}
function isAdmin(p, jid) {
  let n = x => String(x || '').split('@')[0].split(':')[0]
  return p && [p.jid, p.phoneNumber, p.lid].some(x => x && n(x) === n(jid)) && (p.isAdmin || p.admin || p.isSuperAdmin)
}
function fileFor(chat, name) { return path.join(MEDIA_DIR, `${Buffer.from(`${chat}\\0${name}`).toString('hex')}.${process.pid}.${Date.now()}`) }
function unwrap(msg) {
  let m = msg?.message
  for (let i = 0; m && i < 3; i++) {
    if (m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension) return { unsupportedViewOnce: true }
    let inner = m.ephemeralMessage?.message
    if (!inner) break
    m = inner
  }
  return m
}
function classify(msg) {
  let m = unwrap(msg)
  if (!m || m.unsupportedViewOnce) return null
  if (m.imageMessage?.viewOnce || m.videoMessage?.viewOnce || m.audioMessage?.viewOnce) return null
  if (m.conversation || m.extendedTextMessage?.text) return { type:'text', text:m.conversation || m.extendedTextMessage.text }
  for (let type of ['image','video','sticker','audio','document']) {
    let data = m[`${type}Message`]
    if (data) return { type, data }
  }
  if (m.contactMessage || m.contactMessageV2) {
    let c = m.contactMessage || m.contactMessageV2
    return { type:'contact', content:{ displayName:c.displayName, vcard:c.vcard } }
  }
  if (m.locationMessage || m.liveLocationMessage) {
    let l = m.locationMessage || m.liveLocationMessage
    return { type:'location', content:Object.fromEntries(['degreesLatitude','degreesLongitude','name','address','comment','accuracyInMeters'].filter(k => l[k] !== undefined).map(k => [k,l[k]])) }
  }
  return null
}
function mime(type) { return ({ image:'image/jpeg', video:'video/mp4', sticker:'image/webp', audio:'audio/ogg; codecs=opus', document:'application/octet-stream' })[type] }
async function snapshot(msg, chat, name) {
  let item = classify(msg)
  if (!item) throw new Error('Tipe pesan tidak didukung atau pesan tidak ada di reply.')
  if (item.data?.ptt || item.data?.viewOnce) throw new Error('Voice note atau pesan sekali lihat tidak didukung.')
  let out = { type:item.type, text:item.text, content:item.content, caption:item.data?.caption || '', mimetype:item.data?.mimetype || mime(item.type), fileName:item.data?.fileName || '', addedBy:msg.sender || '', createdAt:Date.now() }
  if (item.data) {
    let buffer
    try { buffer = await downloadMedia(msg.message) }
    catch (e) { throw new Error(`Gagal unduh media reply: ${e.message || e}`) }
    if (!buffer?.length) throw new Error('Gagal mengunduh media.')
    if (buffer.length > MAX_MEDIA_BYTES) throw new Error('Media terlalu besar (maks. 20 MB).')
    out.mediaRef = fileFor(chat, name)
    try { fs.writeFileSync(out.mediaRef, buffer, { flag:'wx' }) }
    catch (e) { if (e.code !== 'EEXIST') throw e; out.mediaRef = `${out.mediaRef}.${Date.now()}`; fs.writeFileSync(out.mediaRef, buffer, { flag:'wx' }) }
  }
  return out
}
async function sendEntry(conn, chat, payload, quote) {
  let options = quote?.key ? { quote } : {}
  if (payload.type === 'text') return conn.message.send(chat, { type:'text', text:payload.text || '', contextInfo:{ isForwarded:true, forwardingScore:1 } }, options)
  if (payload.type === 'contact') return conn.message.send(chat, { contactMessage:payload.content }, options)
  if (payload.type === 'location') return conn.message.send(chat, { locationMessage:payload.content }, options)
  return conn.message.send(chat, { type:payload.type, media:payload.mediaRef, mimetype:payload.mimetype || mime(payload.type), caption:payload.caption || undefined, fileName:payload.fileName || undefined }, options)
}
function greet() {
  let h = +new Intl.DateTimeFormat('en', { timeZone:'Asia/Jakarta', hour:'2-digit', hourCycle:'h23' }).format(new Date())
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
}
function unlink(entry) { if (entry?.mediaRef) try { fs.unlinkSync(entry.mediaRef) } catch {} }

module.exports = {
  name:'liststore', description:'Simpan dan panggil ulang pesan bernama di grup.',
  aliases:['addmsg','updatemsg','delmsg','listmsg'], tags:['group'],
  permissions:{ groupOnly:true }, command:/^(addmsg|updatemsg|delmsg|listmsg)$/i,
  run: async (m, { conn, command, text, participants, usedPrefix }) => {
    if (!m.isGroup) return m.reply('❌ Fitur ini hanya bisa dipakai di grup.')
    let cmd = command.toLowerCase(), entries = dbEntries(m.chat)
    if (cmd === 'listmsg') {
      if (!participants?.some(p => isAdmin(p, m.sender))) return m.reply('❌ Perintah ini hanya untuk admin grup.')
      let names = Object.keys(entries).sort((a,b) => a.localeCompare(b))
      if (!names.length) return m.reply('Belum ada pesan tersimpan di grup ini.')
      let sender = String(m.sender).split('@')[0]
      return conn.message.send(m.chat, { type:'text', text:`📋 *List Store*\n${greet()}, @${sender}\n\n${names.map(n => `• ${n}`).join('\n')}` }, { quote:m, mentions:[m.sender] })
    }
    let raw = String(text || '').trim(), name = normName(raw)
    if (!name || raw.length > MAX_NAME) return m.reply(`Nama wajib diisi, maks. ${MAX_NAME} karakter, dan tidak boleh diawali prefix command.`)
    if (!participants?.some(p => isAdmin(p, m.sender))) return m.reply('❌ Perintah ini hanya untuk admin grup.')
    let old = entries[name]
    if (cmd === 'addmsg' && old) return m.reply('❌ Nama itu sudah ada. Gunakan updatemsg untuk mengganti.')
    if (cmd === 'updatemsg' && !old) return m.reply('❌ Nama itu belum ada. Gunakan addmsg untuk menyimpan baru.')
    if (cmd === 'delmsg') {
      if (!old) return m.reply('❌ Nama itu tidak ditemukan.')
      unlink(old); delete entries[name]; global.db.write()
      return m.reply(`✅ Pesan *${name}* dihapus.`)
    }
    if (!m.quoted) return m.reply(`Reply pesan yang akan disimpan, lalu ketik *${usedPrefix}${cmd} ${name}*.`)
    if (cmd === 'addmsg' && Object.keys(entries).length >= MAX_PER_GROUP) return m.reply(`❌ Maksimal ${MAX_PER_GROUP} entri per grup.`)
    try {
      let entry = await snapshot(m.quoted, m.chat, name)
      entries[name] = entry
      global.db.write()
      unlink(old)
      return m.reply(`✅ Pesan *${name}* ${cmd === 'addmsg' ? 'disimpan' : 'diperbarui'}.`)
    } catch (e) { return m.reply(`❌ Gagal menyimpan: ${e.message || e}`) }
  },
  autoReply: async (m, conn) => {
    if (!m.isGroup || m.fromMe || !m.text) return false
    let name = normName(m.text), entries = dbEntries(m.chat), payload = name && entries[name]
    if (!payload) return false
    let key = `${m.chat}:${name}:${m.sender}`, now = Date.now()
    if (now - (cooldown.get(key) || 0) < COOLDOWN_MS) return false
    cooldown.set(key, now)
    try { await sendEntry(conn, m.chat, payload, m); return true }
    catch (e) { console.error('[liststore] gagal kirim:', e.message || e); return false }
  }
}
