let fs = require('fs')

global.owner = ['6285815061014'] // Nomor owner (bot di-pairing ke nomor ini; dariMe selalu dianggap owner)
global.mods = []
global.prems = []

global.packname = 'wa-bot-zapo'
global.author = 'zapo-js'

global.prefix = /^[!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.\-]/

global.multiplier = 69

global.maxJadibot = 3 // maksimal session jadibot bersamaan

let file = require.resolve(__filename)
fs.watchFile(file, () => {
  fs.unwatchFile(file)
  console.log("Update 'config.js'")
  delete require.cache[file]
  require(file)
})
