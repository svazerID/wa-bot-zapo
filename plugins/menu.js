let handler = async (m, { conn, usedPrefix }) => {
  let byTag = {}
  for (let name of Object.keys(global.plugins).sort()) {
    let p = global.plugins[name]
    if (!p?.help || !p?.tags) continue
    for (let tag of p.tags) (byTag[tag] ??= []).push(...p.help)
  }
  let lines = [`*${global.packname}* by ${global.author}`, '']
  for (let [tag, cmds] of Object.entries(byTag)) {
    lines.push(`── *${tag.toUpperCase()}* ──`)
    for (let cmd of cmds) lines.push(`• ${usedPrefix}${cmd}`)
    lines.push('')
  }
  lines.push(`Total: ${Object.values(byTag).flat().length} perintah`)
  await m.reply(lines.join('\n'))
}
handler.help = ['menu', 'help']
handler.tags = ['main']
handler.command = /^(menu|help)$/i

module.exports = handler
