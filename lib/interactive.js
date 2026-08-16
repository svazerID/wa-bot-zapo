/**
 * Kirim interactive message (native flow buttons) via zapo-js.
 *
 * @param {object} conn - WaClient
 * @param {string} chat - JID chat
 * @param {object} opts
 * @param {string} opts.body - Teks utama
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

    await conn.message.send(chat, {
        interactiveMessage: {
            body: { text: opts.body || '' },
            footer: { text: opts.footer || '' },
            nativeFlowMessage: {
                buttons,
                ...(Object.keys(messageParams).length > 0 ? { messageParamsJson: JSON.stringify(messageParams) } : {})
            },
            contextInfo
        }
    }, sendOpts)
}

module.exports = { sendInteractive }
