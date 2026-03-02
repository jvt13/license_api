const fs = require('fs')
const path = require('path')

const PRIVATE_KEY_PATH = path.join(__dirname, '../../private.key')

console.log("Tentando ler private key em:", PRIVATE_KEY_PATH)
console.log("Arquivo existe?", fs.existsSync(PRIVATE_KEY_PATH))

const PRIVATE_KEY = fs.existsSync(PRIVATE_KEY_PATH)
  ? fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
  : null

console.log("PRIVATE_KEY length:", PRIVATE_KEY ? PRIVATE_KEY.length : "NULL")

module.exports = {
  PRIVATE_KEY
}