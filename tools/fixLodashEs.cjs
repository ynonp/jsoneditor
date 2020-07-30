// workaround for https://github.com/lodash/lodash/issues/4800

const fs = require('fs')
const path = require('path')

const packageFileName = path.join(__dirname, '../node_modules/lodash-es/package.json')

const pkg = JSON.parse(String(fs.readFileSync(packageFileName)))

pkg.type = 'module'

fs.writeFileSync(packageFileName, JSON.stringify(pkg, null, 2))

console.log(`Added "type": "module" field to ${packageFileName}`)
console.log('WARNING: please find a proper solution to consume lodash-es')
console.log()
