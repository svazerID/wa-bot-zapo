let jadibot = require('../lib/jadibot')

let handler = async (m) => {
  let result = await jadibot.stopSession(m.sender)
  if (!result.exists) return m.reply('Kamu tidak punya session jadibot aktif.')
  await m.reply('✅ Session jadibot dihentikan dan dihapus.')
}
handler.help = ['stopjadibot']
handler.tags = ['jadibot']
handler.command = /^(stopjadibot)$/i

module.exports = handler
