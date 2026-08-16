let handler = async (m, { conn }) => {
  await m.reply('pong 🏓')
}
handler.help = ['ping']
handler.tags = ['main']
handler.command = /^(ping)$/i

module.exports = handler
