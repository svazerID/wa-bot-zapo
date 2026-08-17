/**
 * Upload media ke WhatsApp CDN — mirip Baileys prepareWAMessageMedia.
 *
 * @param {object} conn - WaClient
 * @param {object} source - { image: { url/buffer }, video: { url/buffer }, audio: { url/buffer }, document: { url/buffer } }
 * @param {object} [opts]
 * @param {string} [opts.mimetype] - override mimetype
 * @param {string} [opts.fileName] - override filename (document)
 * @returns {object} { imageMessage/videoMessage/audioMessage/documentMessage, upload }
 */
async function prepareWAMessageMedia(conn, source, opts = {}) {
    let type = Object.keys(source).find(k => ['image', 'video', 'audio', 'document', 'sticker'].includes(k))
    if (!type) throw new Error('source harus { image/video/audio/document/sticker }: { url/buffer }')

    let media = source[type]
    let buf

    if (Buffer.isBuffer(media)) {
        buf = media
    } else if (typeof media === 'string') {
        // URL atau file path
        if (/^https?:\/\//.test(media)) {
            let res = await fetch(media)
            buf = Buffer.from(await res.arrayBuffer())
        } else {
            buf = require('fs').readFileSync(media)
        }
    } else if (media.url) {
        if (/^https?:\/\//.test(media.url)) {
            let res = await fetch(media.url)
            buf = Buffer.from(await res.arrayBuffer())
        } else {
            buf = require('fs').readFileSync(media.url)
        }
    } else if (media.buffer) {
        buf = Buffer.isBuffer(media.buffer) ? media.buffer : Buffer.from(media.buffer)
    } else if (media.stream) {
        let chunks = []
        for await (let chunk of media.stream) chunks.push(chunk)
        buf = Buffer.concat(chunks)
    } else {
        throw new Error('media harus { url }, { buffer }, atau { stream }')
    }

    // Detect mimetype
    let mimetypes = {
        image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mpeg',
        document: 'application/pdf', sticker: 'image/webp'
    }
    let mimetype = opts.mimetype || mimetypes[type] || 'application/octet-stream'

    let upload = await conn.message.upload(buf, { type, mimetype })

    let msgKey = type + 'Message'
    let msg = {
        url: upload.url,
        directPath: upload.directPath,
        mediaKey: upload.mediaKey,
        fileSha256: upload.fileSha256,
        fileEncSha256: upload.fileEncSha256,
        fileLength: upload.fileLength,
        mediaKeyTimestamp: upload.mediaKeyTimestamp,
        mimetype: upload.mimetype || mimetype
    }

    if (type === 'document') msg.fileName = opts.fileName || 'file'

    return { [msgKey]: msg, upload }
}

/**
 * Kirim interactive message (native flow buttons) via zapo-js.
 *
 * @param {object} conn - WaClient
 * @param {string} chat - JID chat
 * @param {object} opts
 * @param {string} opts.body - Teks utama
 * @param {object} [opts.header] - { hasMediaAttachment, imageMessage/videoMessage/documentMessage, title?, subtitle? }
 * @param {string} [opts.footer] - Footer
 * @param {Array}  opts.buttons - Array button
 *   - { type: 'copy', text, url }
 *   - { type: 'url', text, url, merchantUrl? }
 *   - { type: 'quick_reply', text, id }
 *   - { type: 'list', title, rows: [{ title, description?, id }] }
 * @param {object} [opts.contextInfo] - contextInfo (quote, mentions, etc)
 * @param {object} [opts.limitedTime] - { text, url, copyCode, expiresIn }
 */
async function sendInteractive(conn, chat, opts, sendOpts = {}) {
    let { proto } = require('zapo-js')
    let expiryTime = opts.limitedTime
        ? Date.now() + (opts.limitedTime.expiresIn || 24 * 60 * 60 * 1000)
        : undefined

    let buttons = (opts.buttons || []).map(b => {
        let params = {}
        if (b.type === 'copy') {
            params = { display_text: b.text, copy_code: b.url }
        } else if (b.type === 'url') {
            params = { display_text: b.text, url: b.url, merchant_url: b.merchantUrl || b.url }
        } else if (b.type === 'quick_reply') {
            params = { display_text: b.text, id: b.id }
        } else if (b.type === 'list') {
            params = {
                title: b.title,
                sections: [{ title: 'Opsi', rows: b.rows || [] }]
            }
        }
        let name = { copy: 'cta_copy', url: 'cta_url', quick_reply: 'quick_reply', list: 'single_select' }[b.type] || 'quick_reply'
        return { name, buttonParamsJson: JSON.stringify(params) }
    })

    let messageParams = {}
    if (opts.limitedTime) {
        messageParams.limited_time_offer = {
            text: opts.limitedTime.text || 'expires in 24 hours',
            url: opts.limitedTime.url || '',
            copy_code: opts.limitedTime.copyCode || '',
            expiration_time: expiryTime
        }
    }
    if (buttons.length > 3) {
        messageParams.bottom_sheet = {
            in_thread_buttons_limit: 0,
            list_title: opts.body || 'Menu',
            button_title: 'Buka Menu'
        }
    }

    let contextInfo = {
        mentionedJid: opts.contextInfo?.mentions || [],
        ...opts.contextInfo
    }

    let interactiveMsg = {
        body: { text: opts.body || '' },
        footer: { text: opts.footer || '' },
        nativeFlowMessage: {
            buttons,
            ...(Object.keys(messageParams).length > 0 ? { messageParamsJson: JSON.stringify(messageParams) } : {})
        },
        contextInfo
    }

    if (opts.header) {
        interactiveMsg.header = {
            hasMediaAttachment: opts.header.hasMediaAttachment ?? true,
            ...(opts.header.imageMessage ? { imageMessage: opts.header.imageMessage } : {}),
            ...(opts.header.videoMessage ? { videoMessage: opts.header.videoMessage } : {}),
            ...(opts.header.documentMessage ? { documentMessage: opts.header.documentMessage } : {}),
            ...(opts.header.title ? { title: opts.header.title } : {}),
            ...(opts.header.subtitle ? { subtitle: opts.header.subtitle } : {})
        }
    }

    await conn.message.send(chat, { interactiveMessage: interactiveMsg }, sendOpts)
}

module.exports = { sendInteractive, prepareWAMessageMedia }
