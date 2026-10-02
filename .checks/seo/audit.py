"""Audit indexable pages using only the standard library. Run from repository root."""
import json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
class Page(HTMLParser):
 def __init__(self):super().__init__();self.h1=0;self.meta={};self.canonical='';self.refs=[];self.images=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='h1':self.h1+=1
  if 'id' in a:self.ids.append(a['id'])
  if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href','')
  if tag in ['a','link','img','script','source','video']:
   self.refs.extend(a[k] for k in ['href','src','poster'] if a.get(k,'').startswith('/'))
  if tag=='img':self.images.append(a)
def local(route):
 if route=='/':return Path('lp-narrador/cenas-lp/lp-v8.html')
 p=Path(unquote(route).lstrip('/'));return p/'index.html' if p.is_dir() else p
errors=[];titles=set()
urls=[e.text for e in ET.parse('sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
for url in urls:
 p=local(urlsplit(url).path)
 if not p.exists():errors.append(f'{url}: missing page');continue
 text=p.read_text(encoding='utf-8');page=Page();page.feed(text)
 def check(test,message):
  if not test:errors.append(f'{p}: {message}')
 check(page.h1==1,'expected one H1');check(page.canonical==url,'canonical mismatch')
 for tag in ['description','og:title','og:description','og:image','twitter:card']:check(bool(page.meta.get(tag)),f'missing {tag}')
 title=re.search(r'<title>(.*?)</title>',text,re.S).group(1);check(title not in titles,'duplicate title');titles.add(title)
 check('noindex' not in page.meta.get('robots',''),'indexable page has noindex')
 check(all('alt' in im for im in page.images),'image without alt')
 for ref in set(page.refs):
  route=urlsplit(ref).path
  if route.startswith('/diagnostico-de-sistema/'):continue # permanent redirect retained for historical inbound links
  check(local(route).exists(),f'missing internal asset/link: {ref}')
 for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',text,re.S):json.loads(raw)
check('Sitemap: https://www.notechstack.com.br/sitemap.xml' in Path('robots.txt').read_text(),'robots sitemap missing')
if errors:print('\n'.join(errors));sys.exit(1)
print(f'PASS: {len(urls)} sitemap pages; unique titles, H1, metadata, canonical, JSON-LD, alt text and local links/assets.')
