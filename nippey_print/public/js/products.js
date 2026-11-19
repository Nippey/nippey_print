(()=>{
const el=k=>document.getElementById("product-"+k), node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
let data,controls=[],lastSuggestion='';
function suggest(){
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
   l.append(i);el("fields").append(l);controls.push([r.parameter_key,i]);i.addEventListener('input',suggest);i.addEventListener('change',suggest);
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
