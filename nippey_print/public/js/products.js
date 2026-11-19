(()=>{
const el=k=>document.getElementById("product-"+k), node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
let data,controls=[],lastSuggestion='';
const ralNames={"7016":"an","9005":"ts","9006":"wa"};
function colorCode(value){
 const s=String(value||"").trim(),m=s.match(/^(?:RAL\s*)?(\d{4})(?:\s+(.*))?$/i);
 if(m)return m[1]+(ralNames[m[1]]||(m[2]||"").slice(0,2).toLowerCase());
 return s.replace(/\s+/g,"-");
}

// Illustrative footprint only: actual LED dimensions and CAD tangencies are not known.
const LED_PREVIEW_SIZE=36;
function specialPreview(target,v){
 const w=Number(v.post_width),h=Number(v.post_depth),x=Number(v.led_x),y=Number(v.led_y);
 if(!(w>0&&h>0)||v.led_x===""||v.led_y===""||![w,h,x,y].every(Number.isFinite)){
   target.append(node("p","Pfostenmaße und LED-Mittelpunkt eingeben."));return;
 }
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg"),s=LED_PREVIEW_SIZE/2;
 const corners=(cx,cy,a,b,type)=>[[-a,-b],[a,-b],[a,b],[-a,b]].map(([dx,dy])=>({x:cx+dx,y:cy+dy,type}));
 const post=corners(0,0,w/2,h/2,"post"),led=corners(x,y,s,s,"led"),all=[...post,...led];
 const minX=Math.min(...all.map(p=>p.x)),maxX=Math.max(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
 const pad=Math.max(w,h,maxX-minX,maxY-minY)*.22;
 svg.setAttribute("viewBox",[minX-pad,minY-pad,maxX-minX+2*pad,maxY-minY+2*pad].join(" "));svg.style.width="100%";svg.style.maxHeight="350px";svg.setAttribute("role","img");svg.setAttribute("aria-label","Draufsicht Sonderanfertigung");
 function add(tag,attrs,label){const n=document.createElementNS(ns,tag);for(const [k,val] of Object.entries(attrs))n.setAttribute(k,String(val));if(label)n.textContent=label;svg.append(n);return n;}
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const sorted=[...all].sort((a,b)=>a.x-b.x||a.y-b.y);
 const half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}return out.slice(0,-1);};
 const hull=[...half(sorted),...half([...sorted].reverse())];
 const style={fill:"#7896a5","fill-opacity":.3,stroke:"#7896a5","stroke-width":1.5,"vector-effect":"non-scaling-stroke"};
 if(v.outer_contour==="Bounding Box")add("rect",{x:minX,y:minY,width:maxX-minX,height:maxY-minY,...style});
 else{
   let d="M"+hull[0].x+" "+hull[0].y;
   for(let i=0;i<hull.length;i++){
     const a=hull[i],b=hull[(i+1)%hull.length],dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1;
     if(a.type!==b.type&&["Konkav","Konvex"].includes(v.outer_contour)){
       const k=n*.20*(v.outer_contour==="Konkav"?1:-1);
       d+=" Q"+((a.x+b.x)/2-dy/n*k)+" "+((a.y+b.y)/2+dx/n*k)+" "+b.x+" "+b.y;
     }else d+=" L"+b.x+" "+b.y;
   }
   add("path",{d:d+" Z",...style});
 }
 add("rect",{x:-w/2,y:-h/2,width:w,height:h,fill:"#555e64",stroke:"#92999e","stroke-width":.6});
 add("rect",{x:x-s,y:y-s,width:2*s,height:2*s,fill:v.warm_filter?"#e9bc64":"#e3e9e2",stroke:"#b6934d","stroke-width":.6});
 const fs=Math.min(5,w/6,h/3);
 add("text",{x:0,y:fs/3,"font-size":fs,"text-anchor":"middle",fill:"white"},"Pfosten");
 add("text",{x,y:y+2,"font-size":5,"text-anchor":"middle",fill:"#463921"},"LED");
 add("path",{d:"M-3 0H3 M0 -3V3",stroke:"#fff","stroke-width":.45});
 target.append(svg);
 target.append(node("small","Draufsicht: +X rechts, +Y unten. LED ca. 36 × 36 mm; Kurven nur schematisch, keine CAD-Tangenten."));
 if(Math.abs(x)<w/2+s&&Math.abs(y)<h/2+s)target.append(node("p","Hinweis: LED und Pfosten überlappen in der Vorschau."));
 if(v.manual_construction)target.append(node("p","Manuelle Sonderkonstruktion: Vorschau zeigt nur eine LED."));
 const controlsBox=node("div");controlsBox.className="mt-2";
 const presets=[["Mittig",0,h/2+s],["Linksbündig",-w/2+s,h/2+s],["Rechtsbündig",w/2-s,h/2+s],["Diagonal links",-w/2-s,h/2+s],["Diagonal rechts",w/2+s,h/2+s]];
 for(const [label,px,py] of presets){const b=node("button",label);b.type="button";b.className="btn btn-sm btn-outline-secondary mr-1 mb-1";b.onclick=()=>{for(const [k,i] of controls){if(k==="led_x")i.value=px;if(k==="led_y")i.value=py;}suggest();};controlsBox.append(b);}
 target.append(controlsBox);
}

function visualize(){
 const p=data.products.find(x=>x.name===el("select").value);
 const target=el("preview");target.replaceChildren();
 if(!p)return;
 const v=Object.fromEntries(controls.map(([k,i])=>[k,i.type==="checkbox"?i.checked:i.value]));
 if(p.visualizer_key==="fence-light-special"){specialPreview(target,v);return;}
 if(p.visualizer_key!=="fence-light-standard")return;
 const ns="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 340 230");svg.style.width="100%";svg.setAttribute("role","img");svg.setAttribute("aria-label","Schematische Zaunleuchte");
 function add(tag,attrs,label){const n=document.createElementNS(ns,tag);for(const [k,val] of Object.entries(attrs))n.setAttribute(k,String(val));if(label)n.textContent=label;svg.append(n);}
 const selected=data.colours.find(c=>c.value===v.housing_colour);
 const color=selected?.hex||({"7016":"#383e42","9005":"#171819","9006":"#a5a8a6"})[String(v.housing_colour).match(/\d{4}/)?.[0]]||"#777";
 const u=Math.max(0,Math.min(75,(Number(v.overhang)||0)*1.5)), h=Number(v.hole_position)||0;
 for(let x=28;x<=124;x+=24)add("path",{d:"M"+x+" 115V215",stroke:"#92989d","stroke-width":4});
 for(let y=125;y<=215;y+=30)add("path",{d:"M12 "+y+"H141",stroke:"#92989d","stroke-width":4});
 add("rect",{x:141,y:70,width:70,height:150,fill:color,stroke:"#888"});
 add("rect",{x:132,y:115,width:9,height:105,fill:"#777"});
 const front=v.light_position!=="H",back=v.light_position!=="V";
 const left=132-u-(front?20:0),right=221+(back?20:0);
 add("rect",{x:left,y:59,width:right-left,height:29,rx:4,fill:color,stroke:"#888"});
 for(const x of [...(front?[left+3]:[]),...(back?[right-20]:[])]){
   add("path",{d:"M"+x+" 88 l-18 57 h53 l-18 -57Z",fill:v.warm_filter?"#efc66f":"#e5e8da",opacity:.3});
   add("rect",{x,y:84,width:17,height:5,rx:2,fill:v.warm_filter?"#ffd174":"#f0f4df"});
 }
 if(h>0)add("circle",{cx:v.light_position==="H"?202:150,cy:Math.min(211,89+h*.5),r:4,fill:"#111",stroke:"#aaa"});
 [[85,24,"Vorne"],[255,24,"Hinten"],[260,185,"60 × 40 mm"],[260,201,"Pfosten"],[170,45,"Ü "+v.overhang+" mm · B "+v.hole_position+" mm"]].forEach(([x,y,t])=>add("text",{x,y,"text-anchor":"middle","font-size":11,fill:"currentColor"},t));
 target.append(svg);target.append(node("small","Schematisch, nicht maßstäblich; unbekannte Farben grau."));
}
function suggest(){
 visualize();
 const p=data.products.find(x=>x.name===el('select').value);if(!p||!['fence-light-standard','fence-light-special'].includes(p.visualizer_key))return;
 const v=Object.fromEntries(controls.map(([k,i])=>[k,i.type==='checkbox'?i.checked:i.value]));
 const color=colorCode(v.housing_colour);
 const name=(p.visualizer_key==='fence-light-standard'?['ZL','STD',v.light_position,'Ü'+v.overhang,'B'+v.hole_position]:['ZL','SON',v.post_width+'x'+v.post_depth,({'Bounding Box':'BB','Gummiband':'GB','Konkav':'KA','Konvex':'KV'})[v.outer_contour]||'?', 'X'+v.led_x,'Y'+v.led_y,...(v.manual_construction?['MAN']:[])]).concat(v.warm_filter?'WW':'NW',color).join('-');
 if(!el('name').value||el('name').value===lastSuggestion)el('name').value=name;
 lastSuggestion=name;
}
function revisionPanel(config,revisions){
 const panel=node("div");panel.className="border-top mt-2 pt-2";
 const form=node("div");form.hidden=true;
 const toggle=node("button","Neue Modellrevision");toggle.type="button";toggle.className="btn btn-sm btn-outline-primary";toggle.onclick=()=>{form.hidden=!form.hidden;};panel.append(toggle,form);
 const inputs={};
 for(const [key,label,type] of [["internal_revision","Interne Revision (z. B. V14.2)","text"],["marked_revision","Aufgedruckte Revision (z. B. V14)","text"],["model_year","Modelljahr","number"],["export_date","Exportdatum","date"],["change_description","Änderungen","textarea"]]){
   const l=node("label",label);l.className="d-block mt-2";const i=node(type==="textarea"?"textarea":"input");if(type!=="textarea")i.type=type;i.className="form-control";l.append(i);form.append(l);inputs[key]=i;
 }
 const l=node("label","Vorgänger (optional)");l.className="d-block mt-2";const prev=node("select");prev.className="form-control";prev.add(new Option("Keiner / unbekannt",""));for(const r of revisions)prev.add(new Option(r.internal_revision+" · "+r.status,r.name));l.append(prev);form.append(l);
 const save=node("button","Entwurf erstellen und Dateien zuordnen");save.type="button";save.className="btn btn-primary btn-sm mt-2";const status=node("p");status.setAttribute("role","status");
 save.onclick=async()=>{if(!inputs.internal_revision.value.trim()){status.textContent="Interne Revision fehlt.";return;}save.disabled=true;try{if(!window.frappe?.csrf_token)throw Error("CSRF-Token fehlt");const body={configuration:config.name,predecessor:prev.value,...Object.fromEntries(Object.entries(inputs).map(([k,i])=>[k,i.value]))};const response=await fetch("/api/method/nippey_print.products.create_revision",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},body:JSON.stringify(body)});if(!response.ok)throw Error("HTTP "+response.status);const result=(await response.json()).message;window.location.href="/app/print-model-revision/"+encodeURIComponent(result.name);}catch(e){status.textContent="Nicht bestätigt: "+e.message;save.disabled=false;}};
 form.append(save,status);panel.append(node("small"," Dateien werden anschließend im ERPNext-Revisionsformular hochgeladen."));return panel;
}
function render(){
 const p=data.products.find(x=>x.name===el("select").value);if(!p)return;
 el("description").textContent=p.description||"";el("fields").replaceChildren();controls=[];
 for(const r of p.parameters){
   const l=node("label",r.parameter_label+(r.unit?" ("+r.unit+")":""));l.className="d-block";
   const i=node(r.parameter_type==="Select"?"select":"input");
   if(r.parameter_type==="Select"){for(const v of (r.choices||"").split("\n"))i.add(new Option(({V:"Vorne",H:"Hinten",D:"Doppel"})[v]||v,v));}
   else{i.type=r.parameter_type==="Check"?"checkbox":["Integer","Decimal"].includes(r.parameter_type)?"number":"text";if(i.type==="number"){i.step=r.parameter_type==="Integer"?"1":"any";if(["overhang","hole_position","post_width","post_depth"].includes(r.parameter_key))i.min="0";}}
   if(i.type==="checkbox"){i.checked=["1","true","True"].includes(String(r.default_value));i.className="ml-2";}
   else{i.value=r.default_value??"";i.required=!!r.required_value;i.className="form-control mb-2";}
   if(r.parameter_key==="housing_colour"){const list=node("datalist");list.id="product-asa-colours";for(const c of data.colours){const o=node("option");o.value=c.value;o.label=c.label;list.append(o);}i.setAttribute("list",list.id);l.append(list);}l.append(i);el("fields").append(l);if(p.visualizer_key==="fence-light-standard"&&["overhang","hole_position"].includes(r.parameter_key)){const presets=node("div");presets.className="mb-2";for(const [value,title] of (r.parameter_key==="overhang"?[["17","Standard · 17 mm"],["0","Kurz · 0 mm"]]:[["0","Ohne"],["57","Camas · 57 mm"]])){const b=node("button",title);b.type="button";b.className="btn btn-sm btn-outline-secondary mr-2";b.onclick=()=>{i.value=value;suggest();};presets.append(b);}el("fields").append(presets);}controls.push([r.parameter_key,i]);i.addEventListener('input',suggest);i.addEventListener('change',suggest);
 }
 if(p.visualizer_key==="fence-light-special"){const y=controls.find(([k])=>k==="led_y")?.[1],h=controls.find(([k])=>k==="post_depth")?.[1];if(y&&h&&!y.value)y.value=Number(h.value)/2+LED_PREVIEW_SIZE/2;}suggest();el("save").disabled=false;el("list").replaceChildren();
 for(const c of data.configurations.filter(x=>x.product===p.name)){
   const b=node("div");b.className="border rounded p-3 mb-2";const a=node("a",c.configuration_name);a.href="/app/print-configuration/"+encodeURIComponent(c.name);b.append(a);
   let values;try{values=JSON.parse(c.parameter_values);}catch{values={};}
   b.append(node("p",Object.entries(values).map(([k,v])=>k+": "+v).join(" · ")));
   const same=new Set(data.configurations.filter(x=>x.geometry_signature===c.geometry_signature).map(x=>x.name));
   for(const r of data.revisions.filter(x=>same.has(x.configuration))){const link=node("a",r.internal_revision+" · "+r.status);link.href="/app/print-model-revision/"+encodeURIComponent(r.name);const line=node("div");line.append(link);b.append(line);}
   b.append(revisionPanel(c,data.revisions.filter(r=>same.has(r.configuration))));
   el("list").append(b);
 }
}
async function load(){const r=await fetch("/api/method/nippey_print.products.overview",{credentials:"same-origin",cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);data=(await r.json()).message;const previous=el("select").value;el("select").replaceChildren(...data.products.map(p=>new Option(p.title,p.name)));if(data.products.some(p=>p.name===previous))el("select").value=previous;render();}
el("select").onchange=()=>{if(el("name").value===lastSuggestion)el("name").value="";lastSuggestion="";render();};
el("form").onsubmit=async e=>{e.preventDefault();el("save").disabled=true;try{if(!window.frappe?.csrf_token)throw Error("CSRF-Token fehlt");const values=Object.fromEntries(controls.map(([k,i])=>[k,i.type==="checkbox"?i.checked:i.value]));const r=await fetch("/api/method/nippey_print.products.create_configuration",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},body:JSON.stringify({product:el("select").value,configuration_name:el("name").value,parameter_values:values})});if(!r.ok)throw Error("HTTP "+r.status);const m=(await r.json()).message;await load();el("status").textContent=(m.existing?"Bereits vorhanden: ":"Gespeichert: ")+m.name;}catch(e){el("status").textContent="Nicht bestätigt: "+e.message;el("save").disabled=false;}};
load().then(()=>el("status").textContent="Produkte geladen.").catch(e=>el("status").textContent=e.message);
})();
