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
const File = require('./File.js')
const Cache = require('./Cache.js')
const Utils = require('./Utils.js')


const Shelley = function(options){
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

	this.mdRegex = new RegExp(/\.(?:md|markdown|txt)$/i)
	this.htmlRegex = new RegExp(/\.(?:x?html?)$/i)
	this.ignoreRegex = new RegExp(/^\.|\s/)
	this.metadata = []

	this.shelleyFilename = 'cache.json'
	this.htmlEnding = '.html'
	this.metadataParser = new MetadataParser()
	this.frankenstein = new Frankenstein()

	this.templates = {}
	this.templateFiles = {}
	this.forceRebuildTemplates = {}
};

Shelley.prototype.build = function(){
	const self = this;

	const cacheData = self.getCache(self.shelleyPath, self.shelleyFilename)
	self.cache = new Cache(cacheData)

	self.makeDirectories(self.buildPath.split('/'))
	self.makeDirectories(self.shelleyPath.split('/'))

	PutStuffHere.shared().shouldExtractBody = false

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
		.map(function(doc, i, docs){ return self.setIsIndexFor(doc, docs) })
		.filter(function(doc){ return self.shouldBuildDocument(doc)})
		.forEach(function(doc, i, docs){ self.buildDocument(doc) })

	self.saveCache(self.shelleyPath, self.shelleyFilename)
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
		aDict[key] = new Date(rawDict[key]);
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

	return self.shouldRefresh(docPath, self.latest(doc.file.mtime, template.file.mtime))
}

Shelley.prototype.latest = function(aDate, bDate) {
	return aDate > bDate ? aDate : bDate
}

Shelley.prototype.buildDocument = function(doc) {
	const self = this

	const template = self.templateFor(doc)
	const filePath = doc.filePath(self.buildPath, self.htmlEnding)

	const html = self.frankenstein.template(template, doc)

	const dirPath = (self.buildPath + '/' + doc.directoryPath).split('/')

	console.log("🛠  Building " + filePath);

	self.makeDirectories(dirPath)
	fs.writeFileSync(filePath, html)

	self.cache.setMtime(filePath, self.latest(doc.file.mtime, template.file.mtime ))
}

Shelley.prototype.shouldRefresh = function(buildFilename, mtime) {
	const self = this
	const cachedMtime = self.cache.getMtime(buildFilename)
	if (!cachedMtime || (cachedMtime < mtime)) { return true }

	let stat = null
	try {
		stat = fs.statSync(buildFilename)
	} catch(e) {
		console.log("🤷‍♂️ Build file doesn't exist. We should refresh.")
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

Shelley.prototype.setIsIndexFor = function(aDoc, allDocs) {
	const self = this

	if (aDoc.fileComponent === 'index') { 
		aDoc.isIndex = true
		return aDoc
	}

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

module.exports = Shelley;