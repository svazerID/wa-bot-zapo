const { downloadMediaMessage } = require('zapo-js')
const { extractText } = require('../lib/simple')

async function streamToBuffer(stream) {
    let chunks = []
    for await (let chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks)
}

function getMediaType(message) {
    if (!message) return null
    if (message.stickerMessage) return 'sticker'
    if (message.imageMessage) return 'image'
    if (message.videoMessage) return 'video'
    if (message.audioMessage) return 'audio'
    return null
}

module.exports = {
    name: 'hidetag',
    description: 'Tag semua member grup tanpa menampilkan tag.',
    aliases: ['h'],
    tags: ['admin'],
    permissions: { adminOnly: true },
    command: /^(hidetag|ht|h)$/i,
    run: async (m, { conn, text, participants, usedPrefix, command }) => {
        if (!participants?.length) return m.reply('❌ Gagal mengambil daftar member.')
        let users = participants.map(p => p.jid).filter(Boolean)

        let qMsg = m.quoted ? m.quoted.message : m.message
        let mediaType = getMediaType(qMsg)
        // teks: argumen command > caption/teks pesan yang di-reply
        let pesan = text || (m.quoted ? extractText(qMsg) || '' : '')

        let contoh = `Contoh: ${usedPrefix}${command} teks\n\nReply ( gambar, video, sticker ) jika ingin disertai media.`

        let buffer = null
        if (mediaType) {
            let stream = await downloadMediaMessage(qMsg, { downloadNativeClock: false })
            if (!stream) return m.reply('❌ Gagal download media.')
            buffer = Buffer.isBuffer(stream) ? stream : await streamToBuffer(stream)
        }

        if (mediaType === 'image' || mediaType === 'video') {
            if (!pesan) return m.reply(contoh)
            let mimetype =
                qMsg.imageMessage?.mimetype ||
                qMsg.videoMessage?.mimetype ||
                (mediaType === 'image' ? 'image/jpeg' : 'video/mp4')
            await conn.message.send(m.chat, {
                type: mediaType,
                media: buffer,
                mimetype,
                caption: pesan
            }, { quote: m, mentions: users })
        } else if (mediaType === 'sticker') {
            // sticker tidak punya caption, cukup forward + mentions
            await conn.message.send(m.chat, {
                type: 'sticker',
                media: buffer,
                mimetype: qMsg.stickerMessage?.mimetype || 'image/webp'
            }, { quote: m, mentions: users })
        } else if (mediaType === 'audio') {
            await conn.message.send(m.chat, {
                type: 'audio',
                media: buffer,
                mimetype: qMsg.audioMessage?.mimetype || 'audio/mpeg'
            }, { quote: m, mentions: users })
        } else {
            if (!pesan) return m.reply(contoh)
            await conn.message.send(m.chat, { type: 'text', text: pesan }, { quote: m, mentions: users })
        }
    }
};
