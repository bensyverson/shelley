'use strict';

const Remarkable = require('remarkable')

const PutStuffHere = require('putstuffhere')

const Frankenstein = function(options){
	this.templatePath = ''
	if (options) {
		this.templatePath = options.template || this.templatePath
	}
	this.md = new Remarkable({
		xhtmlOut: true,
		typographer: true,
	})

	PutStuffHere.shared().shouldExtractBody = false
}

Frankenstein.prototype.template = function(template, doc) {
	const self = this
	let func = PutStuffHere.shared().compileText(template, false)
	return func(self.consolidateLocals(doc))
}

Frankenstein.prototype.consolidateLocals = function(doc) {
	const self = this
	let locals = {}

	Object.keys(doc.meta)
		.forEach(function(metaKey){ locals[metaKey] = doc.meta[metaKey] })

	Object.keys(doc)
		.filter(function(key){ return (key != 'meta') && (key != 'body')})
		.forEach(function(key){ locals[key] = doc[key] })

	locals['markdown'] = self.md.render(doc['body'])
	return locals
}

module.exports = Frankenstein
