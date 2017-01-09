'use strict';

var Remarkable = require('remarkable');

var PutStuffHere = PutStuffHere || require('putstuffhere');

var Frankenstein = function(options){
	this.templatePath = '';
	if (options) {
		this.templatePath = options.template || this.templatePath;
	}
	this.md = new Remarkable({
		xhtmlOut: true,
		typographer: true,
	});

	PutStuffHere.shared().shouldExtractBody = false;
};

Frankenstein.prototype.template = function(filename, aPage, cb) {
	var self = this;

	var locals = self.consolidateLocals(aPage);
	PutStuffHere.shared().getTemplateFunction(filename, function(err, aTemplate){
		cb(err, aTemplate(locals));
	});
};

Frankenstein.prototype.consolidateLocals = function(aPage) {
	var self = this;
	var locals = {};
	var metaKeys = Object.keys(aPage.meta);
	for (var i = 0; i < metaKeys.length; i++) {
		locals[metaKeys[i]] = aPage.meta[metaKeys[i]];
	}

	var allKeys = Object.keys(aPage);
	for (var i = 0; i < allKeys.length; i++) {
		var key = allKeys[i];
		if ((key != 'meta') && (key != 'body')) {
			locals[key] = aPage[key];
		}
	}

	// Do markdown replacement
	locals['markdown'] = self.md.render(aPage['body']);
	return locals;
};

module.exports = Frankenstein;
