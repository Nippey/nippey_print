(()=>{
const el=k=>document.getElementById("product-"+k), node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
let data,controls=[],lastSuggestion='';
function visualize(){
 const p=data.products.find(x=>x.name===el("select").value);
 const target=el("preview");target.replaceChildren();
 if(!p||p.visualizer_key!=="fence-light-standard")return;
 const v=Object.fromEntries(controls.map(([k,i])=>[k,i.type==="checkbox"?i.checked:i.value]));
 const ns="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 340 230");svg.style.width="100%";svg.setAttribute("role","img");svg.setAttribute("aria-label","Schematische Zaunleuchte");
 function add(tag,attrs,label){const n=document.createElementNS(ns,tag);for(const [k,val] of Object.entries(attrs))n.setAttribute(k,String(val));if(label)n.textContent=label;svg.append(n);}
 const color=({"7016":"#383e42","9005":"#171819","9006":"#a5a8a6"})[String(v.housing_colour).replace(/^RAL\s*/i,"").trim()]||"#777";
 const u=Math.max(0,Math.min(75,(Number(v.overhang)||0)*1.5)), h=Number(v.hole_position)||0;
 for(let x=28;x<=124;x+=24)add("path",{d:"M"+x+" 115V215",stroke:"#92989d","stroke-width":4});
 for(let y=125;y<=215;y+=30)add("path",{d:"M12 "+y+"H141",stroke:"#92989d","stroke-width":4});
 add("rect",{x:141,y:70,width:70,height:150,fill:color,stroke:"#888"});
 add("rect",{x:132,y:115,width:9,height:105,fill:"#777"});
 add("rect",{x:132-u,y:59,width:89+u,height:29,rx:4,fill:color,stroke:"#888"});
 for(const x of [...(v.light_position!=="H"?[135-u]:[]),...(v.light_position!=="V"?[201]:[])]){
   add("path",{d:"M"+x+" 88 l-18 57 h53 l-18 -57Z",fill:v.warm_filter?"#efc66f":"#e5e8da",opacity:.3});
   add("rect",{x,y:84,width:17,height:5,rx:2,fill:v.warm_filter?"#ffd174":"#f0f4df"});
 }
 if(h>0)add("circle",{cx:v.light_position==="H"?202:150,cy:Math.min(211,89+h*.5),r:4,fill:"#111",stroke:"#aaa"});
 [[85,24,"Vorne"],[255,24,"Hinten"],[260,185,"60 × 40 mm"],[260,201,"Pfosten"],[170,45,"Ü "+v.overhang+" mm · B "+v.hole_position+" mm"]].forEach(([x,y,t])=>add("text",{x,y,"text-anchor":"middle","font-size":11,fill:"currentColor"},t));
 target.append(svg);target.append(node("small","Schematisch, nicht maßstäblich; unbekannte Farben grau."));
}
function suggest(){
 visualize();
 const p=data.products.find(x=>x.name===el('select').value);if(!p||p.visualizer_key!=='fence-light-standard')return;
 const v=Object.fromEntries(controls.map(([k,i])=>[k,i.type==='checkbox'?i.checked:i.value]));
 const color=String(v.housing_colour||'').trim().replace(/^RAL\s*/i,'').replace(/\s+/g,'-');
 const name=['ZL','STD',v.light_position,'Ü'+v.overhang,'B'+v.hole_position,v.warm_filter?'WW':'NW',color].join('-');
 if(!el('name').value||el('name').value===lastSuggestion)el('name').value=name;
 lastSuggestion=name;
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
   l.append(i);el("fields").append(l);if(p.visualizer_key==="fence-light-standard"&&["overhang","hole_position"].includes(r.parameter_key)){const presets=node("div");presets.className="mb-2";for(const [value,title] of (r.parameter_key==="overhang"?[["17","Standard · 17 mm"],["0","Kurz · 0 mm"]]:[["0","Ohne"],["57","Camas · 57 mm"]])){const b=node("button",title);b.type="button";b.className="btn btn-sm btn-outline-secondary mr-2";b.onclick=()=>{i.value=value;suggest();};presets.append(b);}el("fields").append(presets);}controls.push([r.parameter_key,i]);i.addEventListener('input',suggest);i.addEventListener('change',suggest);
 }
 suggest();el("save").disabled=false;el("list").replaceChildren();
 for(const c of data.configurations.filter(x=>x.product===p.name)){
   const b=node("div");b.className="border rounded p-3 mb-2";const a=node("a",c.configuration_name);a.href="/app/print-configuration/"+encodeURIComponent(c.name);b.append(a);
   let values;try{values=JSON.parse(c.parameter_values);}catch{values={};}
   b.append(node("p",Object.entries(values).map(([k,v])=>k+": "+v).join(" · ")));
   const same=new Set(data.configurations.filter(x=>x.geometry_signature===c.geometry_signature).map(x=>x.name));
   for(const r of data.revisions.filter(x=>same.has(x.configuration))){const link=node("a",r.internal_revision+" · "+r.status);link.href="/app/print-model-revision/"+encodeURIComponent(r.name);const line=node("div");line.append(link);b.append(line);}
   el("list").append(b);
 }
}
async function load(){const r=await fetch("/api/method/nippey_print.products.overview",{credentials:"same-origin",cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);data=(await r.json()).message;const previous=el("select").value;el("select").replaceChildren(...data.products.map(p=>new Option(p.title,p.name)));if(data.products.some(p=>p.name===previous))el("select").value=previous;render();}
el("select").onchange=()=>{if(el("name").value===lastSuggestion)el("name").value="";lastSuggestion="";render();};
el("form").onsubmit=async e=>{e.preventDefault();el("save").disabled=true;try{if(!window.frappe?.csrf_token)throw Error("CSRF-Token fehlt");const values=Object.fromEntries(controls.map(([k,i])=>[k,i.type==="checkbox"?i.checked:i.value]));const r=await fetch("/api/method/nippey_print.products.create_configuration",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},body:JSON.stringify({product:el("select").value,configuration_name:el("name").value,parameter_values:values})});if(!r.ok)throw Error("HTTP "+r.status);const m=(await r.json()).message;await load();el("status").textContent=(m.existing?"Bereits vorhanden: ":"Gespeichert: ")+m.name;}catch(e){el("status").textContent="Nicht bestätigt: "+e.message;el("save").disabled=false;}};
load().then(()=>el("status").textContent="Produkte geladen.").catch(e=>el("status").textContent=e.message);
})();
