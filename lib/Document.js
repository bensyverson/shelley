'use strict'

const Document = function(options){
	const self = this
	if (options === undefined ||
		options.file === undefined ||
		options.meta === undefined ||
		options.body === undefined) {
		throw Error("No options passed for Document.")
	}
	this.meta = options.meta
	this.body = options.body
	this.file = options.file
	this.parent = null
	this.fileRegex = new RegExp(/^(.+)\.([a-zA-Z]+)$/)

	Object.defineProperties(this, {
		path: {
			get: function() {
				delete this.path
				Object.defineProperty( this, 'path', {
					value: self.createPath(),
					writable: false
				})
				return this.path
			},
			configurable:  true
		}
	})
}

Document.prototype.createPath = function() {
	const self = this
	let path = []
	// If the path is not specified, use the hierarchy of the `/content` directory.
	if (self.meta.path === undefined) {
		path = self.file.path.slice().concat([self.file.filename]);
	} else {
		// Otherwise, split the `path`
		path = self.meta.path.split('/').filter(function(a) { return a != '' })

		// If the path specifies a filename, let's use that.
		if (self.fileRegex.exec(path[ path.length - 1]) == null) {
			path.push('index')
		}
	}

	// Return the cleaned path
	return path.map(function(a){ return self.cleanedFilename(a) })
}

Document.prototype.filePath = function(root, htmlEnding) {
	const self = this
	return root + '/' + self.path.join('/') + htmlEnding
}

Document.prototype.cleanedFilename = function(aFilename){
	var self = this;
	// Strip out the extension, just delete punctuation, replace nonword characters with `-`, 
	// make sure `-` doesn't get out of control, and keep it to 64 chars or less.
	return aFilename.replace(/\.[a-zA-Z]+$/, '')
					.replace(/[^a-zA-Z0-9]/g, '-')
					.replace(/['"‘’“”«»‹›()[\]{}<>/\\|+=~`:;.,…!@#$%^&*?¿¡]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-/, '')
					.replace(/-$/, '')
					.toLowerCase()
					.substr(0,64)
}

module.exports = Document