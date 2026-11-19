(() => {
 const el=id=>document.getElementById("stock-"+id);
 const fmt=(v,d=1)=>Number(v).toLocaleString("de-DE",{maximumFractionDigits:d});
 const money=v=>Number(v).toLocaleString("de-DE",{style:"currency",currency:"EUR"});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 let rows=[];
 const keys=["material","manufacturer","colour"];
 const low=r=>Number(r.nominal)>0 && Number(r.qty)/Number(r.nominal)<.25;
 function render(){
   const q=el("search").value.trim().toLowerCase();
   const base=rows.filter(r=>(!el("low").checked||low(r))&&(!q||[r.label,r.item,r.material,r.manufacturer,r.colour,r.ral,r.manufacturer_color,r.ral?"RAL "+r.ral:""].some(v=>String(v??"").toLowerCase().includes(q))));
   const matches=(r,except)=>keys.every(k=>k===except||!el(k).value||r[k]===el(k).value);
   for(const k of keys){
     const candidates=base.filter(r=>matches(r,k));
     const counts=new Map();
     for(const r of candidates)counts.set(r[k],(counts.get(r[k])||0)+1);
     for(const option of el(k).options){
       const count=option.value?counts.get(option.value)||0:candidates.length;
       option.textContent=(option.value||"Alle")+" ("+count+")";
     }
   }
   const selected=base.filter(r=>matches(r));
   const sum=rs=>rs.reduce((a,r)=>a+Number(r.qty),0);
   const value=rs=>rs.some(r=>r.estimated_value==null)?null:rs.reduce((a,r)=>a+Number(r.estimated_value),0);
   el("count").textContent=selected.length;
   el("weight").textContent=fmt(sum(selected)/1000,3)+" kg";
   const v=value(selected);el("value").textContent=v==null?"Nicht vollständig bekannt":money(v);
   const list=el("list");list.replaceChildren();
   if(!selected.length){list.append(node("p","Keine passenden Rollen."));return;}
   const groups=new Map(), key=el("group").value;
   for(const r of selected){const k=key==="none"?"":r[key]||"Unbekannt";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
   for(const [name,rs] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))){
     if(name){list.append(node("h4",name,"mt-4"),node("p",rs.length+" Rollen · "+fmt(sum(rs),2)+" g"+(value(rs)==null?"":" · "+money(value(rs))),"text-muted small"));}
     for(const r of rs){
       const a=node("a",null,"border rounded p-3 mb-2 d-flex align-items-center");a.href="/nippey-print?"+new URLSearchParams({label:r.label,...(new URLSearchParams(location.search).get("mode")==="consume"?{mode:"consume"}:{})});a.style.gap="12px";a.style.color="inherit";a.style.textDecoration="none";
       const sw=node("span");Object.assign(sw.style,{width:"40px",height:"40px",flexShrink:"0",border:"1px solid #888",borderRadius:"8px",background:/^#[0-9a-f]{6}$/i.test(r.display_color||"")?r.display_color:"#aaa"});
       const body=node("div");body.style.flex="1";body.append(node("strong",r.colour||r.item),node("div",[r.material,r.manufacturer,r.label,r.ral?"RAL "+r.ral:""].filter(Boolean).join(" · "),"small text-muted"));
       const pct=Number(r.nominal)>0?100*Number(r.qty)/Number(r.nominal):null;
       if(pct!=null){const track=node("div"),bar=node("div");Object.assign(track.style,{height:"8px",borderRadius:"8px",background:"#88888830",overflow:"hidden",margin:"8px 0"});Object.assign(bar.style,{height:"100%",width:Math.max(0,Math.min(100,pct))+"%",background:low(r)?"#d99a35":"#459a70"});track.append(bar);body.append(track);}
       body.append(node("div",fmt(r.qty,2)+" g"+(pct==null?"":" · "+fmt(pct)+" %")+(r.estimated_value==null?"":" · "+money(r.estimated_value)),"small"));
       if(low(r))body.append(node("div","Niedriger Rollenbestand","small text-warning"));
       a.append(sw,body,node("span","›"));list.append(a);
     }
   }
 }
 for(const k of ["search","low","group",...keys])el(k).addEventListener(k==="search"?"input":"change",render);
 fetch("/api/method/nippey_print.filament.inventory_overview",{credentials:"same-origin",cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(({message:m})=>{
   rows=m.rows;for(const k of keys){el(k).replaceChildren(new Option("Alle",""));for(const v of [...new Set(rows.map(r=>r[k]).filter(Boolean))].sort((a,b)=>a.localeCompare(b)))el(k).add(new Option(v,v));}
   el("status").textContent="Lager: "+m.warehouse+" · Aktive Rollen";render();
 }).catch(e=>{el("status").textContent="Bestand konnte nicht geladen werden: "+e.message;});
})();
