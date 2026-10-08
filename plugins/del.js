let handler = async (m, { conn }) => {
  if (!m.quoted) return m.reply('Reply pesan yang mau dihapus dengan *!del*.')

  // Key pesan target: stanzaId dari contextInfo + participant (siapa pengirimnya).
  let ctx = m.quotedCtx
  if (!ctx?.stanzaId) return m.reply('❌ Tidak bisa baca ID pesan yang di-reply.')

  let target = {
    remoteJid: ctx.remoteJid || m.chat,
    id: ctx.stanzaId,
    fromMe: false
  }
  // Di grup, revoke butuh participant (pengirim pesan aslinya).
  if (ctx.participant) target.participant = ctx.participant

  try {
    await conn.message.send(m.chat, { type: 'revoke', target }, { quote: m })
  } catch (e) {
    return m.reply('❌ Gagal hapus: ' + (e.message || e))
  }
}

handler.description = "Hapus pesan yang di-reply (untuk semua orang, seperti delete for everyone)."
handler.help = ['del']
handler.tags = ['group']
handler.command = /^(del|delete|hapus)$/i
handler.group = true
handler.admin = true
handler.botAdmin = true

module.exports = handler
