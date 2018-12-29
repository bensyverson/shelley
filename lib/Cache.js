'use strict'

const fs = require('fs')

const Cache = function(cacheData) {
	const self = this
	let cache = cacheData
	this.getMtime = function(key) { return cache[key] }
	this.setMtime = function(key, mtime) { cache[key] = mtime }

	this.save = function(path) {
		fs.writeFileSync(path, JSON.stringify(cache, null, '  '))
	}
}

module.exports = Cache
