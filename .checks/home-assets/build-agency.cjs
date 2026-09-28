const fs=require('node:fs'),path=require('node:path');
const {PurgeCSS}=require('purgecss'),CleanCSS=require('clean-css');
const root=path.resolve(__dirname,'../..'),entry=path.join(root,'agencia/index.html');
(async()=>{
 let html=fs.readFileSync(entry,'utf8').replace(/<style data-agency-critical>[\s\S]*?<\/style>/,'');
 const sources=['brand/tokens/tokens.css','shared/brand-derived.css','shared/products-nav.css','lp-narrador/cenas-lp/historia/historia.css','lp-narrador/cenas-lp/historia/v8.css','agencia/agencia.css'];
 const raw=sources.map(file=>fs.readFileSync(path.join(root,file),'utf8').replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(match,quote,url)=>/^(data:|https?:|\/|#)/.test(url)?match:`url("${new URL(url,'https://local/'+file).pathname}")`)).join('\n');
 const content=[{raw:html,extension:'html'},...['agencia/agencia.js','shared/card-nav.js','shared/clients-network.js'].map(file=>({raw:fs.readFileSync(path.join(root,file),'utf8'),extension:'js'}))];
 const [full]=await new PurgeCSS().purge({content,css:[{raw}],safelist:{standard:[/^is-/,/^reveal/,/^has-/,/^magic-/,/^v8-kb/,/^on$/,/^active$/]},keyframes:false,variables:false});
 const [critical]=await new PurgeCSS().purge({content:[{raw:html.slice(0,html.indexOf('<section class="v8-sec v8-claro agency-offer"')),extension:'html'}],css:[{raw}],keyframes:true,variables:false});
 const minify=css=>new CleanCSS({level:1}).minify(css).styles;
 fs.writeFileSync(path.join(root,'agencia/agencia.min.css'),minify(full.css));
 for(const file of sources)html=html.replace(new RegExp('<link rel="stylesheet" href="/'+file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?[^\"]*)?">'),'');
 html=html.replace(/<link rel="preload" as="style" href="\/agencia\/agencia.min.css"[^>]*>\s*<noscript>.*?<\/noscript>/,'');
 html=html.replace('</head>','<style data-agency-critical>'+minify(critical.css)+'</style>\n<link rel="preload" as="style" href="/agencia/agencia.min.css" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="/agencia/agencia.min.css"></noscript>\n</head>');
 fs.writeFileSync(entry,html);console.log({full:minify(full.css).length,critical:minify(critical.css).length});
})();
