module.exports = {
    name: 'menu',
    description: 'Tampilkan semua perintah yang tersedia.',
    aliases: ['help'],
    tags: ['main'],
    permissions: {},
    command: /^(menu|help)$/i,
    run: async (m, { conn, usedPrefix }) => {
        let byTag = {}
        for (let name of Object.keys(global.plugins).sort()) {
            let p = global.plugins[name]
            if (!p.tags?.length || !p.names?.length) continue
            for (let tag of p.tags) (byTag[tag] ??= []).push(...p.names)
        }
        let lines = [`*${global.packname || 'Bot'}*`, '']
        for (let [tag, cmds] of Object.entries(byTag)) {
            lines.push(`── *${tag.toUpperCase()}* ──`)
            for (let cmd of cmds) lines.push(`• ${usedPrefix}${cmd}`)
            lines.push('')
        }
        lines.push(`Total: ${Object.values(byTag).flat().length} perintah`)
        await m.reply(lines.join('\n'))
    }
};
