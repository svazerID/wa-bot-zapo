let handler = async (m, { conn, usedPrefix, command }) => {
  await m.reply('⏳ Mengambil daftar grup...')

  let groups
  try {
    groups = await conn.group.queryAllGroups()
  } catch (e) {
    return m.reply('❌ Gagal ambil daftar grup: ' + (e.message || e))
  }
  if (!groups?.length) return m.reply('❌ Bot tidak mengikuti grup apa pun.')

  // Urut by jumlah member, terbesar dulu (yang besar biasanya yang aktif).
  let list = [...groups].sort((a, b) => (b.size || b.participants?.length || 0) - (a.size || a.participants?.length || 0))
  let max = Math.min(list.length, 10)

  let lines = [`*📋 Grup yang Diikuti Bot* (${list.length} total)`, '']
  for (let i = 0; i < max; i++) {
    let g = list[i]
    let jumlah = g.size ?? g.participants?.length ?? 0
    lines.push(`${i + 1}. *${g.subject || 'tanpa nama'}*`)
    lines.push(`   🆔 ${g.jid}`)
    lines.push(`   👥 ${jumlah} member`)
    // Link invite bisa gagal kalau bot bukan admin atau grup batasi link.
    try {
      let code = await conn.group.queryInviteCode(g.jid)
      if (code) lines.push(`   🔗 https://chat.whatsapp.com/${code}`)
    } catch {
      lines.push('   🔗 (link tidak tersedia)')
    }
  }
  if (list.length > max) lines.push('', `…dan ${list.length - max} grup lainnya.`)

  await m.reply(lines.join('\n'))
}

handler.description = "Daftar grup yang diikuti bot + link invite tiap grup."
handler.help = ['listgrup']
handler.tags = ['group']
handler.command = /^(listgrup|listgroup|grouplist|gclist)$/i
// Owner-only: output memuat link invite SEMUA grup. Hapus baris ini kalau
// memang mau dibuka publik.
handler.owner = true

module.exports = handler
