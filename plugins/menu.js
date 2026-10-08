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
            for (let tag of p.tags) (byTag[tag] ??= []).push(p)
        }
        let lines = [`*${global.packname || 'Bot'}*`, '']
        let total = 0
        for (let [tag, plugins] of Object.entries(byTag)) {
            lines.push(`── *${tag.toUpperCase()}* ──`)
            for (let p of plugins) {
                total += p.names.length
                lines.push(`• ${usedPrefix}${p.names.join(' | ')}`)
                if (p.description) lines.push(`  > ${p.description}`)
            }
            lines.push('')
        }
        lines.push(`Total: ${total} perintah`)
        await m.reply(lines.join('\n'))
    }
};