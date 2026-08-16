// Wrapper pesan 

function extractText(message) {
  // Plain text / formatted text / media captions
  let text =
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    undefined

  // Button clicks — native flow (quick_reply, cta_copy, cta_url)
  if (!text && message?.interactiveResponseMessage) {
    let resp = message.interactiveResponseMessage
    try {
      let params = JSON.parse(resp.nativeFlowResponseMessage?.paramsJson || '{}')
      text = params.id || resp.body?.text || ''
    } catch {
      text = resp.body?.text || ''
    }
  }

  // List selection
  if (!text && message?.listResponseMessage) {
    text = message.listResponseMessage.singleSelectReply?.selectedRowId || message.listResponseMessage.title || ''
  }

  // Legacy template button reply
  if (!text && message?.templateButtonReplyMessage) {
    text = message.templateButtonReplyMessage.selectedId || ''
  }

  // Legacy buttons response
  if (!text && message?.buttonsResponseMessage) {
    text = message.buttonsResponseMessage.selectedId || ''
  }

  return text || undefined
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
  m.isButton = !!(event.message?.interactiveResponseMessage ||
    event.message?.listResponseMessage ||
    event.message?.templateButtonReplyMessage ||
    event.message?.buttonsResponseMessage)
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
