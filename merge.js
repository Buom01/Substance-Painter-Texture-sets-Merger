/*
 *	Substance Painter Texture sets Merger by Buom_01
 *
 *	Don't forget to install ImageMagick.
 *	This script should be ran with Node.JS
 *
 *	To generate opacity filter images, you have to:
 *	1. Use a shader with alpha blending
 *	2. Add opacity channel to all your textures
 *	3. Add an opacity fill layer on all your texture
 *	4. Exporting Base_Color/Diffusion with alpha
 *	5. Enable "Diffusion + transparent" and set any value which is fine for you.
 *
 *	You may have to tweak regex according to template you use.
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
const mapTextureRegex = /^[a-z]+_[a-z]+_.+\./i;

// In parenthesis the part we want
const meshCatcher = /^([a-z]+)_[a-z]+_.+\./i;
const materialCatcher = /^[a-z]+_([a-z]+)_.+\./i;
const mapCatcher = /^[a-z]+_[a-z]+_(.+)\./i;

// Simple getter to recompose the files names
const getFilterImage = (mesh, material) => (`${mesh}_${material}_Base_Color.png`);
const getMapImage = (mesh, material, map) => (`${mesh}_${material}_${map}.png`);
const getMeshMapImage = (mesh, map) => (`${mesh}_${map}.png`);  // output

// Other parameters
const tmpDir = "./tmp/";  // Where intermediate image will be created
const outputDir = "./out/";  // Where intermediate image will be created
const prefix = "_";  // For intermediate image, usefull if tmpDir is PWD

/*
 *	Bellow is the code. You shouldn't modify it.
 */

console.log("Detecting meshes, materials, and texture maps...");

const pwd = process.cwd();
const files = fs.readdirSync(pwd);

if (!fs.existsSync(tmpDir))
	fs.mkdirSync(tmpDir);
if (!fs.existsSync(outputDir))
	fs.mkdirSync(outputDir);

var meshesInfos = {};

files.forEach((filename) => {
	if (!filename.match(imageRegex)
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

console.log("Detected as Mesh -> Material -> Texture Map:");
console.log(meshesInfos);

function hasAlpha(map)
{
	if (map.match(/Color|Diffuse/i))
		return "on";
	else
		return "off";
}

Object.keys(meshesInfos).forEach((mesh) => {
	var possiblesMap = [];

	console.log("Masking each texture map...");

	Object.keys(meshesInfos[mesh]).forEach((material) => {
		const filterImage = getFilterImage(mesh, material);

		meshesInfos[mesh][material].forEach((map) => {
			const mapImage = getMapImage(mesh, material, map);
			const output = path.join(tmpDir, prefix + mapImage);

			if (filterImage == mapImage)
			{
				fs.copyFileSync(filterImage, output);
			}
			else
			{
				child_process.execSync(
					`magick composite -compose CopyOpacity ${filterImage} ${mapImage} ${output}`,
					{timeout: 30000}
				);
			}
		});

		possiblesMap = possiblesMap.concat(meshesInfos[mesh][material]);
		possiblesMap = possiblesMap.filter(
			(item, pos) => (possiblesMap.indexOf(item) == pos)
		);
	});

	console.log("Combining...");

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
			`magick convert -background transparent -flatten ${materialsMapImages.join(' ')} ${output}`,
			{timeout: 30000}
		);
		if (hasAlpha(map) == "off")
		{
			child_process.execSync(
				`magick convert ${output} -alpha ${hasAlpha(map)} ${output}`,
				{timeout: 30000}
			);
		}
	});

});
