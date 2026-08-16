let handler = async (m, { conn, command }) => {
  let meJid = conn.getCredentials()?.meJid || ''
  let setting = global.db.data.settings[meJid]
  if (typeof setting !== 'object') global.db.data.settings[meJid] = setting = {}

  if (/^self$/i.test(command)) {
    setting.self = true
    return m.reply('✅ Mode *Self* diaktifkan. Bot hanya merespon owner.')
  }

  if (/^public$/i.test(command)) {
    setting.self = false
    return m.reply('✅ Mode *Public* diaktifkan. Bot merespon semua orang.')
  }
}

handler.help = ['self', 'public']
handler.tags = ['owner']
handler.command = /^(self|public)$/i
handler.owner = true

module.exports = handler
