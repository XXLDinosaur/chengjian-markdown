const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync('dist', { recursive: true });
fs.copyFileSync('src/rich.html', 'dist/index.html');
const css=['src/style.css', 'src/rich.css', 'src/glass.css', 'src/document-ui.css'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
fs.writeFileSync('dist/style.css',esbuild.transformSync(css,{loader:'css',minify:true}).code);
const common={bundle:true,minify:true,metafile:true};
const results=[
 esbuild.buildSync({ ...common,entryPoints: ['src/rich-editor.js'], outfile: 'dist/renderer.js', platform: 'browser', target: 'chrome140' }),
 esbuild.buildSync({ ...common,entryPoints: ['src/core.mjs'], outfile: 'dist/document.cjs', platform: 'node', format: 'cjs', target: 'node22' })
];
// Dependencies are compiled into the bundles. Ship their license texts, rather
// than duplicating their source trees and build artifacts in node_modules.
const packages=new Map();
for(const result of results)for(const input of Object.keys(result.metafile.inputs)){
 if(!input.replaceAll('\\','/').includes('node_modules/'))continue;
 let directory=path.dirname(path.resolve(input));
 while(directory!==path.dirname(directory)){
  const manifest=path.join(directory,'package.json');
  if(fs.existsSync(manifest)){const data=JSON.parse(fs.readFileSync(manifest,'utf8'));if(data.name){packages.set(directory,data);break;}}
  directory=path.dirname(directory);
 }
}
const notices=[];
for(const [directory,data] of [...packages].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
 const licenses=fs.readdirSync(directory).filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name)&&fs.statSync(path.join(directory,name)).isFile());
 if(!licenses.length)throw new Error(`Missing license text for bundled package ${data.name}`);
 notices.push(`${data.name} ${data.version}\n${licenses.map(name=>fs.readFileSync(path.join(directory,name),'utf8')).join('\n')}`);
}
fs.writeFileSync('dist/THIRD-PARTY-NOTICES.txt',notices.join('\n\n----------------------------------------\n\n'));
