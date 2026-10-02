/* Rebuild only the home CSS. Shared styles and the other pages remain independent. */
const fs=require('node:fs'),path=require('node:path');
const {PurgeCSS}=require('purgecss');
const CleanCSS=require('clean-css');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'lp-narrador/cenas-lp/historia');
const entry=path.join(root,'lp-narrador/cenas-lp/lp-v8.html');
(async()=>{
 let html=fs.readFileSync(entry,'utf8').replace(/<style>[\s\S]*?<\/style>/,'');
 const source=fs.readFileSync(path.join(dir,'home-styles.source.css'),'utf8');
 const content=[{raw:html,extension:'html'},...['v8-home.js','base-v8.js','mascote-home.js','home-contato.js','home-lazy.js','home-stepper.js'].map(f=>({raw:fs.readFileSync(path.join(dir,f),'utf8'),extension:'js'})),{raw:fs.readFileSync(path.join(root,'shared/card-nav.js'),'utf8'),extension:'js'}];
 const [full]=await new PurgeCSS().purge({content,css:[{raw:source}],safelist:{standard:[/^on$/,/^in$/,/^playing$/,/^visible$/,/^active$/,/^open$/,/^no-/,/^cp-/,/^calib/,/^v8-kb/,/^hs-cursor/,/^is-/,/^em-/,/^sem-/,/^drag/,/^brinca/,/^fx-/]},keyframes:false,variables:false});
 const [hero]=await new PurgeCSS().purge({content:[{raw:html.slice(0,html.indexOf('<div id="fluxo">')),extension:'html'}],css:[{raw:source}],safelist:[/^no-/,/^in$/,/^playing$/],keyframes:true,fontFace:true});
 const faces=(source.match(/@font-face\s*\{[^}]*\}/g)||[]).join('\n');
 const minify=css=>{const r=new CleanCSS({level:1}).minify(css);if(r.errors.length)throw Error(r.errors.join('\n'));return r.styles;};
 const fullCSS=minify(full.css.replace(/@font-face\s*\{[^}]*\}/g,''));
 const critical=minify(faces+hero.css.replace(/@font-face\s*\{[^}]*\}/g,''));
 fs.writeFileSync(path.join(dir,'home.min.css'),fullCSS);
 fs.writeFileSync(entry,html.replace('</head>','<style>'+critical+'</style>\n</head>'));
 console.log(JSON.stringify({homeCSS:fullCSS.length,criticalCSS:critical.length}));
})();
