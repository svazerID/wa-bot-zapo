module.exports = {
    name: 'fetch',
    description: 'Fetch URL dan kirim konten (text, JSON, image, video, audio, dll).',
    aliases: ['get'],
    tags: ['tools'],
    permissions: {},
    command: /^(fetch|get)$/i,
    run: async (m, { text, args, conn }) => {
        let url = args[0]
        if (!url || !/^https?:\/\//.test(url)) throw 'Awali *URL* dengan http:// atau https://'

        let res
        try {
            res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })
        } catch (e) {
            return m.reply('❌ Gagal fetch: ' + e.message)
        }

        let contentType = res.headers.get('content-type') || ''
        let contentLength = Number(res.headers.get('content-length') || 0)

        if (contentLength > 200 * 1024 * 1024) {
            return m.reply('🚩 File terlalu besar (' + formatSize(contentLength) + '), max 200 MB.')
        }

        if (/json/i.test(contentType)) {
            let json = await res.json()
            return m.reply(JSON.stringify(json, null, 2))
        }

        if (/text|html|xml|javascript|css|csv/i.test(contentType)) {
            let t = await res.text()
            if (t.length > 4000) t = t.slice(0, 3900) + '\n\n... (dipotong)'
            return m.reply(t)
        }

        // Binary: download & send with proper type
        let buf = Buffer.from(await res.arrayBuffer())
        let name = (url.split('/').pop().split('?')[0] || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
        let ext = getExt(contentType)
        if (!name.includes('.')) name += ext

        let mime = (contentType.split(';')[0] || '').trim()
        let type = getType(mime)

        let fs = require('fs')
        let path = require('path')
        let tmpDir = path.join(__dirname, '..', 'tmp')
        fs.mkdirSync(tmpDir, { recursive: true })
        let tmpFile = path.join(tmpDir, `fetch_${Date.now()}_${name}`)
        fs.writeFileSync(tmpFile, buf)

        try {
            await conn.message.send(m.chat, {
                type,
                media: tmpFile,
                mimetype: mime,
                caption: name
            }, { quote: m })
        } finally {
            try { fs.unlinkSync(tmpFile) } catch {}
        }
    }
};

function formatSize(bytes) {
    if (!bytes) return '?'
    let k = 1024
    let sizes = ['Bytes', 'KB', 'MB', 'GB']
    let i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

function getType(mime) {
    if (/^image\//.test(mime)) return 'image'
    if (/^video\//.test(mime)) return 'video'
    if (/^audio\//.test(mime)) return 'audio'
    return 'document'
}

function getExt(contentType) {
    let map = {
        'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
        'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm',
        'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
        'application/pdf': '.pdf', 'application/zip': '.zip'
    }
    for (let [mime, ext] of Object.entries(map)) {
        if (contentType.includes(mime)) return ext
    }
    return '.bin'
}
