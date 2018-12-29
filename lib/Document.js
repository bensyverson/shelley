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
	this.isIndex = null

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
		},
		directoryPath: {
			get: function() {
				delete this.directoryPath
				Object.defineProperty( this, 'directoryPath', {
					value: self.path.slice(0, -1).join('/'),
					writable: false
				})
				return this.directoryPath
			},
			configurable:  true
		},
		fileComponent: {
			get: function() {
				delete this.fileComponent
				Object.defineProperty( this, 'fileComponent', {
					value: self.path[self.path.length - 1],
					writable: false
				})
				return this.fileComponent
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
		path = self.file
			.path
			.slice()
			.concat([self.file.filename])
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

Document.prototype.sortName = function() {
	const self = this

	if (self.meta.path === undefined) {
		return self.file.filename
	} else {
		path = self.meta.path.split('/').filter(function(a) { return a != '' })
	}
}

Document.prototype.filePath = function(root, htmlEnding) {
	const self = this
	const path = self.path
	if (self.isIndex) { path[path.length - 1] = 'index' }
	return root + '/' + path.join('/') + htmlEnding
}

Document.prototype.buildFilename = function(htmlEnding) {
	const self = this
	if (self.isIndex) { return 'index' + htmlEnding }
	return self.path[self.path.length - 1] + htmlEnding
}

Document.prototype.cleanedFilename = function(aFilename){
	// Strip out the extension and leading numbers
	// Remove punctuation, replace nonword characters with `-`, 
	// make sure `-` doesn't get out of control, and keep it to 64 chars or less.
	return aFilename.replace(/\.[a-zA-Z]+$/, '')
					.replace(/^\d+-/, '')
					.replace(/[^a-zA-Z0-9]/g, '-')
					.replace(/['"‘’“”«»‹›()[\]{}<>/\\|+=~`:;.,…!@#$%^&*?¿¡]/g, '')
					.replace(/-+/g, '-')
					.replace(/^-/, '')
					.replace(/-$/, '')
					.toLowerCase()
					.substr(0,64)
}

module.exports = Document