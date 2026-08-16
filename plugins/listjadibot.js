let jadibot = require('../lib/jadibot')

let handler = async (m) => {
  let list = jadibot.listSessions()
  if (!list.length) return m.reply('Tidak ada session jadibot aktif.')
  let lines = ['*🤖 DAFTAR JADIBOT*', '']
  for (let s of list) {
    lines.push(`• ${s.phone} — ${s.status}`)
  }
  lines.push('', `Total: ${list.length} session`)
  await m.reply(lines.join('\n'))
}
handler.help = ['listjadibot']
handler.tags = ['jadibot']
handler.command = /^(listjadibot)$/i
handler.owner = true

module.exports = handler
