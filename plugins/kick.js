// Normalisasi JID ke bentuk user tanpa device (bandingkan PN vs LID aman di level nomor)
const normalize = jid => (jid || '').split('@')[0].split(':')[0]

let handler = async (m, { conn, args, participants }) => {
  // Target: mention > reply > nomor di args
  let targets = m.mentionedJid.length
    ? [...m.mentionedJid]
    : m.quotedSender ? [m.quotedSender] : []
  if (!targets.length) {
    let num = (args[0] || '').replace(/[^0-9]/g, '')
    if (num.length >= 10) targets = [num + '@s.whatsapp.net']
  }
  if (!targets.length) {
    return m.reply('Tag, reply, atau tulis nomor member yang mau di-kick.\nContoh: !kick @628xxx')
  }

  // Proteksi: jangan kick bot sendiri & owner
  let me = normalize(conn.getCredentials()?.meJid)
  let owners = global.owner.map(normalize)
  let valid = []
  for (let t of targets) {
    let n = normalize(t)
    if (n === me) { await m.reply('❌ Tidak bisa kick bot sendiri.'); continue }
    if (owners.includes(n)) { await m.reply('❌ Tidak bisa kick owner bot.'); continue }
    valid.push(t)
  }
  if (!valid.length) return

  await m.reply(`⏳ Mengkick ${valid.length} member...`)
  try {
    let results = await conn.group.removeParticipants(m.chat, valid)
    let ok = results.filter(r => r.status === 'ok')
    let fail = results.filter(r => r.status !== 'ok')
    let lines = []
    if (ok.length) lines.push(`✅ Berhasil kick ${ok.length} member`)
    for (let f of fail) lines.push(`❌ Gagal: @${normalize(f.jid)} (code ${f.code})`)
    await conn.message.send(m.chat, lines.join('\n'), {
      quote: m,
      mentions: fail.map(f => f.jid)
    })
  } catch (e) {
    m.reply('❌ Gagal kick: ' + (e.message || e)).catch(() => {})
  }
}
handler.help = ['kick @tag']
handler.tags = ['admin']
handler.command = /^(kick|tendang)$/i
handler.group = true
handler.admin = true
handler.botAdmin = true
handler.participants = true

module.exports = handler
