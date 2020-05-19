/*
 * Fetches sourcecode from compiled contracts in build/contracts folder and stores in a single folder
 */
const rimraf = require('rimraf');
const fs = require('fs');

const buildFolder = './build/contracts/';
const srcFolder = './build/src/';

rimraf.sync(srcFolder);
fs.mkdirSync(srcFolder);

fs.readdirSync(buildFolder).forEach(file => {
  console.log('Extracting sourcecode for', file);
  const name = file.replace('.json', '.sol');
  fs.writeFileSync(`${srcFolder}${name}`, JSON.parse(fs.readFileSync(`${buildFolder}${file}`)).source, {
    encoding: 'utf-8'
  });
});

console.log('done');
