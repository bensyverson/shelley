'use strict';

// System
var fs = require('fs');
var util = require('util');

// 1st Party
var MetadataParser = require('./MetadataParser.js');
var Frankenstein = require('./Frankenstein.js');

var Shelley = function(options){
	this.templatePath = 'templates';
	this.contentPath = 'content';
	this.buildPath = 'build';

	if (options) {
		this.templatePath	= options.template || this.templatePath;
		this.contentPath	= options.content || this.contentPath;
		this.buildPath		= options.build || this.buildPath;
	}

	this.mdRegex = new RegExp(/\.(?:md|markdown)$/i);
	this.htmlRegex = new RegExp(/\.(?:x?html?)$/i);
	this.ignoreRegex = new RegExp(/^\.|\s/);
	this.metadata = [];

	this.cache = {};
	this.shelleyFilename = 'cache.shelley';
	this.htmlEnding = '.html';
	this.metadataParser = new MetadataParser();
	this.frankenstein = new Frankenstein();

	this.templateFiles = {};
	this.forceRebuildTemplates = {};
	this.defaultTemplate = null;
};

Shelley.prototype.build = function(){
	var self = this;

	self.getCache();
	self.getTemplateFiles();

	// Now walk the content directory to understand the
	// site map before starting the build.
	self.walkDirectory(self.contentPath, [], function(p,f,s,c){
		self.parseMetadata(p,f,s,c);
	}, function(err){
		self.metadata = self.metadataParser.sorted();
		self.performBuild(function(err, result){
			console.log("🏁  Done!");
			self.saveCache();
		});
	});
};

Shelley.prototype.walkDirectory = function(dir, path, op, cb){
	var self = this;
	if (! op instanceof Function) return console.log("No operation passed in.");

	fs.readdir(dir, function (error, list) {
		if (error) {
			if (cb instanceof Function) cb(error, null);
			return;
		}

		var i = 0;
		(function next () {
			var file = list[i++];
			if (!file) {
				return cb(null, null);
			}

			var filename = dir + '/' + file;
			fs.stat(filename, function (error, stat) {
				if (stat && stat.isDirectory()) {
				 	var aPath = path.slice();
				 	aPath.push(file);
					self.walkDirectory(filename, aPath, op, function (error) {
						next();
					});
				} else {
					op(path, file, stat, next);
				}
			});
		})();
	});
}

Shelley.prototype.parseMetadata = function(path, file, stat, cb) {
	var self = this;
	// Only pay attention to Markdown files
	if (file.search(self.mdRegex) == -1) return cb(null, null);
	
	var filename = self.constructPath(self.contentPath, path, file);
	fs.readFile(filename, 'utf8', function(err, data) {
		if (err) return console.log("ERR: " + err);
		var mtime = new Date(util.inspect(stat.mtime));
		self.metadataParser.parse(path, file, data, mtime);
		if (cb instanceof Function) cb(null, null);
	});
};

Shelley.prototype.performBuild = function(cb) {
	var self = this;
	self.copyAssetsToBuildDirectory(function(err, result){
		self.makePagesInTree(self.metadata, []);
		cb(null, null);
	});
};

Shelley.prototype.copyAssetsToBuildDirectory = function(cb) {
	var self = this;
	self.walkDirectory(self.templatePath, [], function(p,f,s,c){
		self.cacheCheckAndCopyAsset(p,f,s,c);
	}, function(err) {
		if (cb instanceof Function) cb (err);
	});
};

Shelley.prototype.makePagesInTree = function(treeSegment, path){
	var self = this;

	var dirPath = self.constructPath(self.buildPath, path, '');
	self.createDirectories(dirPath);

	for (var i = 0; i < treeSegment.pages.length; i++) {
		self.cacheCheckAndMakePage(treeSegment.pages[i], dirPath);
	}

	for (var j = 0; j < treeSegment.children.length; j++) {
		var aPath = path.slice();
		aPath.push(treeSegment.children[j].pathComponent);
		self.makePagesInTree(treeSegment.children[j], aPath);
	}
};

Shelley.prototype.cacheCheckAndMakePage = function(aPage, basePath) {
	var self = this;

	var filename = basePath + aPage.pathComponent + self.htmlEnding;
	var templateName = aPage.meta.template || self.defaultTemplate;
	if (! self.templateFiles[templateName]) templateName = self.defaultTemplate;

	var destMtime = 0;
	if (fs.existsSync(filename)) {
		var destStat = fs.statSync(filename);
		destMtime = new Date(util.inspect(destStat.mtime));
	}

	// If either file has changed…
	if ((destMtime < aPage.modified) || (self.forceRebuildTemplates[templateName])) {
		self.makePage(aPage, templateName, filename);
	}
};

Shelley.prototype.makePage = function(aPage, templateName, filename) {
	var self = this;

	console.log("🛠  Building " + filename + " using " + self.templateFiles[templateName]);

	self.frankenstein.template(self.templateFiles[templateName], aPage, function(err, html){
		if (!html) return;
		fs.writeFile(filename, html, function(writeError){

		});
	});
};

Shelley.prototype.constructPath = function(rootPath, path, file) {
	var self = this;
	return rootPath + '/' + ((path && path.length > 0) ? (path.join('/') + '/') : '') + file;
};

Shelley.prototype.cacheCheckAndCopyAsset = function(path, file, stat, cb) {
	var self = this;
	// Don't copy HTML templates.
	if (file.search(self.htmlRegex) != -1) return cb(null, null);
	if (file.search(self.ignoreRegex) != -1) return cb(null, null);

	var sourceFilename = self.constructPath(self.templatePath, path, file);
	var destFilename = self.constructPath(self.buildPath, path, file)
	
	var mtime = new Date(util.inspect(stat.mtime));
	if (self.cache[destFilename]) {
		if (mtime <= self.cache[destFilename]) {
			return cb(null,null);
		}
	}

	// Look at the target file (if present)
	fs.stat(destFilename, function (error, targetStat) {
		if (targetStat) {
			var targetMtime = new Date(util.inspect(targetStat.mtime));
			if (mtime <= targetMtime) {
				return cb(null, null);
			}
		}
		self.copyAsset(sourceFilename, destFilename, mtime, cb);
	});

};

Shelley.prototype.copyAsset = function(sourcePath, destPath, mtime, cb) {
	var self = this;

	console.log("🚚  Copying " + sourcePath + " to " + destPath);

	self.createDirectories(destPath);
	self.cache[destPath] = mtime;

	fs.readFile(sourcePath, function(readError, data){
		fs.writeFile(destPath, data, function(writeError){
		});
	});

	cb (null, null);
};

Shelley.prototype.createDirectories = function(aPath) {
	var self = this;
	var pathComponents = aPath.split('/');
	pathComponents.pop();
	var currentPath = '';
	for(var i = 0; i < pathComponents.length; i++) {
		currentPath += pathComponents[i] + '/';
		if (!fs.existsSync(currentPath)) fs.mkdirSync(currentPath);
	}
};

Shelley.prototype.getTemplateFiles = function(){
	var self = this;

	var files = fs.readdirSync(self.templatePath).sort();

	var firstTemplate = null;
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		if (file.search(self.htmlRegex) != -1) {
			var templateName = self.cleanTemplateFilename(file);
			if (firstTemplate == null) firstTemplate = templateName;
			var templateFilename = self.templatePath + '/' + file;
			var stat = fs.statSync(templateFilename);
			var mtime = new Date(util.inspect(stat.mtime));

			self.templateFiles[templateName] = templateFilename;
			if ((!self.cache[templateFilename]) ||  (self.cache[templateFilename] < mtime)) {
				self.forceRebuildTemplates[templateName] = true;
			}
			self.cache[templateFilename] = mtime;
		}
	}
	self.defaultTemplate = self.templateFiles['index'] ? 'index' : firstTemplate;
};

Shelley.prototype.cleanTemplateFilename = function(aFilename) {
	return aFilename.replace(/\.\w+$/, '').toLowerCase();
}

Shelley.prototype.getCache = function(){
	var self = this;
	var aDict = {};
	var shelleyPath = self.buildPath + '/' + self.shelleyFilename;
	if (fs.existsSync(shelleyPath)) {
		var aCache = fs.readFileSync(self.buildPath + '/' + self.shelleyFilename, 'utf8');
		if (aCache) {
			var rawDict = JSON.parse(aCache);
			var keys = Object.keys(rawDict);
			for (var i = 0; i < keys.length; i++) {
				aDict[keys[i]] = new Date(rawDict[keys[i]]);
			}
		}
	}
	self.cache = aDict;
};

Shelley.prototype.saveCache = function() {
	var self = this;
	var data = JSON.stringify(self.cache);
	fs.writeFile(self.buildPath + '/' + self.shelleyFilename, data, function(err){
	});
};

module.exports = Shelley;