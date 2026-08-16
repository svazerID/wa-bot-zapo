const chalk = require('chalk')

// --- Banner ---
const pkg = require('./package.json')
console.log(chalk.cyan('╭──────────────────────────────────────╮'))
console.log(chalk.cyan('│') + chalk.bold.white('  🤖 WhatsApp Bot                       '))
console.log(chalk.cyan('│') + chalk.gray(`  ${pkg.name} v${pkg.version}                     `))
console.log(chalk.cyan('│') + chalk.gray('  zapo-js • Node.js + Termux            '))
console.log(chalk.cyan('╰──────────────────────────────────────╯'))
console.log()
require('./config.js')
const fs = require('node:fs')
const path = require('node:path')
const readline = require('readline')
// Native WebSocket Node 26 gagal handshake ke server WhatsApp (HTTP/2 experimental),
// pakai package ws yang sudah terbukti connect.
// Inject headers Origin + User-Agent supaya server tidak reject dengan HTTP 200.
const Ws = require('ws')
globalThis.WebSocket = function PatchedWs(url, protocols, opts) {
  // zapo-js calls: new WebSocket(url, { protocols, headers })
  // ws v8 needs:    new Ws(url, protocols, options)
  if (typeof protocols === 'object' && protocols !== null && !Array.isArray(protocols)) {
    opts = protocols
    protocols = undefined
  }
  opts = Object.assign({
    headers: {
      Origin: 'https://web.whatsapp.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, opts || {})
  // Always use 3-arg form so ws parses headers correctly
  return new Ws(url, protocols || [], opts)
}
Object.assign(globalThis.WebSocket, Ws)
for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) globalThis.WebSocket[k] = Ws[k]
const { ConsoleLogger, createStore, WaClient } = require('zapo-js')
const { createSqliteStore } = require('@zapo-js/store-sqlite')

const PHONE_NUMBER = process.env.PHONE_NUMBER || null

global.timestamp = { start: new Date() }
global.lidCache = {} // LID → phone number cache, populate dari group metadata

// --- Database JSON ---
const DB_FILE = 'database.json'
global.db = {
  data: null,
  read() {
    try { this.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch { this.data = {} }
    this.data = { users: {}, chats: {}, stats: {}, msgs: {}, settings: {}, jadibot: {}, ...(this.data || {}) }
  },
  write() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2))
  }
}
global.db.read()
setInterval(() => global.db.write(), 60 * 1000) // save tiap menit

// --- Store & client zapo ---
fs.mkdirSync('.auth', { recursive: true })
global.store = createStore({
  backends: { sqlite: createSqliteStore({ path: '.auth/state.sqlite' }) },
  providers: {
    auth: 'sqlite', signal: 'sqlite', preKey: 'sqlite', session: 'sqlite',
    identity: 'sqlite', senderKey: 'sqlite', appState: 'sqlite', privacyToken: 'sqlite',
    messages: 'none', threads: 'none', contacts: 'sqlite'
  }
})
global.conn = new WaClient(
  { store: global.store, sessionId: 'default', recoverFromClientTooOld: true },
  new ConsoleLogger('warn')
)

// --- Pairing code ---
let pairingRequested = false
async function requestPairing() {
  if (pairingRequested) return
  pairingRequested = true
  let phoneNumber = PHONE_NUMBER
  if (!phoneNumber) {
    phoneNumber = await askPhone()
  }
  if (!phoneNumber) {
    pairingRequested = false
    return
  }
  try {
    const code = await conn.auth.requestPairingCode(phoneNumber)
    console.log()
    console.log(chalk.green('╭──────────────────────────────────────╮'))
    console.log(chalk.green('│') + chalk.bold.white('  📱 KODE PAIRING                       '))
    console.log(chalk.green('│') + chalk.yellow(`  ${code.match(/.{1,4}/g).join('-')}`))
    console.log(chalk.green('│'))
    console.log(chalk.green('│') + chalk.gray('  Buka WhatsApp → Perangkat tertaut'))
    console.log(chalk.green('│') + chalk.gray('  → Tautkan dengan nomor telepon'))
    console.log(chalk.green('│') + chalk.gray('  → Masukkan kode di atas'))
    console.log(chalk.green('╰──────────────────────────────────────╯'))
    console.log()
  } catch (err) {
    pairingRequested = false
    console.error('Gagal meminta pairing code:', err.message)
  }
}

function askPhone() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('Masukkan nomor WhatsApp (cth: 6281234567890): ', answer => {
      rl.close()
      let num = answer.trim().replace(/[^0-9]/g, '')
      if (num.length < 10) {
        console.error('Nomor terlalu pendek, coba lagi.')
        return resolve(askPhone())
      }
      resolve(num)
    })
  })
}
conn.on('auth_qr', requestPairing)
conn.on('auth_pairing_required', requestPairing)
conn.on('auth_paired', ({ credentials }) => {
  console.log(chalk.green('✅ Pairing berhasil') + chalk.gray(` → ${credentials.meJid}`))
  global.timestamp.connect = new Date()
})

// --- Reconnect: exponential backoff, skip reason fatal ---
const FATAL_REASONS = new Set([
  'stream_error_replaced', 'stream_error_device_removed', 'stream_error_force_logout',
  'failure_not_authorized', 'failure_banned', 'failure_locked',
  'failure_bad_user_agent', 'primary_identity_key_change'
])
let reconnectAttempt = 0
let reconnectScheduled = false
let shuttingDown = false

function scheduleReconnect() {
  if (reconnectScheduled) return
  reconnectScheduled = true
  const delayMs = Math.min(30_000, 1_000 * 2 ** reconnectAttempt)
  reconnectAttempt += 1
  console.log(chalk.yellow(`🔄 Reconnect dalam ${delayMs / 1000} detik`) + chalk.gray(` (percobaan ${reconnectAttempt})...`))
  setTimeout(() => {
    reconnectScheduled = false
    conn.connect().catch(err => {
      console.error('Reconnect gagal:', err.message)
      scheduleReconnect()
    })
  }, delayMs)
}

conn.on('connection', (event) => {
  if (event.status === 'open') {
    reconnectAttempt = 0
    console.log(chalk.green('🟢 Terhubung ke WhatsApp!'))
    return
  }
  if (event.isLogout || FATAL_REASONS.has(event.reason)) {
    console.error(chalk.red(`🔴 Putus fatal (${event.reason})`) + chalk.gray(' — hapus folder .auth lalu pairing ulang.'))
    process.exit(1)
  }
  if (shuttingDown || event.reason === 'client_disconnected') return
  console.log(chalk.yellow(`⚠️  Koneksi terputus (${event.reason})`))
  pairingRequested = false
  scheduleReconnect()
})

// --- Plugin loader + hot reload ---
let pluginFolder = path.join(__dirname, 'plugins')
let pluginFilter = filename => /\.js$/.test(filename)
function normalizePlugin(p) {
  if (typeof p === 'function') {
    // Format lama: module.exports = async (m, ctx) => {...} dengan properti command/tags/etc
    let fn = p
    return {
      name: fn.name || fn.help || 'anonymous',
      command: fn.command,
      customPrefix: fn.customPrefix,
      owner: !!fn.owner,
      group: !!fn.group,
      private: !!fn.private,
      admin: !!fn.admin,
      botAdmin: !!fn.botAdmin,
      run: fn
    }
  }
  if (p && typeof p === 'object' && typeof p.run === 'function') {
    // Format baru: { name, description, aliases, tags, permissions, run }
    let perm = p.permissions || {}
    let cmd = p.command || (Array.isArray(p.aliases) && p.aliases.length ? p.aliases[0] : null)
    return {
      name: p.name || 'anonymous',
      command: cmd instanceof RegExp ? cmd : (typeof cmd === 'string' ? cmd.toLowerCase() : null),
      customPrefix: p.customPrefix || null,
      owner: !!perm.ownerOnly,
      group: !!perm.groupOnly,
      private: !!perm.privateOnly,
      admin: !!perm.adminOnly,
      botAdmin: !!perm.botAdmin,
      run: p.run
    }
  }
  return null
}

global.plugins = {}
for (let filename of fs.readdirSync(pluginFolder).filter(pluginFilter)) {
  try {
    let raw = require(path.join(pluginFolder, filename))
    let plugin = normalizePlugin(raw)
    if (!plugin) {
      console.error(chalk.red(`❌ Plugin '${filename}' format tidak dikenali`))
      continue
    }
    global.plugins[filename] = plugin
  } catch (e) {
      console.error(chalk.red(`❌ Gagal load plugin '${filename}':`) + ' ' + e.message)
    delete global.plugins[filename]
  }
}
console.log(chalk.cyan('📦 Plugin dimuat:') + ' ' + Object.keys(global.plugins).join(', '))

global.reload = (_event, filename) => {
  if (!pluginFilter(filename)) return
  let dir = path.join(pluginFolder, filename)
  if (dir in require.cache) {
    delete require.cache[dir]
    if (!fs.existsSync(dir)) {
      console.warn(chalk.red(`🗑️  Plugin dihapus: '${filename}'`))
      return delete global.plugins[filename]
    }
    console.log(chalk.gray(`♻️  Reload plugin '${filename}'`))
  } else console.log(chalk.gray(`➕ Plugin baru '${filename}'`))
  try {
    let raw = require(dir)
    let plugin = normalizePlugin(raw)
    if (!plugin) {
      console.error(chalk.red(`❌ Plugin '${filename}' format tidak dikenali`))
      return delete global.plugins[filename]
    }
    global.plugins[filename] = plugin
  } catch (e) {
    console.error(chalk.red(`❌ Syntax error plugin '${filename}':`) + ' ' + e.message)
  }
}
fs.watch(pluginFolder, global.reload)

// --- Handler ---
let isInit = true
global.reloadHandler = function () {
  let handler = require('./handler')
  if (!isInit) conn.off('message', conn.handler)
  conn.handler = handler.handler
  conn.on('message', conn.handler)
  isInit = false
  return true
}
global.reloadHandler()

// --- Graceful shutdown ---
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  console.log(chalk.red('\n🔴 Mematikan bot...'))
  global.db.write()
  // Stop semua session jadibot dulu
  let jadibot = require('./lib/jadibot')
  for (let [ownerJid] of [...jadibot.sessions]) {
    await jadibot.stopSession(ownerJid).catch(() => {})
  }
  await conn.disconnect().catch(() => undefined)
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('uncaughtException', console.error)

conn.connect().then(() => {
  // Restore session jadibot yang tersimpan di database
  let jadibot = require('./lib/jadibot')
  let saved = global.db.data.jadibot || {}
  let count = Object.keys(saved).length
  if (count) {
    console.log(chalk.cyan(`🔄 Restore ${count} session jadibot...`))
    for (let [ownerJid, phone] of Object.entries(saved)) {
      jadibot.createSession({ ownerJid, phone }).catch(err => {
        console.error(`Gagal restore jadibot ${ownerJid}:`, err.message)
      })
    }
  }
}).catch(err => {
  console.error(chalk.red('❌ Gagal connect:') + ' ' + err.message)
  process.exit(1)
})
