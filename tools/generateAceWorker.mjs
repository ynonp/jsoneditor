import btoa from 'btoa'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'

const workerBundleFile = './node_modules/ace-builds/src-noconflict/worker-json.js'
const outputFolder = './src/generated/ace'
const workerEmbeddedFile = path.join(outputFolder, 'jsonWorker.mjs')

// Create an embedded version of the json worker code of Ace editor: a data url
const workerScript = String(readFileSync(workerBundleFile))
const workerDataUrl = 'data:application/javascript;base64,' + btoa(workerScript)

mkdirp.sync(outputFolder)
writeFileSync(workerEmbeddedFile, 'export const jsonWorker = \'' + workerDataUrl + '\'\n')
