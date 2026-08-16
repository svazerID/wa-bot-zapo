let handler = async (m, { conn }) => {
  let contacts = global.owner.map(v => ({
    displayName: 'Owner',
    vcard: [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;Owner;;;',
      'FN:Owner',
      `item1.TEL;waid=${v}:${v}`,
      'item1.X-ABLabel:Ponsel',
      'END:VCARD'
    ].join('\n')
  }))
  await conn.message.send(m.chat, {
    contactsArrayMessage: {
      displayName: `${contacts.length} Kontak`,
      contacts
    }
  }, { quote: m })
}
handler.help = ['owner', 'creator']
handler.tags = ['info']
handler.command = /^(owner|creator)$/i

module.exports = handler
