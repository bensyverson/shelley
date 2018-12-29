'use strict'

const Utils = require('./Utils.js')

const Directory = function(options) {
	if (options === undefined ||
		options.filename === undefined ||
		options.files === undefined ||
		options.path === undefined) {
		throw Error("No options passed for Directory.")
	}
	this.filename = options.filename
	this.path = options.path
	this.files = options.files
}

Directory.prototype.allFiles = function() {
	const self = this
	return Utils.flatmap(
		self.files.map(function(file){
			if (file instanceof File) { return file }
			if (file instanceof Directory) {
				return file.allFiles()
			}
		})
	)
}

module.exports = Directory
