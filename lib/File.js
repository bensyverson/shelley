'use strict'

const fs = require('fs')

const File = function(options) {
	const self = this
	if (options === undefined ||
		options.originalFile === undefined ||
		options.filename === undefined ||
		options.path === undefined ||
		options.mtime === undefined) {
		throw Error("No options passed for File.")
	}
	this.originalFile = options.originalFile
	this.filename = options.filename
	this.path = options.path
	this.mtime = options.mtime

	Object.defineProperties(this, {
		contents: {
			get: function() {
				delete this.contents
				Object.defineProperty( this, 'contents', {
					value: fs.readFileSync(self.originalFile, 'utf8'),
					writable: false
				})
				return this.contents
			},
			configurable:  true
		}
	})
}

File.prototype.filePath = function(root) {
	const self = this
	return root + '/' + ((self.path.length > 0) ? (self.path.join('/') + '/') : '') + self.filename
}

module.exports = File