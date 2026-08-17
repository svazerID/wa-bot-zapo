const { extractText } = require('../lib/simple')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = {
    name: 'broadcastgroup',
    description: 'Broadcast pesan ke semua grup yang diikuti bot.',
    aliases: ['bcgc', 'bcgroup'],
    tags: ['owner'],
    permissions: { ownerOnly: true },
    command: /^(bcgc|bcgroup|broadcastgroup)$/i,
    run: async (m, { conn, text, usedPrefix, command }) => {
        let teks = text || (m.quoted ? extractText(m.quoted.message) || '' : '')
        if (!teks) return m.reply(`Contoh: ${usedPrefix}${command} teks\n\nAtau reply pesan yang mau di-broadcast.`)

        let groups
        try {
            // buang grup announce (hanya admin yang bisa kirim) — sama seperti filter metadata.read_only/announce
            groups = (await conn.group.queryAllGroups()).filter(g => !g.announce).map(g => g.jid)
        } catch (e) {
            return m.reply('❌ Gagal mengambil daftar grup: ' + (e.message || e))
        }
        if (!groups.length) return m.reply('❌ Tidak ada grup yang bisa dikirimi broadcast.')

        await m.reply(`⏳ Mengirim broadcast ke ${groups.length} grup...`)

        let success = 0, failed = 0
        for (let id of groups) {
            try {
                await conn.message.send(id, { type: 'text', text: teks })
                success++
            } catch (e) {
                failed++
                console.log(`Gagal broadcast ke ${id}:`, e.message)
            }
            await delay(2000) // jeda antar pengiriman biar tidak spam
        }

        m.reply(`✅ Selesai broadcast grup\nBerhasil: ${success}\nGagal: ${failed}`)
    }
};
