Shelley.prototype.directoryTree = function(dir, path){
	const self = this
	return fs
		.readdirSync(dir)
		.map(function(file){
			const filename = dir + '/' + file
			const stat = fs.statSync(filename)
			if (stat.isDirectory()) {
				const newPath = path.slice().concat([file])
				const files = self.directoryTree(filename, newPath)
				return new Directory({
					filename: file,
					path: newPath,
					files: files
				})
			} else {
				return new File({
					filename: file,
					path: path,
					mtime: new Date(util.inspect(stat.mtime))
				})
			}
		})
}