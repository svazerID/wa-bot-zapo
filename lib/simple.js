// Wrapper pesan 

function extractText(message) {
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    undefined
  )
}

/**
 * Hiasi event message zapo jadi objek m.
 * @param {import('zapo-js').WaClient} client
 * @param {object} event WaIncomingMessageEvent
 */
function smsg(client, event) {
  let m = event
  m.chat = event.key.remoteJid
  m.sender = event.key.participant ?? event.key.remoteJid
  m.fromMe = event.key.fromMe
  m.isGroup = event.key.isGroup ?? m.chat.endsWith('@g.us')
  m.text = extractText(event.message) ?? ''
  m.mentionedJid = event.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []
  m.quotedSender = event.message?.extendedTextMessage?.contextInfo?.participant ?? null
  let ctxInfo = event.message?.extendedTextMessage?.contextInfo
  m.quoted = ctxInfo?.quotedMessage
    ? { message: ctxInfo.quotedMessage, sender: ctxInfo.participant }
    : null
  m.reply = (text, opts = {}) =>
    client.message.send(m.chat, text, { quote: event, ...opts })
  return m
}

module.exports = { smsg, extractText }
