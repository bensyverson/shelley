'use strict';

const Document = require('./Document.js')

const MetadataParser = function(options) {
	this.metadata = {
		pages: {},
		children: {},
	}
	this.chunkRegex = new RegExp(/```shelley([\s\S]+?)```\s*([\s\S]+)/)
	this.lineRegex = new RegExp(/\s*([^:]+)\s*:\s*(.+)/g)
}

MetadataParser.prototype.document = function(file) {
	const self = this

	let data = file.contents

	var metaResult = self.chunkRegex.exec(data);
	if (metaResult == null) {
		return new Document({
			file: file,
			meta: '',
			body: aDataChunk,
		})
	}

	var meta = {};
	var lineResult;
	while ((lineResult = self.lineRegex.exec(metaResult[1])) != null) {
		meta[ lineResult[1].toLowerCase() ] = lineResult[2];
	}

	return new Document({
		file: file,
		meta: meta,
		body: metaResult[2],
	})
}


module.exports = MetadataParser
