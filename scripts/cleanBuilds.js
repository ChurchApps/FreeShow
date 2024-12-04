const {
	existsSync,
	readdirSync,
	lstatSync,
	unlinkSync,
	rmdirSync,
} = require("node:fs");
const { join } = require("node:path");

// app build file paths
const buildSveltePath = join(__dirname, "..", "public", "build");
const buildElectronPath = join(__dirname, "..", "build"); // this includes server files

// delete folders and all of it's content
deleteFolderRecursive(buildSveltePath);
deleteFolderRecursive(buildElectronPath);
deletePublicFile("preload.ts");
deletePublicFile("preload.js.map");

function deleteFolderRecursive(folderPath) {
	if (!existsSync(folderPath)) return;

	readdirSync(folderPath).forEach((file) => {
		const path = join(folderPath, file);
		const isFolder = lstatSync(path).isDirectory();
		if (isFolder) return deleteFolderRecursive(path);

		// delete file
		unlinkSync(path);
	});

	rmdirSync(folderPath);
}

function deletePublicFile(fileName) {
	const publicPath = join(__dirname, "..", "public");
	const filePath = join(publicPath, fileName);
	if (!existsSync(filePath)) return;

	unlinkSync(filePath);
}
