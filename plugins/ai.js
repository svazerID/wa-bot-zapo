const API_URL = 'https://ai.alfisy.my.id/api/chat'
const MODEL = 'mistral-agent'

let handler = async (m, { conn, args, text, command }) => {
  if (!text) return m.reply(`Gunakan: *${command} <pesan>*\n\nContoh: ${command} hai, apa kabar?`)

  let user = global.db.data.users[m.sender]
  if (!user) global.db.data.users[m.sender] = user = {}
  let sessions = user.aiSession || {}
  let model = MODEL

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ message: text, model, ...(sessions[model] ? { sessionId: sessions[model] } : {}) }),
      signal: AbortSignal.timeout(60000)
    })
    const data = await response.json()

    if (!response.ok || !data.reply) {
      return m.reply('❌ AI gagal: ' + (data.error || data.message || `HTTP ${response.status}`))
    }

    if (data.sessionId) {
      sessions[model] = data.sessionId
      user.aiSession = sessions
    }

    let reply = formatWhatsApp(data.reply)
    await m.reply(reply)
  } catch (e) {
    await m.reply('❌ Error: ' + (e.message || e))
  }
}

function formatWhatsApp(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*')
  text = text.replace(/~~(.+?)~~/g, '~$1~')
  return text
}

handler.description = "Tanya AI (Claude/GPT) dan balas jawabannya di chat."
handler.help = ['ai', 'claude'].map(v => v + ' <pesan>')
handler.tags = ['ai']
handler.command = /^(ai|claude|bot)$/i

module.exports = handler
