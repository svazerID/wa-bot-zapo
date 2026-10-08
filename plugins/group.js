let handler = async (m, { conn, command }) => {
  // 'announcement' = true → hanya admin yang bisa kirim pesan (tutup grup).
  let tutup = /^(tutup|close)$/i.test(command)
  try {
    await conn.group.setSetting(m.chat, 'announcement', tutup)
  } catch (e) {
    return m.reply('❌ Gagal: ' + (e.message || e))
  }
  await m.reply(tutup
    ? '🔒 Grup *ditutup*. Hanya admin yang bisa mengirim pesan.'
    : '🔓 Grup *dibuka*. Semua member bisa mengirim pesan.')
}

handler.description = "Buka grup (semua member bisa kirim) atau tutup grup (hanya admin)."
handler.help = ['buka', 'tutup']
handler.tags = ['group']
handler.command = /^(buka|open|tutup|close)$/i
handler.group = true
handler.admin = true
handler.botAdmin = true

module.exports = handler
