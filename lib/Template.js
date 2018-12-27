'use strict'
const PutStuffHere = require('putstuffhere')

const Template = function(options) {
	const self = this
	if (options === undefined ||
		options.file === undefined) { 
		throw Error("No options passed for Template.")
	}
	this.file = options.file

	PutStuffHere.shared().shouldExtractBody = false
	Object.defineProperties(this, {
		func: {
			get: function() {
				delete this.func
				Object.defineProperty( this, 'func', {
						value: PutStuffHere.shared().compile(self.file.contents),
						writable: false
				})
				return this.func
			},
			configurable:  true
		}
	})
}

module.exports = Template