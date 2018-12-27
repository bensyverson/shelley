'use strict';

// System
const fs = require('fs')
const util = require('util')

// 1st Party
const MetadataParser = require('./MetadataParser.js')
const Frankenstein = require('./Frankenstein.js')
const Template = require('./Template.js')
const Directory = require('./Directory.js')
const File = require('./File.js')
const Cache = require('./Cache.js')
const Utils = require('./Utils.js')


const Shelley = function(options){
	this.templatePath = 'templates'
	this.contentPath = 'content'
	this.buildPath = 'build'

	if (options) {
		this.templatePath	= options.template || this.templatePath
		this.contentPath	= options.content || this.contentPath
		this.buildPath		= options.build || this.buildPath
	}

	this.mdRegex = new RegExp(/\.(?:md|markdown|txt)$/i)
	this.htmlRegex = new RegExp(/\.(?:x?html?)$/i)
	this.ignoreRegex = new RegExp(/^\.|\s/)
	this.metadata = []

	this.shelleyFilename = 'shelley.json'
	this.htmlEnding = '.html'
	this.metadataParser = new MetadataParser()
	this.frankenstein = new Frankenstein()

	this.templates = {}
	this.templateFiles = {}
	this.forceRebuildTemplates = {}
	this.defaultTemplate = null
};

Shelley.prototype.build = function(){
	const self = this;

	const cacheData = self.getCache(self.buildPath, self.shelleyFilename)
	self.cache = new Cache(cacheData)

	const templateFiles = self.files(self.templatePath, [])
	templateFiles
		.filter(function(file){ return self.isHTML(file.filename) })
		.map(function(file){ return new Template({ file: file }) })
		.forEach(function(template){ self.templates[template.file.filename] = template })

	templateFiles
		.filter(function(file){ return self.isAsset(file.filename) })
		.filter(function(file){ return self.shouldCopyAsset(file) })
		.forEach(function(file){ self.copyAsset(file) })

	self.files(self.contentPath, [])
		.filter(function(file){ return self.isMarkdown(file.filename) })
		.map(function(file){ return self.metadataParser.parseFlat(file) })
		.filter(function(doc){ return self.shouldBuildDocument(doc)})
		.forEach(function(doc){ self.buildDocument(doc) })

	self.cache.save(self.buildPath + "/" + self.shelleyFilename)
}

Shelley.prototype.getCache = function(buildPath, shelleyFile){
	const shelleyPath = buildPath + '/' + shelleyFile
	if (!fs.existsSync(shelleyPath)) { return {} }

	const aCache = fs.readFileSync(shelleyPath, 'utf8')
	const rawDict = JSON.parse(aCache)

	let aDict = {}
	Object.keys(rawDict).forEach(function(key){
		aDict[key] = new Date(rawDict[key]);
	})
	return aDict
}

Shelley.prototype.shouldCopyAsset = function(file) {
	const self = this
	return self.shouldRefresh(file.filePath(self.buildPath), file.mtime)
}

Shelley.prototype.shouldBuildDocument = function(doc) {
	const self = this

	const template = self.templateFor(doc)

	if (doc.file.mtime < template.file.mtime) { return true }

	const docPath = doc.filePath(self.buildPath, self.htmlEnding)

	return self.shouldRefresh(docPath, file.mtime)
}

Shelley.prototype.buildDocument = function(doc) {
	const self = this
	console.log("Wanting to build " + doc.filePath)
}

Shelley.prototype.shouldRefresh = function(buildFilename, mtime) {
	const self = this
	const cachedMtime = self.cache.getMtime(buildFilename)
	if (!cachedMtime || (cachedMtime < mtime)) { return true }

	const stat = fs.statSync(buildFilename)
	const buildMtime = new Date(util.inspect(stat.mtime))

	return (buildMtime < mtime)
}

Shelley.prototype.isHTML = function(filename) {
	const self = this
	return (filename.search(self.htmlRegex) != -1)
}

Shelley.prototype.isMarkdown = function(filename) {
	const self = this
	return (filename.search(self.mdRegex) != -1)
}

Shelley.prototype.isIgnorable = function(filename) {
	const self = this
	return (filename.search(self.ignoreRegex) != -1)
}

Shelley.prototype.isAsset = function(filename) {
	const self = this
	return (!self.isHTML(filename)) && (!self.isIgnorable(filename))
}

Shelley.prototype.files = function(dir, path){
	const self = this
	return Utils.flatmap(fs
		.readdirSync(dir)
		.map(function(file){
			const filename = dir + '/' + file
			const stat = fs.statSync(filename)
			if (stat.isDirectory()) {
				const newPath = path.slice().concat([file])
				return self.files(filename, newPath)
			} else {
				return [new File({
					filename: file,
					path: path,
					originalFile: filename,
					mtime: new Date(util.inspect(stat.mtime))
				})]
			}
		}))
}


Shelley.prototype.makePagesInTree = function(treeSegment, path){
	const self = this

	const dirPath = self.constructPath(self.buildPath, path, '');
	self.createDirectories(dirPath);

	for (var i = 0; i < treeSegment.pages.length; i++) {
		self.cacheCheckAndMakePage(treeSegment.pages[i], dirPath);
	}

	for (var j = 0; j < treeSegment.children.length; j++) {
		var aPath = path.slice();
		aPath.push(treeSegment.children[j].pathComponent);
		self.makePagesInTree(treeSegment.children[j], aPath);
	}
}

Shelley.prototype.templateFor = function(doc) {
	const self = this
	let templateName = doc.meta.template
	if (! self.templates[templateName]) { templateName = self.defaultTemplate }

	const template = self.templates[templateName]
	if (! template) throw Error("Couldn't get template " + templateName)
	return template
}

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


Shelley.prototype.copyAsset = function(file) {
	const self = this

	const destPath = [self.buildPath].concat(file.path)
	self.makeDirectories(destPath)

	const sourceFilePath = file.filePath(self.buildPath)
	const destFilePath = file.filePath(self.buildPath)

	console.log("🚚  Copying " + file.filename + " to " + destFilePath)

	fs.writeFileSync(destFilePath, file.contents)
	self.cache.setMtime(destFilePath, file.mtime)
}

Shelley.prototype.makeDirectories = function(path) {
	const self = this
	path.forEach(function(pathComponent, i){
		const currentPath = path.slice(0, i + 1).join('/')
		if (!fs.existsSync(currentPath)) { fs.mkdirSync(currentPath) }
	})
}



Shelley.prototype.cleanTemplateFilename = function(aFilename) {
	return aFilename.replace(/\.\w+$/, '').toLowerCase();
}


module.exports = Shelley;