'use strict';

var MetadataParser = function(options) {
	this.metadata = {
		pages: {},
		children: {},
	};
	this.chunkRegex = new RegExp(/```shelley([\s\S]+?)```\s*([\s\S]+)/);
	this.lineRegex = new RegExp(/\s*([^:]+)\s*:\s*(.+)/g);
	this.fileRegex = new RegExp(/^(.+)\.([a-zA-Z]+)$/);
};

MetadataParser.prototype.sorted = function(){
	var self = this;
	var dict = {
		children: self.sortedArrayForDict(self.metadata.children),
		pages: self.sortedArrayForDict(self.metadata.pages),
		parent: null,
	};
	return dict;
};

MetadataParser.prototype.sortedArrayForDict = function(aDict){
	var self = this;

	var sorted = [];
	if (!aDict) {
		return sorted;
	}
	var keys = Object.keys(aDict).sort();
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var pathComponent = key.replace(/^\d+-/, '');
		var newObject = {};
		if (aDict[key].children === undefined) {
			// If this is a page, copy all attributes to this leaf.
			var childKeys = Object.keys(aDict[key]);
			for (var j = 0; j < childKeys.length; j++) {
				newObject[childKeys[j]] = aDict[key][childKeys[j]];
			}
		} else {
			newObject.children = self.sortedArrayForDict(aDict[key].children);
			newObject.pages = self.sortedArrayForDict(aDict[key].pages);
			// Change the filename for the first page to `index` (to be transformed to `index.html`)
			if (newObject.pages.length > 0) newObject.pages[0].pathComponent = 'index';
		}
		newObject.pathComponent = pathComponent;
		sorted.push(newObject);
	}
	return sorted;
};


MetadataParser.prototype.parse = function(pathArray, filename, aDataChunk, dateModified) {
	var self = this;
	
	// Split doc into meta and body
	var doc = self.extractMeta(aDataChunk);
	doc.modified = dateModified;

	// Determine path for doc
	var path = self.getPath(pathArray, filename, doc.meta);

	// Store it in the meta tree
	self.storeDoc(doc, path);
};

MetadataParser.prototype.storeDoc = function(aDoc, aPath){
	var self = this;

	var object = self.metadata;
	for (var i = 0; i < aPath.length; i++) {
		var pathEl = aPath[i];		
		if (i == (aPath.length - 1)) {
			aDoc.parent = object;
			object.pages[pathEl] = aDoc;
			return;
		}
		if (object.children[pathEl] === undefined) object.children[pathEl] = {
			pages: {},
			children: {},
			parent: object,
		};
		object = object.children[pathEl];
	}
};

MetadataParser.prototype.extractMeta = function(aDataChunk) {
	var self = this;

	var metaResult = self.chunkRegex.exec(aDataChunk);
	if (metaResult == null) {
		return {
			meta: '',
			body: aDataChunk,
		}
	};

	var meta = {};
	var lineResult;
	while ((lineResult = self.lineRegex.exec(metaResult[1])) != null) {
		meta[ lineResult[1].toLowerCase() ] = lineResult[2];
	}

	return {
		meta: meta,
		body: metaResult[2],
	};
}

MetadataParser.prototype.cleanedFilename = function(aFilename){
	var self = this;
	// Strip out the extension, replace illegal characters with `-`, 
	// make sure `-` doesn't get out of control, and keep it to 28 chars or less.
	return aFilename.replace(/\.[a-zA-Z]+$/, '')
					.replace(/[^a-zA-Z0-9]/g, '-')
					.replace(/-{2,}/, '-')
					.toLowerCase()
					.substr(0,28)
					.replace(/^-/, '')
					.replace(/-$/, '');
}

MetadataParser.prototype.getPath = function(pathArray, filename, meta) {
	var self = this;
	var file = self.cleanedFilename(filename);
	var path = [];

	// If the path is not specified, use the hierarchy of the `/content` directory.
	if (meta.path === undefined) {
		path = pathArray.slice();
		path.push(file);
	} else {
		// Otherwise, split the `path`
		path = meta.path.split('/').filter(function(a) {
			return a != '';
		});

		// If the path specifies a filename, let's use that.
		var lastFile;
		if ((lastFile = self.fileRegex.exec(path[ path.length - 1])) != null) {
			file = self.cleanedFilename( lastFile[1] );
			path[ path.length - 1] = file;
		} else {
			path.push('index');
		}
	}

	// Return the cleaned path
	return path.map(function(a){
		return self.cleanedFilename(a);
	});
}

module.exports = MetadataParser;
