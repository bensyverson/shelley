'use strict'

const fs = require('fs')
const util = require('util')

const File = require('./File.js')

const Utils = function(){}

Utils.flatmap = function(array) {
	return array
		.map(function(a){ if (a instanceof Array) return a; return [a]})
		.reduce(function(a,b){ return a.concat(b) })
}


Utils.areArraysEqual = function(a, b) {
	if (a === b) { return true }
	if (!((a instanceof Array) && (b instanceof Array))) { throw Error("Called `areArraysEqual` on non-array") }
	if (a.length != b.length) { return false }

	return a.reduce(function(val, el, i){
		return (val && b[i] == el)
	}, true)
}

Utils.files = function(dir, path){
	return Utils.flatmap(fs
		.readdirSync(dir)
		.map(function(file){
			const filename = dir + '/' + file
			const stat = fs.statSync(filename)
			if (stat.isDirectory()) {
				const newPath = path.slice().concat([file])
				return Utils.files(filename, newPath)
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

module.exports = Utils