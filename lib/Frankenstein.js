'use strict';

const Remarkable = require('remarkable')

const PutStuffHere = require('putstuffhere')

const Frankenstein = function(options){
	this.templatePath = '';
	if (options) {
		this.templatePath = options.template || this.templatePath;
	}
	this.md = new Remarkable({
		xhtmlOut: true,
		typographer: true,
	})

	PutStuffHere.shared().shouldExtractBody = false;
}

Frankenstein.prototype.template = function(template, doc) {
	const self = this
	return template.func(self.consolidateLocals(doc))
};

Frankenstein.prototype.consolidateLocals = function(doc) {
	const self = this
	let locals = {}
	const metaKeys = Object.keys(doc.meta);
	for (var i = 0; i < metaKeys.length; i++) {
		locals[metaKeys[i]] = doc.meta[metaKeys[i]];
	}

	var allKeys = Object.keys(doc);
	for (var i = 0; i < allKeys.length; i++) {
		var key = allKeys[i];
		if ((key != 'meta') && (key != 'body')) {
			locals[key] = doc[key];
		}
	}

	// Do markdown replacement
	locals['markdown'] = self.md.render(doc['body']);
	return locals;
};

module.exports = Frankenstein;
