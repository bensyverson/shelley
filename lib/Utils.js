'use strict'

const Utils = function(){}

Utils.flatmap = function(array) {
	return array
		.map(function(a){ if (a instanceof Array) return a; return [a]})
		.reduce(function(a,b){ return a.concat(b) })
}

module.exports = Utils