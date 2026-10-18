// Run the slab regression section without the long terrain/ecosystem suite.
const fs=require('node:fs');
const src=fs.readFileSync(__dirname+'/check.cjs','utf8'),marker='// ---- v20 slabs:';
if(!src.includes(marker))throw Error('Slab regression section missing');
new Function('require','__dirname',src.split('// ---- New GRAND')[0]+src.slice(src.indexOf(marker)))(require,__dirname);
