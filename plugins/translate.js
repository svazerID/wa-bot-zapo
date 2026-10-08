const API = 'https://api.alfisy.my.id/api/tools/translate'

// Translate teks. Target default id; "!tr en halo" ganti target bahasa.
async function translate(text, target = 'id') {
  let url = `${API}?text=${encodeURIComponent(text)}&target=${encodeURIComponent(target)}`
  let res = await fetch(url)
  let data = await res.json()
  if (!data.success) throw new Error(data.error || 'translate gagal')
  return data
}

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  // Tanpa teks → translate isi pesan yang di-reply (kalau ada)
  if (!text && m.quoted) {
    text = (m.quoted.message?.conversation ??
      m.quoted.message?.extendedTextMessage?.text ??
      m.quoted.message?.imageMessage?.caption ?? '').trim()
  }
  if (!text) {
    return m.reply(`Contoh: ${usedPrefix}${command} hello world\n` +
      `Ganti bahasa target: ${usedPrefix}${command} en selamat pagi\n` +
      `Atau reply pesan dengan *${usedPrefix}${command}*`)
  }

  // "!tr en halo" → target=en, sisanya teks. Kata pertama yang panjangnya 2
  // dan cuma huruf dianggap kode bahasa.
  let target = 'id', teks = text
  let first = args[0] || ''
  if (/^[a-z]{2}$/i.test(first) && args.length > 1) {
    target = first.toLowerCase()
    teks = text.slice(first.length).trim()
  }

  let data
  try {
    data = await translate(teks, target)
  } catch (e) {
    return m.reply('❌ Gagal translate: ' + (e.message || e))
  }

  await m.reply(
    `*🌐 Translate* (${data.sourceLanguage} → ${data.targetLanguage})\n\n` +
    `${data.translatedText}`
  )
}

module.exports = handler

handler.description = "Translate teks ke bahasa lain (default: Indonesia)."
handler.help = ['tr <teks>', 'tr <kode> <teks>']
handler.tags = ['tools']
handler.command = /^(tr|translate)$/i
