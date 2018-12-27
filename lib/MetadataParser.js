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

// MetadataParser.prototype.sorted = function(){
// 	const self = this
// 	return {
// 		children: self.sortedArrayForDict(self.metadata.children),
// 		pages: self.sortedArrayForDict(self.metadata.pages),
// 		parent: null,
// 	}
// }

// MetadataParser.prototype.sortedArrayForDict = function(aDict){
// 	const self = this

// 	let sorted = []
// 	if (!aDict) {
// 		return sorted
// 	}
// 	const keys = Object.keys(aDict).sort();
// 	for (let i = 0; i < keys.length; i++) {
// 		const key = keys[i]
// 		const pathComponent = key.replace(/^\d+-/, '')
// 		let newObject = {}
// 		if (aDict[key].children === undefined) {
// 			// If this is a page, copy all attributes to this leaf.
// 			const childKeys = Object.keys(aDict[key])
// 			for (let j = 0; j < childKeys.length; j++) {
// 				newObject[childKeys[j]] = aDict[key][childKeys[j]]
// 			}
// 		} else {
// 			newObject.children = self.sortedArrayForDict(aDict[key].children)
// 			newObject.pages = self.sortedArrayForDict(aDict[key].pages)
// 			// Change the filename for the first page to `index` (to be transformed to `index.html`)
// 			if (newObject.pages.length > 0) newObject.pages[0].pathComponent = 'index'
// 		}
// 		newObject.pathComponent = pathComponent
// 		sorted.push(newObject)
// 	}
// 	return sorted
// };


MetadataParser.prototype.parse = function(file, tree) {
	const self = this
	return self.addDoc(self.document(file), tree)
}

MetadataParser.prototype.parseFlat = function(file) {
	const self = this
	return self.document(file)
}

MetadataParser.prototype.addDoc = function(aDoc, tree){
	const self = this
	// meta is different from metadata
	let object = tree
	aDoc.path.forEach(function(pathEl, i){
		if (i == (aDoc.path.length - 1)) {
			aDoc.parent = object
			object.pages[pathEl] = aDoc
			return
		}
		if (object.children[pathEl] === undefined) object.children[pathEl] = {
			pages: {},
			children: {},
			parent: object,
		}
		object = object.children[pathEl]
	})
	return tree
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


module.exports = MetadataParser;
