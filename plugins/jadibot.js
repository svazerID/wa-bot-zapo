let jadibot = require('../lib/jadibot')

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let phone = (args[0] || '').replace(/[^0-9]/g, '')
  if (phone.length < 10 || phone.length > 15) {
    return m.reply(`Format: ${usedPrefix}${command} <nomor>\nContoh: ${usedPrefix}${command} 6285815061014\n\nNomor harus format internasional tanpa + (10-15 digit)`)
  }

  let result = await jadibot.createSession({ ownerJid: m.sender, phone })
  if (result.exists) return m.reply('Kamu sudah punya session jadibot aktif.\nUntuk berhenti: *!stopjadibot*')
  if (result.full) return m.reply(`❌ Slot jadibot penuh (maksimal ${result.max} session)`)

  await m.reply([
    `*🤖 JADIBOT*`,
    ``,
    `Membuat session untuk nomor ${phone}...`,
    `Kode pairing akan dikirim ke chat ini. Tunggu sebentar.`
  ].join('\n'))
}
handler.help = ['jadibot <nomor>']
handler.tags = ['jadibot']
handler.command = /^(jadibot)$/i

module.exports = handler
