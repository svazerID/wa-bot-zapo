const os = require('os')
const v8 = require('v8')

const formatSize = (size) => `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`

const runtime = (seconds) => {
  seconds = Math.round(seconds)
  let days = Math.floor(seconds / (3600 * 24))
  seconds %= 3600 * 24
  let hrs = Math.floor(seconds / 3600)
  seconds %= 3600
  let mins = Math.floor(seconds / 60)
  let secs = seconds % 60
  return `${days}d ${hrs}h ${mins}m ${secs}s`
}

// Sembunyikan 2 oktet terakhir IP.
function hideIp(ip) {
  let seg = String(ip || '').split('.')
  if (seg.length !== 4) return ip || '-'
  seg[2] = '***'
  seg[3] = '***'
  return seg.join('.')
}

// Info IP best-effort: gagal jaringan jangan sampai bikin !ping error.
async function ipInfo() {
  try {
    let res = await fetch('https://ipinfo.io/json')
    return await res.json()
  } catch {
    return null
  }
}

let handler = async (m) => {
  const cpuCount = os.cpus().length
  let heap = v8.getHeapStatistics()
  let myip = await ipInfo()

  // Waktu respons: dari timestamp pesan masuk sampai sekarang.
  let respTime = Math.max(0, (Date.now() - (m.timestamp || Date.now())) / 1000)
  let resp = `${respTime.toFixed(3)} second${respTime === 1 ? '' : 's'}`

  let teks = [
    '*INFO SERVER*',
    `- Speed Respons: _${resp}_`,
    `- Hostname: _${os.hostname()}_`,
    `- CPU Core: _${cpuCount}_`,
    `- Platform: _${os.platform()}_`,
    `- OS: _${os.version()} / ${os.release()}_`,
    `- Arch: _${os.arch()}_`,
    `- Ram: _${formatSize(os.totalmem() - os.freemem())}_ / _${formatSize(os.totalmem())}_`,
    '',
    '*PROVIDER INFO*',
    `- IP: ${hideIp(myip?.ip)}`,
    `- Region: _${myip ? `${myip.region} ${myip.country}` : 'tidak diketahui'}_`,
    `- ISP: _${myip?.org || 'tidak diketahui'}_`,
    '',
    '*RUNTIME OS*',
    `- _${runtime(os.uptime())}_`,
    '',
    '*RUNTIME BOT*',
    `- _${runtime(process.uptime())}_`,
    '',
    '*MEMORI BOT*',
    `- RSS: _${formatSize(process.memoryUsage().rss)}_`,
    `- Heap: _${formatSize(heap.used_heap_size)}_ / _${formatSize(heap.heap_size_limit)}_`,
    // os.cpus()[].speed selalu 0 di container — loadavg lebih jujur.
    `- Load: _${os.loadavg().map(n => n.toFixed(2)).join(' / ')}_`
  ].join('\n')

  await m.reply(teks)
}

handler.description = "Info server & runtime bot (CPU, RAM, uptime, IP, respons)."
handler.help = ['ping']
handler.tags = ['info']
handler.command = /^(ping)$/i

module.exports = handler
