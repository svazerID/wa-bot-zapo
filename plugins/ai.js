const https = require('https')

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 60000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

let handler = async (m, { conn, args, text, command }) => {
  if (!text) return m.reply(`Gunakan: *${command} <pesan>*\n\nContoh: ${command} hai, apa kabar?`)

  let user = global.db.data.users[m.sender]
  if (!user) global.db.data.users[m.sender] = user = {}
  let sessions = user.aiSession || {}
  let model = 'anthropic/claude-opus-4.8'

  await conn.message.send(m.chat, { type: 'text', text: '...' }, { quote: m })

  try {
    let url = new URL('https://api.alfisy.my.id/api/ai/claude-chat')
    url.searchParams.set('prompt', text)
    url.searchParams.set('model', model)
    if (sessions[model]) {
      url.searchParams.set('session', sessions[model])
    }

    let raw = await httpGet(url.toString())
    let data
    try { data = JSON.parse(raw) } catch (e) { return m.reply('❌ API response bukan JSON.') }

    if (!data.status || !data.result?.text) {
      let errMsg = data.message || JSON.stringify(data).substring(0, 200)
      return m.reply('❌ AI gagal: ' + errMsg)
    }

    if (data.session) {
      sessions[model] = data.session
      user.aiSession = sessions
    }

    let reply = formatWhatsApp(data.result.text)
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

handler.help = ['ai', 'claude'].map(v => v + ' <pesan>')
handler.tags = ['ai']
handler.command = /^(ai|claude|bot)$/i

module.exports = handler
