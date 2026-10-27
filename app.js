/* Looptools: shared script for every page */
let PDFDocument,StandardFonts,rgb,degrees;
const $=(s,e=document)=>e.querySelector(s);
const h=x=>{const d=document.createElement('div');d.innerHTML=x.trim();return d.firstChild};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ico=n=>`<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const bar=v=>{const b=$('#bar');if(b)b.style.width=(v*100)+'%'};
const buf=f=>f.arrayBuffer();
const fmt=n=>n>1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
function toast(m,err){const t=h('<div class="toast'+(err?' err':'')+'"></div>');t.textContent=m;$('#toasts').append(t);setTimeout(()=>t.remove(),4500)}
function save(data,name,type='application/pdf'){const b=data instanceof Blob?data:new Blob([data],{type});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}
async function run(fn){try{await fn()}catch(e){console.error(e);toast(/encrypt|password/i.test(e.message)?'This PDF is password-protected, so it can’t be opened.':'Something went wrong: '+e.message,1)}finally{bar(0)}}
function drop(host,{accept,multiple,label,cb}){
 const z=h(`<label class="drop"><input type="file" hidden ${multiple?'multiple':''} accept="${accept}"><b>${label}</b><span>or drag and drop here</span></label>`);
 const go=fs=>{fs=[...fs];if(fs.length)run(()=>cb(fs))};const i=$('input',z);
 i.onchange=()=>{go(i.files);i.value=''};
 ['dragover','dragenter'].forEach(e=>z.addEventListener(e,v=>{v.preventDefault();z.classList.add('on')}));
 ['dragleave','drop'].forEach(e=>z.addEventListener(e,v=>{v.preventDefault();z.classList.remove('on')}));
 z.addEventListener('drop',v=>go(v.dataTransfer.files));host.append(z);return z}
function ranges(s,max){const o=[];for(const p of s.split(',')){const m=p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)throw Error('Invalid range “'+p.trim()+'”');const a=+m[1],b=+(m[2]||m[1]);if(a<1||b>max||a>b)throw Error('Out of range: '+p.trim());for(let i=a;i<=b;i++)o.push(i-1)}return o}
async function openJs(f){return pdfjsLib.getDocument({data:new Uint8Array((await buf(f)).slice(0))}).promise}
async function render(pdf,n,scale){const pg=await pdf.getPage(n),vp=pg.getViewport({scale}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;return c}
const toBytes=(c,type,q)=>new Promise(r=>c.toBlob(b=>r(b),type,q));
const pdfName=f=>f.name.replace(/\.pdf$/i,'');
const sel=(cls,opts,lab)=>`<label>${lab}<select class="${cls}">${opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;

/* ---------- MERGE ---------- */
function merge(el){
 let list=[];const ul=h('<ul class="list"></ul>'),btn=h('<button class="btn" disabled>Merge &amp; download</button>');
 const draw=()=>{ul.innerHTML='';list.forEach((it,i)=>{const li=h(`<li draggable="true"><span>☰</span><em></em><small>${it.n} pages · ${fmt(it.f.size)}</small><input class="pg" placeholder="all pages" aria-label="Pages to include"><button aria-label="Remove">✕</button></li>`);
  $('em',li).textContent=it.f.name;const pg=$('.pg',li);pg.value=it.sel||'';pg.oninput=()=>it.sel=pg.value;
  li.ondragstart=e=>e.dataTransfer.setData('text/plain','m'+i);li.ondragover=e=>e.preventDefault();
  li.ondrop=e=>{const t=e.dataTransfer.getData('text/plain');if(t[0]!=='m')return;e.preventDefault();e.stopPropagation();list.splice(i,0,list.splice(+t.slice(1),1)[0]);draw()};
  $('button',li).onclick=()=>{list.splice(i,1);draw()};ul.append(li)});btn.disabled=list.length<2};
 drop(el,{accept:'.pdf,application/pdf',multiple:true,label:'Choose PDFs to merge',cb:async fs=>{for(const f of fs){const d=await PDFDocument.load(await buf(f));list.push({f,n:d.getPageCount(),sel:''})}draw()}});
 el.append(ul,btn);
 btn.onclick=()=>run(async()=>{const out=await PDFDocument.create();let k=0;for(const it of list){const d=await PDFDocument.load(await buf(it.f));const idx=it.sel.trim()?ranges(it.sel,d.getPageCount()):d.getPageIndices();(await out.copyPages(d,idx)).forEach(p=>out.addPage(p));bar(++k/list.length)}save(await out.save(),'merged.pdf');toast('Merged '+list.length+' files')})}

/* ---------- SPLIT ---------- */
function split(el){
 let f,d;const o=h(`<div hidden><div class="info"></div><div class="row">${sel('m',[['r','Extract ranges → one PDF'],['n','Every N pages → ZIP'],['s','Single pages → ZIP']],'Mode')}<label>Ranges or N<input class="v" placeholder="1-3, 5, 8-10"></label></div><button class="btn">Split &amp; download</button></div>`);
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF to split',cb:async([x])=>{f=x;d=await PDFDocument.load(await buf(x));$('.info',o).textContent=x.name+' · '+d.getPageCount()+' pages';o.hidden=false}});el.append(o);
 $('.btn',o).onclick=()=>run(async()=>{const m=$('.m',o).value,v=$('.v',o).value,N=d.getPageCount(),base=pdfName(f);
  const sub=async idx=>{const p=await PDFDocument.create();(await p.copyPages(d,idx)).forEach(q=>p.addPage(q));return p.save()};
  if(m==='r'){save(await sub(ranges(v,N)),base+'-extract.pdf');return}
  const step=m==='s'?1:Math.max(1,parseInt(v)||1),z=new JSZip();let c=0;
  for(let i=0;i<N;i+=step){const idx=[];for(let j=i;j<Math.min(N,i+step);j++)idx.push(j);z.file(`${base}-${++c}.pdf`,await sub(idx));bar(i/N)}
  save(await z.generateAsync({type:'blob'}),base+'-split.zip');toast('Created '+c+' files')})}

/* ---------- ORGANIZE ---------- */
function organize(el){
 let ab,pages=[],th={};const grid=h('<div class="grid"></div>'),o=h('<div class="row" hidden><button class="btn add">＋ Blank page</button><button class="btn dl">Save PDF</button></div>');
 const draw=()=>{grid.innerHTML='';pages.forEach((p,i)=>{const c=h(`<div class="card" draggable="true"><div class="im">${p.src===null?'<div class="blank"></div>':`<img alt="Page ${p.src+1}" src="${th[p.src]}" style="transform:rotate(${p.rot}deg)">`}</div><div class="t">${i+1}</div><button data-a="r" title="Rotate">⟳</button><button data-a="d" title="Duplicate">⧉</button><button data-a="x" title="Delete">✕</button></div>`);
  c.ondragstart=e=>e.dataTransfer.setData('text/plain','o'+i);c.ondragover=e=>e.preventDefault();
  c.ondrop=e=>{const t=e.dataTransfer.getData('text/plain');if(t[0]!=='o')return;e.preventDefault();pages.splice(i,0,pages.splice(+t.slice(1),1)[0]);draw()};
  c.onclick=e=>{const a=e.target.dataset.a;if(!a)return;if(a==='r')p.rot=(p.rot+90)%360;if(a==='d')pages.splice(i+1,0,{...p});if(a==='x')pages.splice(i,1);draw()};grid.append(c)})};
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF to organize',cb:async([f])=>{ab=await buf(f);const pdf=await pdfjsLib.getDocument({data:new Uint8Array(ab.slice(0))}).promise;pages=[];th={};
  for(let i=1;i<=pdf.numPages;i++){const c=await render(pdf,i,.3);th[i-1]=c.toDataURL('image/jpeg',.6);c.width=0;pages.push({src:i-1,rot:0});bar(i/pdf.numPages)}o.hidden=false;draw()}});
 el.append(o,grid);$('.add',o).onclick=()=>{pages.push({src:null,rot:0});draw()};
 $('.dl',o).onclick=()=>run(async()=>{const d=await PDFDocument.load(ab.slice(0)),out=await PDFDocument.create(),s=d.getPage(0).getSize();
  for(const p of pages){if(p.src===null){out.addPage([s.width,s.height]);continue}const [q]=await out.copyPages(d,[p.src]);q.setRotation(degrees((q.getRotation().angle+p.rot)%360));out.addPage(q)}
  save(await out.save(),'organized.pdf');toast('Saved '+pages.length+' pages')})}

/* ---------- COMPRESS ---------- */
function compress(el){
 let f;const o=h(`<div hidden><div class="row">${sel('lv',[['l','Light'],['b','Balanced'],['m','Maximum']],'Level')}</div><p class="d">Pages are re-rendered as compressed images, so text becomes non-selectable.</p><button class="btn">Compress &amp; download</button><div class="res" hidden></div></div>`);
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF to compress',cb:async([x])=>{f=x;o.hidden=false}});el.append(o);
 $('.btn',o).onclick=()=>run(async()=>{const L={l:[1.6,.78],b:[1.2,.6],m:[.9,.4]}[$('.lv',o).value],pdf=await openJs(f),out=await PDFDocument.create();
  for(let i=1;i<=pdf.numPages;i++){const v=(await pdf.getPage(i)).getViewport({scale:1}),c=await render(pdf,i,L[0]),b=await toBytes(c,'image/jpeg',L[1]);c.width=0;
   const im=await out.embedJpg(await b.arrayBuffer());out.addPage([v.width,v.height]).drawImage(im,{x:0,y:0,width:v.width,height:v.height});bar(i/pdf.numPages)}
  const r=await out.save(),R=$('.res',o);R.hidden=false;R.textContent=`Before: ${fmt(f.size)} → After: ${fmt(r.length)} (${Math.round((1-r.length/f.size)*100)}% change)`;
  if(r.length>=f.size)toast('Result is not smaller. Try a stronger level.',1);else save(r,pdfName(f)+'-compressed.pdf')})}

/* ---------- CONVERT ---------- */
function convert(el){
 el.append(h('<h3>PDF → images</h3>'));let f;
 const o=h(`<div hidden><div class="row">${sel('dpi',[[72,'72 DPI'],[150,'150 DPI'],[300,'300 DPI']],'Resolution')}${sel('fm',[['png','PNG'],['jpeg','JPG']],'Format')}</div><button class="btn">Convert to ZIP</button></div>`);
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF',cb:async([x])=>{f=x;o.hidden=false}});el.append(o);
 $('.btn',o).onclick=()=>run(async()=>{const pdf=await openJs(f),z=new JSZip(),fm=$('.fm',o).value;
  for(let i=1;i<=pdf.numPages;i++){const c=await render(pdf,i,$('.dpi',o).value/72);z.file(`${pdfName(f)}-${i}.${fm==='png'?'png':'jpg'}`,await toBytes(c,'image/'+fm,.92));c.width=0;bar(i/pdf.numPages)}
  save(await z.generateAsync({type:'blob'}),pdfName(f)+'-images.zip')});
 el.append(h('<h3>Images → PDF</h3>'));let imgs=[];
 const p=h(`<div hidden><div class="row">${sel('ps',[['fit','Fit to image'],['a4','A4'],['lt','Letter']],'Page size')}${sel('or',[['auto','Auto'],['p','Portrait'],['l','Landscape']],'Orientation')}<label>Margin (pt)<input class="mg" type="number" value="20" min="0"></label></div><div class="info"></div><button class="btn">Create PDF</button></div>`);
 drop(el,{accept:'image/*',multiple:true,label:'Choose images',cb:async fs=>{imgs=imgs.concat(fs);$('.info',p).textContent=imgs.length+' image(s) selected';p.hidden=false}});el.append(p);
 $('.btn',p).onclick=()=>run(async()=>{const out=await PDFDocument.create(),m=+$('.mg',p).value||0,ps=$('.ps',p).value,orr=$('.or',p).value;let k=0;
  for(const im of imgs){let e;if(im.type==='image/jpeg')e=await out.embedJpg(await buf(im));else if(im.type==='image/png')e=await out.embedPng(await buf(im));
   else{const bm=await createImageBitmap(im),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;c.getContext('2d').drawImage(bm,0,0);e=await out.embedPng(await (await toBytes(c,'image/png')).arrayBuffer());c.width=0}
   let W,H;if(ps==='fit'){W=e.width+2*m;H=e.height+2*m}else{[W,H]=ps==='a4'?[595.28,841.89]:[612,792];if(orr==='l'||(orr==='auto'&&e.width>e.height))[W,H]=[H,W]}
   const s=Math.min((W-2*m)/e.width,(H-2*m)/e.height),w=e.width*s,hh=e.height*s;out.addPage([W,H]).drawImage(e,{x:(W-w)/2,y:(H-hh)/2,width:w,height:hh});bar(++k/imgs.length)}
  save(await out.save(),'images.pdf');imgs=[]})}

/* ---------- WATERMARK & PAGE NUMBERS ---------- */
function watermark(el){
 let f;const o=h(`<div hidden><div class="row"><label>Watermark text<input class="tx" value="CONFIDENTIAL"></label><label>Size<input class="sz" type="number" value="60"></label><label>Opacity (0-1)<input class="op" type="number" step=".1" min="0" max="1" value=".25"></label><label>Rotation°<input class="ro" type="number" value="45"></label>${sel('pos',[['c','Center'],['t','Top'],['b','Bottom']],'Position')}</div>
 <div class="row">${sel('nm',[['','No page numbers'],['n','1, 2, 3'],['pn','Page 1 of N'],['bt','Bates (prefix + 000001)']],'Page numbers')}<label>Bates prefix<input class="bp" value="DOC-"></label></div><button class="btn">Apply &amp; download</button></div>`);
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF',cb:async([x])=>{f=x;o.hidden=false}});el.append(o);
 $('.btn',o).onclick=()=>run(async()=>{const d=await PDFDocument.load(await buf(f)),font=await d.embedFont(StandardFonts.HelveticaBold),pgs=d.getPages(),N=pgs.length;
  const t=$('.tx',o).value,sz=+$('.sz',o).value||40,op=+$('.op',o).value,ro=+$('.ro',o).value||0,pos=$('.pos',o).value,nm=$('.nm',o).value,bp=$('.bp',o).value;
  pgs.forEach((p,i)=>{const {width:w,height:H}=p.getSize();
   if(t){const tw=font.widthOfTextAtSize(t,sz),a=ro*Math.PI/180,cx=w/2,cy=pos==='c'?H/2:pos==='t'?H-sz*2-30:sz*2+30;
    p.drawText(t,{x:cx-tw/2*Math.cos(a)+sz/3*Math.sin(a),y:cy-tw/2*Math.sin(a)-sz/3*Math.cos(a),size:sz,font,color:rgb(.5,.5,.5),opacity:op,rotate:degrees(ro)})}
   if(nm){const s=nm==='n'?''+(i+1):nm==='pn'?`Page ${i+1} of ${N}`:bp+String(i+1).padStart(6,'0');p.drawText(s,{x:w/2-font.widthOfTextAtSize(s,10)/2,y:18,size:10,font,color:rgb(.3,.3,.3)})}
   bar((i+1)/N)});
  save(await d.save(),pdfName(f)+'-marked.pdf')})}

/* ---------- EDIT & SIGN ---------- */
function editor(el){
 let ab,pdf,fname='file',N=1,pg=1,ops=[],redo=[],base,cur=null,sig=null,sigImg=null;const sc=1.3;
 try{sig=localStorage.getItem('looptools-sig')}catch(e){}
 if(sig){sigImg=new Image();sigImg.src=sig}
 const o=h(`<div hidden><div class="row">${sel('md',[['text','Text'],['white','Whiteout'],['hl','Highlight'],['draw','Draw'],['sig','Signature']],'Tool')}<label>Text<input class="tx" value="Your text"></label><label>Size<input class="sz" type="number" value="16"></label><label>Color<input class="co" type="color" value="#d32f2f"></label></div>
 <div class="row"><button class="btn prev">◀</button><span class="pn"></span><button class="btn next">▶</button><button class="btn un">Undo</button><button class="btn re">Redo</button><button class="btn dl">Save PDF</button></div>
 <div class="row"><canvas class="sc" width="300" height="100" style="border:1px solid var(--bd);background:#fff;border-radius:8px;touch-action:none;max-width:100%"></canvas><div class="row"><label>Or type your name<input class="sn"></label><button class="btn us">Save signature</button><button class="btn cl">Clear</button></div></div>
 <div style="overflow:auto"><canvas class="page" style="border:1px solid var(--bd);max-width:100%;touch-action:none;cursor:crosshair"></canvas></div></div>`);
 const cv=$('.page',o),ctx=cv.getContext('2d'),sg=$('.sc',o),sx=sg.getContext('2d');
 const rg=c=>rgb(parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255);
 const paint=()=>{ctx.drawImage(base,0,0);ops.filter(p=>p.p===pg).forEach(p=>{ctx.save();
  if(p.k==='white'||p.k==='hl'){ctx.fillStyle=p.k==='white'?'#fff':'rgba(255,230,0,.4)';ctx.fillRect(p.x*sc,p.y*sc,p.w*sc,p.h*sc)}
  else if(p.k==='text'){ctx.fillStyle=p.c;ctx.font=p.s*sc+'px Helvetica,Arial,sans-serif';ctx.fillText(p.t,p.x*sc,p.y*sc)}
  else if(p.k==='draw'){ctx.strokeStyle=p.c;ctx.lineWidth=2*sc;ctx.beginPath();p.pts.forEach((q,i)=>i?ctx.lineTo(q[0]*sc,q[1]*sc):ctx.moveTo(q[0]*sc,q[1]*sc));ctx.stroke()}
  else if(p.k==='sig')ctx.drawImage(p.im,p.x*sc,p.y*sc,p.w*sc,p.h*sc);ctx.restore()})};
 const show=async()=>{base=await render(pdf,pg,sc);cv.width=base.width;cv.height=base.height;paint();$('.pn',o).textContent=pg+' / '+N};
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF to edit or sign',cb:async([f])=>{fname=pdfName(f);ab=await buf(f);pdf=await pdfjsLib.getDocument({data:new Uint8Array(ab.slice(0))}).promise;N=pdf.numPages;pg=1;ops=[];redo=[];o.hidden=false;await show()}});el.append(o);
 const pt=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width/sc,(e.clientY-r.top)*cv.height/r.height/sc]};
 cv.onpointerdown=e=>{const[x,y]=pt(e),m=$('.md',o).value,c=$('.co',o).value;redo=[];cv.setPointerCapture(e.pointerId);
  if(m==='text')ops.push({p:pg,k:'text',x,y,t:$('.tx',o).value,s:+$('.sz',o).value||16,c});
  else if(m==='sig'){if(!sig||!sigImg||!sigImg.complete)return toast('Create and save a signature first.',1);const w=150,hh=w*sigImg.naturalHeight/sigImg.naturalWidth;ops.push({p:pg,k:'sig',x:x-w/2,y:y-hh/2,w,h:hh,im:sigImg,d:sig})}
  else{cur={p:pg,k:m,x,y,w:0,h:0,pts:[[x,y]],c};ops.push(cur)}paint()};
 cv.onpointermove=e=>{if(!cur)return;const[x,y]=pt(e);if(cur.k==='draw')cur.pts.push([x,y]);else{cur.w=x-cur.x;cur.h=y-cur.y}paint()};
 cv.onpointerup=()=>cur=null;
 $('.prev',o).onclick=()=>{if(pg>1){pg--;show()}};$('.next',o).onclick=()=>{if(pg<N){pg++;show()}};
 $('.un',o).onclick=()=>{const p=ops.pop();if(p){redo.push(p);paint()}};$('.re',o).onclick=()=>{const p=redo.pop();if(p){ops.push(p);paint()}};
 let dn=false;sx.lineWidth=2.5;sx.lineCap='round';sx.strokeStyle='#111';
 const sp=e=>{const r=sg.getBoundingClientRect();return[(e.clientX-r.left)*sg.width/r.width,(e.clientY-r.top)*sg.height/r.height]};
 sg.onpointerdown=e=>{dn=true;sg.setPointerCapture(e.pointerId);const[a,b]=sp(e);sx.beginPath();sx.moveTo(a,b)};
 sg.onpointermove=e=>{if(!dn)return;const[a,b]=sp(e);sx.lineTo(a,b);sx.stroke()};sg.onpointerup=()=>dn=false;
 $('.cl',o).onclick=()=>sx.clearRect(0,0,300,100);
 $('.us',o).onclick=()=>{const n=$('.sn',o).value.trim();if(n){sx.clearRect(0,0,300,100);sx.fillStyle='#111';sx.font='italic 44px "Brush Script MT","Segoe Script",cursive';sx.fillText(n,10,65)}
  sig=sg.toDataURL();sigImg=new Image();sigImg.src=sig;try{localStorage.setItem('looptools-sig',sig)}catch(e){}toast('Signature saved. Pick the Signature tool, then click the page.')};
 $('.dl',o).onclick=()=>run(async()=>{const d=await PDFDocument.load(ab.slice(0)),font=await d.embedFont(StandardFonts.Helvetica);
  for(const p of ops){const g=d.getPage(p.p-1),H=g.getHeight();
   if(p.k==='text')g.drawText(p.t,{x:p.x,y:H-p.y,size:p.s,font,color:rg(p.c)});
   else if(p.k==='white'||p.k==='hl')g.drawRectangle({x:Math.min(p.x,p.x+p.w),y:H-Math.max(p.y,p.y+p.h),width:Math.abs(p.w),height:Math.abs(p.h),color:p.k==='white'?rgb(1,1,1):rgb(1,.9,0),opacity:p.k==='white'?1:.4});
   else if(p.k==='draw')p.pts.slice(1).forEach((q,i)=>g.drawLine({start:{x:p.pts[i][0],y:H-p.pts[i][1]},end:{x:q[0],y:H-q[1]},thickness:2,color:rg(p.c)}));
   else if(p.k==='sig'){const im=await d.embedPng(Uint8Array.from(atob(p.d.split(',')[1]),c=>c.charCodeAt(0)));g.drawImage(im,{x:p.x,y:H-p.y-p.h,width:p.w,height:p.h})}}
  save(await d.save(),fname+'-edited.pdf');toast('Saved')})}

/* ---------- CROP / RESIZE ---------- */
function crop(el){
 let f,d;const o=h(`<div hidden><div class="info"></div><div class="row"><label>Top (pt)<input class="t" type="number" value="0" min="0"></label><label>Right<input class="r" type="number" value="0" min="0"></label><label>Bottom<input class="b" type="number" value="0" min="0"></label><label>Left<input class="l" type="number" value="0" min="0"></label>${sel('sz',[['','Keep size'],['a4','Resize to A4'],['lt','Resize to Letter']],'Page size')}</div><button class="btn">Apply &amp; download</button></div>`);
 drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF',cb:async([x])=>{f=x;d=await PDFDocument.load(await buf(x));$('.info',o).textContent=x.name+' · '+d.getPageCount()+' pages (72 pt = 1 inch)';o.hidden=false}});el.append(o);
 $('.btn',o).onclick=()=>run(async()=>{const v=c=>+$(c,o).value||0,z=$('.sz',o).value,[W,H]=z==='a4'?[595.28,841.89]:z==='lt'?[612,792]:[0,0];
  d.getPages().forEach(p=>{const m=p.getMediaBox(),x=m.x+v('.l'),y=m.y+v('.b'),w=m.width-v('.l')-v('.r'),hh=m.height-v('.t')-v('.b');if(w<=0||hh<=0)throw Error('Crop is larger than the page');
   p.setMediaBox(x,y,w,hh);p.setCropBox(x,y,w,hh);if(W){const s=Math.min(W/w,H/hh);p.scale(s,s);p.setSize(W,H)}});
  save(await d.save(),pdfName(f)+'-cropped.pdf')})}

/* ---------- TEXT → PDF ---------- */
function txt2pdf(el){
 const o=h(`<div><textarea class="in" rows="12" placeholder="Type or paste your text here…" style="width:100%"></textarea>
 <div class="row">${sel('ps',[['a4','A4'],['lt','Letter']],'Page')}<label>Font size<input class="fs" type="number" value="12" min="6" max="48"></label><button class="btn go">Create PDF</button></div></div>`);
 drop(el,{accept:'.txt,text/plain',label:'Load a .txt file (optional)',cb:async([f])=>{$('.in',o).value=await f.text()}});el.append(o);
 $('.go',o).onclick=()=>run(async()=>{
  const t=$('.in',o).value.replace(/\t/g,'    ').replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g,'?');if(!t.trim())throw Error('Please enter some text');
  const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica),fs=+$('.fs',o).value||12,[W,H]=$('.ps',o).value==='a4'?[595.28,841.89]:[612,792],m=56,lh=fs*1.4,lines=[];
  t.split('\n').forEach(par=>{let ln='';par.split(/ +/).forEach(w=>{const tt=ln?ln+' '+w:w;if(font.widthOfTextAtSize(tt,fs)>W-2*m&&ln){lines.push(ln);ln=w}else ln=tt});lines.push(ln)});
  let pg=d.addPage([W,H]),y=H-m;
  for(const l of lines){if(y<m){pg=d.addPage([W,H]);y=H-m}pg.drawText(l,{x:m,y,size:fs,font});y-=lh}
  save(await d.save(),'text.pdf');toast('PDF created')})}

/* ---------- PDF → TEXT ---------- */
function pdf2txt(el){
 const o=h(`<div hidden><div class="row"><button class="btn go">Extract text</button><button class="btn cp">Copy</button><button class="btn sv">Download .txt</button></div><textarea class="out" rows="14" style="width:100%"></textarea></div>`);
 let f;drop(el,{accept:'.pdf,application/pdf',label:'Choose a PDF',cb:async([x])=>{f=x;o.hidden=false}});el.append(o);
 $('.go',o).onclick=()=>run(async()=>{const pdf=await openJs(f),out=[];
  for(let i=1;i<=pdf.numPages;i++){const tc=await (await pdf.getPage(i)).getTextContent();out.push('--- Page '+i+' ---\n'+tc.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''));bar(i/pdf.numPages)}
  const s=out.join('\n\n');$('.out',o).value=s;if(s.replace(/--- Page \d+ ---|\s/g,'').length<5)toast('No text found. This PDF looks like a scan, and this tool cannot read images.',1);else toast('Text extracted')});
 $('.cp',o).onclick=()=>navigator.clipboard.writeText($('.out',o).value).then(()=>toast('Copied'));
 $('.sv',o).onclick=()=>save(new Blob([$('.out',o).value],{type:'text/plain'}),'pdf-text.txt')}

/* ---------- SHELL: sidebar, footer, theme, tool loader ---------- */
const TOOLS=[['merge','/merge-pdf/','Merge PDF','merge'],['split','/split-pdf/','Split PDF','split'],['organize','/organize-pdf-pages/','Organize Pages','grid'],['compress','/compress-pdf/','Compress PDF','shrink'],['convert','/pdf-image-converter/','PDF ⇄ Images','swap'],['watermark','/watermark-pdf/','Watermark & Numbers','stamp'],['editor','/edit-sign-pdf/','Edit & Sign','pen'],['crop','/crop-resize-pdf/','Crop / Resize','crop'],['txt2pdf','/text-to-pdf/','Text → PDF','text'],['pdf2txt','/pdf-to-text/','PDF → Text','filetext']];
const IMPL={merge,split,organize,compress,convert,watermark,editor,crop,txt2pdf,pdf2txt};
const LIBS=['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];
const loadLibs=()=>Promise.all(LIBS.map(u=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=()=>no(Error('A required library could not be loaded. Check your connection and reload.'));document.head.append(s)})));
const LOGO='<svg class="logo" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="48" cy="48" r="46" fill="#1B1E2A" stroke="#2A2E3D"/><path d="M30 48c0-9 7-16 16-16s16 7 16 16" fill="none" stroke="#E8A33D" stroke-width="4" stroke-linecap="round"/><path d="M66 48c0 9-7 16-16 16s-16-7-16-16" fill="none" stroke="#F5F3EC" stroke-width="4" stroke-linecap="round" opacity="0.85"/><circle cx="30" cy="48" r="3.5" fill="#E8A33D"/><circle cx="66" cy="48" r="3.5" fill="#F5F3EC"/></svg>';
const SPRITE='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10"/></symbol><symbol id="i-merge" viewBox="0 0 24 24"><path d="M6 3v5a6 6 0 0 0 6 6M18 3v5a6 6 0 0 1-6 6M12 14v7M9 18l3 3 3-3"/></symbol><symbol id="i-split" viewBox="0 0 24 24"><path d="M12 3v6M12 9L5 20M12 9l7 11"/></symbol><symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></symbol><symbol id="i-shrink" viewBox="0 0 24 24"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></symbol><symbol id="i-swap" viewBox="0 0 24 24"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></symbol><symbol id="i-stamp" viewBox="0 0 24 24"><path d="M8 3h8v7l3 4v3H5v-3l3-4zM4 21h16"/></symbol><symbol id="i-pen" viewBox="0 0 24 24"><path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4"/></symbol><symbol id="i-crop" viewBox="0 0 24 24"><path d="M6 2v16h16M2 6h16v16"/></symbol><symbol id="i-text" viewBox="0 0 24 24"><path d="M5 5h14M12 5v15M9 20h6"/></symbol><symbol id="i-filetext" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/></symbol></defs></svg><div id="bar"></div><div id="toasts"></div>';
(function(){
 document.body.insertAdjacentHTML('afterbegin',SPRITE);
 const path=location.pathname.replace(/index\.html$/,'');
 $('#nav').innerHTML=`<a href="/" class="brand" aria-label="Looptools home">${LOGO}<span>Loop<b>tools</b></span></a><a href="/">${ico('home')}<span>Home</span></a><h4 class="cat">PDF</h4>`
  +TOOLS.map(t=>`<a href="${t[1]}"${path===t[1]?' class="on" aria-current="page"':''}>${ico(t[3])}<span>${esc(t[2])}</span></a>`).join('')
  +'<div class="badge">Your files are processed in your browser and are not uploaded by this site. <a href="/privacy/">Details</a></div>';
 $('#foot').innerHTML='<span>Looptools · Small tasks. Sorted.</span><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/contact/">Contact</a>';
 const KEY='looptools-theme',r=document.documentElement;
 try{const s=localStorage.getItem(KEY);if(s==='dark'||s==='light')r.dataset.theme=s}catch(e){}
 const th=$('#th');if(th)th.addEventListener('click',()=>{const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=dark?'light':'dark';try{localStorage.setItem(KEY,r.dataset.theme)}catch(e){}});
 const name=document.body.dataset.tool,host=$('#tool');
 if(name&&host&&IMPL[name]){host.innerHTML='<p class="d">Loading tool…</p>';
  loadLibs().then(()=>{({PDFDocument,StandardFonts,rgb,degrees}=PDFLib);pdfjsLib.GlobalWorkerOptions.workerSrc=LIBS[2];host.innerHTML='';IMPL[name](host)})
  .catch(e=>{host.textContent='This tool could not start: '+e.message})}
})();
