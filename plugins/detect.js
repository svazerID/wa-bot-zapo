let ge = require('../lib/groupEvents')

let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
  // Hanya di grup (owner bot bypass)
  if (!m.isGroup && !isOwner) return m.reply('Hanya bisa di grup.')
  let groupJid = m.chat
  let cfg = ge.getConfig(groupJid)
  let sub = (args[0] || '').toLowerCase()

  if (command === 'detect') {
    if (sub === 'on' || sub === 'off') {
      cfg.detect = sub === 'on'
      global.db.write()
      return m.reply(cfg.detect
        ? '✅ Deteksi event grup *diaktifkan*.'
        : '🔕 Deteksi event grup *dimatikan*.')
    }
    // status (default)
    let lines = ['*📡 Event Grup*', `Master: ${cfg.detect ? 'ON ✅' : 'OFF 🔕'}`, '']
    for (let e of ge.EVENTS) {
      lines.push(`• ${e} — ${cfg.events[e].on ? 'on' : 'off'}${cfg.events[e].text ? ' (teks custom)' : ''}`)
    }
    lines.push('', `Ubah: *${usedPrefix}detect on|off* · *${usedPrefix}set <event> on|off|reset|text <teks>>*`)
    return m.reply(lines.join('\n'))
  }

  // --- set ---
  let ev = (args[0] || '').toLowerCase()
  if (!ge.EVENTS.includes(ev)) {
    return m.reply(`Event valid: ${ge.EVENTS.join(', ')}\nContoh: *${usedPrefix}set welcome off*`)
  }
  let aksi = (args[1] || '').toLowerCase()

  if (aksi === 'on' || aksi === 'off') {
    cfg.events[ev].on = aksi === 'on'
    global.db.write()
    return m.reply(`✅ Event *${ev}* ${cfg.events[ev].on ? 'diaktifkan' : 'dimatikan'}.`)
  }

  if (aksi === 'reset') {
    cfg.events[ev].text = null
    global.db.write()
    return m.reply(`♻️ Teks *${ev}* kembali ke default.`)
  }

  if (aksi === 'text') {
    let teks = args.slice(2).join(' ').trim()
    if (!teks) return m.reply(`Contoh: *${usedPrefix}set welcome text Selamat datang @user*`)
    if (teks.length > ge.MAX_TEXT) return m.reply(`❌ Teks maksimal ${ge.MAX_TEXT} karakter.`)
    cfg.events[ev].text = teks
    global.db.write()
    return m.reply(`✅ Teks *${ev}* disimpan.`)
  }

  return m.reply(`Aksi: on | off | reset | text <teks>\nContoh: *${usedPrefix}set welcome text Selamat datang @user*`)
}

handler.description = "Atur notifikasi event grup (welcome, goodbye, promote, demote, desc, subject, icon, revoke)."
handler.help = ['detect on|off|status', 'set <event> on|off|reset|text <teks>']
handler.tags = ['group']
handler.command = /^(detect|set)$/i

module.exports = handler
