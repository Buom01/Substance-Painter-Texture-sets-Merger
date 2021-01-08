/*
 *	Substance Painter Texture sets Merger by Buom_01
 *
 *	Don't forget to install ImageMagick.
 *	This script should be ran with Node.JS
 *
 *	Generate opacity filter images by exporting using the pseudo-template named:
 *	"Document channels + Normal + AO (With Alpha)"
 *
 *	You may have to tweak regex according to template you use
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const child_process = require('child_process');


/*
 *	Here are the configuration
 */

const filterRegex = /_Base_Color\./;
const imageRegex = /\.png$/;
const mapTextureRegex = /^[a-z]*_[a-z]*_[a-z]*\./i;

// In parenthesis the part we want
const meshCatcher = /^([a-z]*)_[a-z]*_[a-z]*\./i;
const materialCatcher = /^[a-z]*_([a-z]*)_[a-z]*\./i;
const mapCatcher = /^[a-z]*_[a-z]*_([a-z]*)\./i;

// Simple getter to recompose the files names
const getFilterImage = (mesh, material) => (`${material}_Base_Color.png`);
const getMapImage = (mesh, material, map) => (`${mesh}_${material}_${map}.png`);
const getMeshMapImage = (mesh, map) => (`${mesh}_${map}.png`);  // output

// Other parameters
const tmpDir = "./tmp/";  // Where intermediate image will be created
const outputDir = "./out/";  // Where intermediate image will be created
const prefix = "_";  // For intermediate image, usefull if tmpDir is PWD

/*
 *	Bellow is the code. You shouldn't modify it.
 */

const pwd = process.cwd();
const files = fs.readdirSync(pwd);

if (!fs.existsSync(tmpDir))
	fs.mkdirSync(tmpDir);
if (!fs.existsSync(outputDir))
	fs.mkdirSync(outputDir);

var meshesInfos = {};

files.forEach((filename) => {
	if (!filename.match(imageRegex)
			|| filename.match(filterRegex)
			|| !filename.match(mapTextureRegex))
		return;
	const mesh = filename.match(meshCatcher)[1];
	const material = filename.match(materialCatcher)[1];
	const map = filename.match(mapCatcher)[1];
	if (!meshesInfos[mesh])
	{
		meshesInfos[mesh] = {
		};
	}
	if (!meshesInfos[mesh][material])
		meshesInfos[mesh][material] = [];
	if ( meshesInfos[mesh][material].indexOf(map) == -1 )
		meshesInfos[mesh][material].push(map);
});

Object.keys(meshesInfos).forEach((mesh) => {
	var possiblesMap = [];

	Object.keys(meshesInfos[mesh]).forEach((material) => {
		const filterImage = getFilterImage(mesh, material);

		meshesInfos[mesh][material].forEach((map) => {
			const mapImage = getMapImage(mesh, material, map);
			const output = path.join(tmpDir, prefix + mapImage);

			child_process.execSync(
				`composite -compose CopyOpacity ${filterImage} ${mapImage} ${output}`,
				{timeout: 30000}
			);
		});

		possiblesMap = possiblesMap.concat(meshesInfos[mesh][material]);
		possiblesMap = possiblesMap.filter(
			(item, pos) => (possiblesMap.indexOf(item) == pos)
		);
	});

	possiblesMap.forEach((map) => {
		const output = path.join(outputDir, getMeshMapImage(mesh, map));
		var materials = [];

		// Only get materials which have the requested map
		// as some material haven't emissive/opacity map
		Object.keys(meshesInfos[mesh]).forEach((material) => {
			if (meshesInfos[mesh][material].indexOf(map) != -1)
				materials.push(material);
		});

		const materialsMapImages = materials.map(
			(material) => path.join(tmpDir, prefix + getMapImage(mesh, material, map))
		);
		child_process.execSync(
			`convert -flatten ${materialsMapImages.join(' ')} ${output}`,
			{timeout: 30000}
		);
	});

});

//
