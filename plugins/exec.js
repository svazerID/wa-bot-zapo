let { exec: execShell } = require('child_process')
let util = require('util')

let handler = module.exports = {
    name: 'exec',
    description: 'Eval kode JS atau jalankan perintah shell.',
    aliases: [],
    tags: ['advanced'],
    permissions: { ownerOnly: true },
    customPrefix: /^([>≥][>≥]?|=>|\$) /,
    command: /(?:)/i,
    run: async (m, _2) => {
        let { conn, usedPrefix, noPrefix, args, groupMetadata } = _2
        if (!noPrefix) return m.reply(`uhm.. kodenya mana?\n\nContoh:\n${usedPrefix}1 + 1`)

        if (/^\$/.test(usedPrefix)) {
            execShell(noPrefix, { timeout: 15000 }, (err, stdout, stderr) => {
                let out = `${stdout || ''}${stderr || ''}${err ? `\n[exit code: ${err.code ?? '?'}]` : ''}`.trim()
                m.reply(out || '(tidak ada output)').catch(() => {})
            })
            return
        }

        let _return
        let _text = (/^=/.test(usedPrefix) ? 'return ' : '') + noPrefix
        try {
            let exec = new (async () => {}).constructor('print', 'm', 'handler', 'require', 'conn', 'Array', 'process', 'args', 'groupMetadata', 'module', 'exports', 'argument', _text)
            let f = { exports: {} }
            _return = await exec.call(conn, (...a) => {
                console.log(...a)
                return conn.message.send(m.chat, util.format(...a)).catch(() => {})
            }, m, handler, require, conn, Array, process, args, groupMetadata, f, f.exports, [conn, _2])
        } catch (e) {
            _return = e
        } finally {
            m.reply(util.format(_return)).catch(() => {})
        }
    }
};
