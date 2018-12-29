'use strict';

// System
const fs = require('fs')
const util = require('util')
const PutStuffHere = require('putstuffhere')

// 1st Party
const MetadataParser = require('./MetadataParser.js')
const Frankenstein = require('./Frankenstein.js')
const Template = require('./Template.js')
const Directory = require('./Directory.js')
const Cache = require('./Cache.js')
const Utils = require('./Utils.js')


const Shelley = function(options){
	const self = this
	this.templatePath = 'templates'
	this.contentPath = 'content'
	this.buildPath = 'build/dist'
	this.shelleyPath = 'build'

	if (options) {
		this.templatePath	= options.template || this.templatePath
		this.contentPath	= options.content || this.contentPath
		this.buildPath		= options.build || this.buildPath
		this.shelleyPath	= options.shelley || this.shelleyPath
	}

	self.makeDirectories(self.buildPath.split('/'))
	self.makeDirectories(self.shelleyPath.split('/'))

	this.mdRegex = new RegExp(/\.(?:md|markdown|txt)$/i)
	this.htmlRegex = new RegExp(/\.(?:x?html?)$/i)
	this.ignoreRegex = new RegExp(/^\.|\s/)
	// Assets must be placed in a subdirectory of /templates
	this.assetPathRegex = new RegExp(/"((?:(?:[\w-]+)\/)+)([\w-]+\.[\w]+)/g)
	// Document links must be in the form `href="blah"`
	this.hrefRegex = new RegExp(/href\s*=\s*"([\w-/]*?)([\w-]+(?:\.[\w]+))?"/gi)
	this.mdLinkRegex = new RegExp(/\[([^()]+)\]\(((?:(?:[\w-]+|\.\.)+\/)*)(\/|[\w-]+(?:\.[\w]+)?)?\)/gi)

	this.shelleyFilename = 'cache.json'
	this.htmlEnding = '.html'
	this.metadataParser = new MetadataParser()
	this.frankenstein = new Frankenstein()

	this.templates = {}
	this.assets = []
	this.documents = []
};

Shelley.prototype.build = function(){
	const self = this;

	self.cache = new Cache(self.getCache(self.shelleyPath, self.shelleyFilename))

	const templateFiles = Utils.files(self.templatePath, [])
	const contentFiles = Utils.files(self.contentPath, [])

	self.assets = templateFiles
		.concat(contentFiles)
		.filter(function(file){ return self.isAsset(file.filename) })
		.map(function(file){ return {file: file} })

	self.documents = contentFiles
		.filter(function(file){ return self.isMarkdown(file.filename) })
		.map(function(file){ return self.metadataParser.document(file) })
		.map(function(doc, i, docs){ return self.setIsIndexFor(doc, docs) })

	self.getTemplates(templateFiles)
	
	self.copyAssets()
	self.buildDocuments()
	self.saveCache(self.shelleyPath, self.shelleyFilename)
}

Shelley.prototype.getTemplates = function(templateFiles) {
	const self = this
	PutStuffHere.shared().shouldExtractBody = false
	templateFiles
		.filter(function(file){ return self.isHTML(file.filename) })
		.forEach(function(file){ self.templates[file.filename] = file })
}

Shelley.prototype.copyAssets = function() {
	const self = this
	self.assets
		.filter(function(file){ return self.shouldCopyAsset(file.file) })
		.forEach(function(file){ self.copyAsset(file.file) })
}

Shelley.prototype.buildDocuments = function() {
	const self = this
	self.documents
		.filter(function(doc){ return self.shouldBuildDocument(doc)})
		.forEach(function(doc, i, docs){ self.buildDocument(doc) })
}

Shelley.prototype.defaultTemplate = function(){
	const self = this
	if (self.templates['index.html']) { return self.templates['index.html'] }
	return self.templates[Object.keys(self.templates).sort()[0]]
}

Shelley.prototype.getCache = function(buildPath, shelleyFile){
	const shelleyPath = buildPath + '/' + shelleyFile
	if (!fs.existsSync(shelleyPath)) { return {} }

	const aCache = fs.readFileSync(shelleyPath, 'utf8')
	const rawDict = JSON.parse(aCache)

	let aDict = {}
	Object.keys(rawDict).forEach(function(key){
		aDict[key] = new Date(rawDict[key])
	})
	return aDict
}

Shelley.prototype.saveCache = function(path, shelleyFile) {
	const self = this
	self.makeDirectories(path.split('/'))
	self.cache.save(path + '/' + shelleyFile)
}

Shelley.prototype.shouldCopyAsset = function(file) {
	const self = this
	return self.shouldRefresh(file.filePath(self.buildPath), file.mtime)
}

Shelley.prototype.shouldBuildDocument = function(doc) {
	const self = this

	const template = self.templateFor(doc)
	const docPath = doc.filePath(self.buildPath, self.htmlEnding)

	return self.shouldRefresh(docPath, self.latest(doc.file.mtime, template.mtime))
}

Shelley.prototype.latest = function(aDate, bDate) {
	return aDate > bDate ? aDate : bDate
}

Shelley.prototype.buildDocument = function(doc) {
	const self = this

	const template = self.templateFor(doc)

	// First, relink assets in templates (src="images/me.jpg" => src="../../images/me.jpg")
	const withAssets = self.linkAssets( template.contents, doc )
	// Then, update links in templates (href="about.html" => href="../about.html")
	const withDocs = self.linkDocs( withAssets, doc )
	// Next, relink markdown links and images; [About](about.md) => [About](../about.html)
	doc.body = self.linkMarkdown( doc.body, doc )

	const html = self.frankenstein.template(withDocs, doc)

	const filePath = doc.filePath(self.buildPath, self.htmlEnding)
	const dirPath = (self.buildPath + '/' + doc.directoryPath).split('/')

	console.log("🛠  Building " + filePath)
	self.makeDirectories(dirPath)
	fs.writeFileSync(filePath, html)
	self.cache.setMtime(filePath, self.latest(doc.file.mtime, template.mtime ))
}

Shelley.prototype.linkAssets = function(text, doc) {
	const self = this
	return text.replace(self.assetPathRegex, function(match, path, file){
		const asset = self.fileAt(path, file, self.assets, '')
		if (!asset) { return match }
		return '"' + "../".repeat(doc.path.length - 1) + path + file
	})
}

Shelley.prototype.linkMarkdown = function(text, doc) {
	const self = this
	const originalPath = doc.file.path.join('/')
	return text.replace(self.mdLinkRegex, function(match, name, path, file){
		const linkedDoc = self.fileAt(path, file, self.documents, originalPath)
		if (!linkedDoc) {return match }
		return '[' + name + '](' + self.pathTo(linkedDoc.filePath('', '.html'), doc.filePath('', '.html')) + ')'
	})
}

Shelley.prototype.linkDocs = function(text, doc) {
	const self = this
	const docPath = doc.path.join('/')
	return text.replace(self.hrefRegex, function(match, path, file){
		let filename = (file != undefined) ? file : 'index.html'
		const linkedDoc = self.docAt(path, filename, self.documents, docPath)
		if (!linkedDoc) {return match }
		return 'href="' + self.pathTo(linkedDoc.filePath('', '.html'), docPath) + '"'
	})
}

Shelley.prototype.pathTo = function(path, relativeToPath) {
	const self = this

	let toPath = path.split('/').filter(function(el){ return el != '' })
	let fromPath = relativeToPath.split('/').slice(0,-1).filter(function(el){ return el != '' })

	while (fromPath[0] && (fromPath[0] == toPath[0])) {
		fromPath = fromPath.slice(1)
		toPath = toPath.slice(1)
	}

	return new Array(fromPath.length)
		.fill('..')
		.concat(toPath)
		.join('/')
}

Shelley.prototype.constructPathArray = function(fromPath, toPath) {
	let pathArray = toPath.split('/').filter(function(el){ return el != '' })
	let relativePath = fromPath.split('/').filter(function(el){ return el != ''})

	while (pathArray[0] == '..') {
		pathArray = pathArray.slice(1)
		relativePath.pop()
	}
	return relativePath.concat(pathArray)
}

Shelley.prototype.docAt = function(path, file, inArray) {
	const self = this
	const pathArray = path.split('/').filter(function(el){ return el != '' })
	return inArray.filter(function(doc){
		return Utils.areArraysEqual(pathArray, doc.path.slice(0,-1)) && doc.buildFilename(self.htmlEnding) == file
	})[0]
}

Shelley.prototype.fileAt = function(path, file, inArray, relativePath) {
	const self = this
	const pathArray = self.constructPathArray(relativePath, path)
	return inArray.filter(function(asset){
		return Utils.areArraysEqual(pathArray, asset.file.path) && asset.file.filename == file
	})[0]
}

Shelley.prototype.shouldRefresh = function(buildFilename, mtime) {
	const self = this
	const cachedMtime = self.cache.getMtime(buildFilename)
	if (!cachedMtime || (cachedMtime < mtime)) { return true }

	let stat = null
	try {
		stat = fs.statSync(buildFilename)
	} catch(e) {
		return true
	}
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
	return (!self.isHTML(filename)) && 
		(!self.isMarkdown(filename)) && 
		(!self.isIgnorable(filename))
}

Shelley.prototype.setIsIndexFor = function(aDoc, allDocs) {
	const self = this

	if (aDoc.fileComponent === 'index') { aDoc.isIndex = true; return aDoc }

	let first = allDocs
		.filter(function(doc){ return aDoc.directoryPath == doc.directoryPath })
		.sort(function(a,b){ return a.sortName().localeCompare(b.sortName()) })[0]

	aDoc.isIndex = (first === aDoc)
	return aDoc
}

Shelley.prototype.templateFor = function(doc) {
	const self = this
	let templateName = doc.meta.template
	if (! self.templates[templateName]) { return self.defaultTemplate() }

	const template = self.templates[templateName]
	if (! template) throw Error("Couldn't get template " + templateName)
	return template
}

Shelley.prototype.copyAsset = function(file) {
	const self = this

	self.makeDirectories([self.buildPath].concat(file.path))
	const destFilePath = file.filePath(self.buildPath)

	console.log("🚚  Copying " + file.filename + " to " + destFilePath)
	fs.copyFileSync(file.originalFile, destFilePath)
	self.cache.setMtime(destFilePath, file.mtime)
}

Shelley.prototype.makeDirectories = function(path) {
	const self = this
	path.forEach(function(pathComponent, i){
		const currentPath = path.slice(0, i + 1).join('/')
		if (!fs.existsSync(currentPath)) { fs.mkdirSync(currentPath) }
	})
}

module.exports = Shelley
