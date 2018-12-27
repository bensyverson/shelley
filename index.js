'use strict'

const path = process.argv[2]

const Shelley = require('./lib/Shelley.js')
const sh = new Shelley()

try {
	sh.build()
} catch (e) {
	console.log(e)
}