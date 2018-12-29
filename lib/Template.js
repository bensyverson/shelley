'use strict'
const PutStuffHere = require('putstuffhere')

const Template = function(options) {
	const self = this
	if (options === undefined ||
		options.file === undefined) { 
		throw Error("No options passed for Template.")
	}
	this.file = options.file

	Object.defineProperties(this, {
		func: {
			get: function() {
				delete this.func
				Object.defineProperty( this, 'func', {
						value: PutStuffHere.shared().compileText(self.file.contents, true),
						writable: false
				})
				return this.func
			},
			configurable:  true
		}
	})
}

module.exports = Template
