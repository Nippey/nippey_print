(() => {
    const byId = id => document.getElementById(id);
    const fill = (id, rows) => {
        const select = byId(id);
        select.replaceChildren(new Option("Bitte wählen", ""));
        for (const row of rows) select.add(new Option(row.label, row.value));
        if (id !== "material") select.add(new Option("+ Neu anlegen", "__new__"));
    };
    let reserved = false, busy = false, completed = false;
    function calculate() {
        const fields = ["nominal", "gross", "tare", "price"].map(byId);
        const [n,g,t,p] = fields.map(el => el.valueAsNumber);
        const valid = Number.isFinite(g) && Number.isFinite(t) && g >= t && t >= 0;
        byId("net").textContent = valid ? (g-t).toLocaleString("de-DE") + " g" : "–";
        byId("save-spool").disabled = busy || completed;
        byId("worth").textContent = valid && n > 0 && p >= 0 ? ((g-t)*p/n).toLocaleString("de-DE",{style:"currency",currency:"EUR"}) : "–";
    }
    byId("spool").addEventListener("input", calculate);
    async function save(event) {
        event.preventDefault();
        const result=byId("save-result");
        if(busy || completed)return;
        const fail=message=>{result.textContent=message;result.scrollIntoView({block:"nearest"});};
        if(!reserved)return fail("Bitte eine reservierte Rollennummer auswählen oder den Etikettenstatus neu laden.");
        if(["material","manufacturer","colour"].some(id=>!byId(id).value || byId(id).value==="__new__"))return fail("Bitte Material, Hersteller und Farbe auswählen.");
        const [n,g,t,p]=["nominal","gross","tare","price"].map(id=>byId(id).valueAsNumber);
        if(![n,g,t,p].every(Number.isFinite)||n<=0||t<0||g<=t||g-t>n*1.1||p<0)return fail("Bitte Gewichte und Einkaufspreis prüfen. Die Nettofüllmenge muss positiv sein und darf höchstens 110 % des Nenngewichts betragen.");
        if(!byId("spool").reportValidity())return fail("Bitte die markierten Eingabefelder prüfen.");
        busy=true; calculate();
        result.textContent="Lagerbuchung läuft …";
        try {
            if (!window.frappe?.csrf_token) throw Error("CSRF-Token fehlt");
            const data={label};
            for(const key of ["material","manufacturer","colour","nominal","gross","tare","price","ral"]) data[key]=byId(key).value;
            data.manufacturer_color=byId("manufacturer-color").value.trim();
            data.display_color=byId("display-color").value.trim();
            const response=await fetch("/api/method/nippey_print.filament.register_spool",{
                method:"POST", credentials:"same-origin",cache:"no-store",
                headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},
                body:JSON.stringify(data)
            });
            const payload=await response.json();
            if(!response.ok) {
                let detail="";
                try {detail=JSON.parse(payload._server_messages||"[]").map(x=>JSON.parse(x).message).join(" ");} catch {}
                throw Error("HTTP "+response.status+(detail?" – "+detail:""));
            }
            const m=payload.message;
            if(!m?.stock_entry) throw Error("Keine Buchungsbestätigung");
            reserved=false; completed=true;
            byId("label-info").textContent=m.label+" – Aktiv / "+m.batch;
            result.textContent="Rolle erfolgreich erfasst.\nArtikel: "+m.item+"\nRestmenge: "+m.net+" g\nLagerbuchung: "+m.stock_entry;
            for(const el of byId("spool").querySelectorAll("input,select,button")) el.disabled=true;
        } catch(e) {
            reserved=false;
            result.textContent="Buchung nicht bestätigt: "+e.message+"\nBitte Etikettenstatus durch erneutes Laden prüfen, bevor du erneut speicherst.";
        } finally {busy=false;calculate();}
    }
    byId("save-spool").addEventListener("click",save);
    byId("spool").addEventListener("submit",save);
    fetch("/api/method/nippey_print.filament.get_options", {credentials:"same-origin",cache:"no-store"})
        .then(response => { if (!response.ok) throw Error("HTTP " + response.status); return response.json(); })
        .then(({message:m}) => {
            fill("material",m.materials.map(x=>({value:x.item_code,label:x.item_name})));
            fill("manufacturer",m.manufacturers.map(x=>({value:x.value,label:x.value})));
            fill("colour",m.colours.map(x=>({value:x.value,label:x.value})));
            byId("status").textContent = "Stammdaten geladen. QR-Etikett scannen oder Rollennummer auswählen.";
            calculate();
        })
        .catch(error => { byId("status").textContent = "Stammdaten konnten nicht geladen werden: " + error.message; });
    for (const [id, attr] of [["manufacturer","Manufacturer"],["colour","Colour"]]) {
        const select = byId(id), panel = byId(id+"-new"), button = byId(id+"-add");
        select.addEventListener("change", () => {panel.hidden = select.value !== "__new__";});
        button.addEventListener("click", async () => {
            const value = byId(id+"-name").value.trim();
            if (!value || button.disabled) return;
            button.disabled = true;
            try {
                if (!window.frappe?.csrf_token) throw Error("CSRF-Token fehlt");
                const response = await fetch("/api/method/nippey_print.filament.add_attribute_value", {
                    method:"POST", credentials:"same-origin",cache:"no-store",
                    headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},
                    body:JSON.stringify({attribute:attr,value})
                });
                if (!response.ok) throw Error("HTTP " + response.status);
                const {message:m} = await response.json();
                if (![...select.options].some(o => o.value === m.value)) {
                    select.add(new Option(m.value,m.value),select.options.length-1);
                }
                select.value = m.value; panel.hidden = true;
                select.dispatchEvent(new Event("change"));
                byId(id+"-name").value = "";
                byId("status").textContent = "Stammdatum gespeichert.";
                calculate();
            } catch(e) { byId("status").textContent = "Fehler: "+e.message; }
            finally {button.disabled = false;}
        });
    }
    const label = new URLSearchParams(location.search).get("label");
    const manual=byId("manual-label");
    manual.value=label||"";
    let searchSeq=0, matches=[];
    const dropdown=byId("available-labels"), choose=byId("choose-label");
    choose.disabled=true;
    async function suggestions(){
        const seq=++searchSeq;
        matches=[]; choose.disabled=true;
        dropdown.hidden=false;
        dropdown.textContent="Suche …";
        const query=manual.value.trim().toUpperCase();
        try {
            const r=await fetch("/api/method/nippey_print.filament.available_labels?"+new URLSearchParams({query}),{credentials:"same-origin",cache:"no-store"});
            if(!r.ok) throw Error("HTTP "+r.status);
            const {message}=await r.json();
            if(seq!==searchSeq)return;
            matches=message;
            dropdown.replaceChildren();
            const exact="ROLL-"+query.replace(/^ROLL-/,"").padStart(5,"0");
            choose.disabled=!matches.includes(exact);
            if(!matches.length)dropdown.textContent="Keine reservierte Rollennummer gefunden.";
            for(const code of matches){
                const b=document.createElement("button");
                b.type="button"; b.className="list-group-item list-group-item-action";
                b.textContent=code; b.addEventListener("click",()=>chooseLabel(code));
                dropdown.append(b);
            }
        } catch(e) {
            if(seq===searchSeq)dropdown.textContent="Suche fehlgeschlagen: "+e.message;
        }
    }
    manual.addEventListener("focus",suggestions);
    manual.addEventListener("input",suggestions);
    function chooseLabel(code){
        if(!matches.includes(code))return;
        if(code!==label && [...byId("spool").querySelectorAll("input")].some(e=>e.value && e.id!=="nominal" && e.id!=="color-picker") && !confirm("Rollennummer wechseln und bisherige Eingaben verwerfen?")) return;
        location.href="/nippey-print?"+new URLSearchParams({label:code});
    }
    function chooseExact(){
        const q=manual.value.trim().toUpperCase();
        if(!/^(ROLL-)?[0-9]{1,12}$/.test(q))return;
        chooseLabel("ROLL-"+q.replace(/^ROLL-/,"").padStart(5,"0"));
    }
    choose.addEventListener("click",chooseExact);
    manual.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();chooseExact();}if(e.key==="Escape")dropdown.hidden=true;});
    const hex=byId("display-color"), picker=byId("color-picker");
    const sync=()=>{picker.value=/^#[0-9a-f]{6}$/i.test(hex.value)?hex.value:"#808080";calculate();};
    picker.addEventListener("input",()=>{hex.value=picker.value;calculate();});
    hex.addEventListener("input",sync);
    byId("clear-color").addEventListener("click",()=>{hex.value="";sync();});
    let metaSeq=0;
    async function metadata(){
        const seq=++metaSeq;
        const args=Object.fromEntries(["material","manufacturer","colour"].map(k=>[k,byId(k).value]));
        const fallback={red:"#ff0000",green:"#008000",blue:"#0000ff",black:"#000000",white:"#ffffff"};
        hex.value="";byId("ral").value="";byId("manufacturer-color").value="";sync();
        picker.value=fallback[args.colour.toLowerCase()]||"#808080";
        if(Object.values(args).some(v=>!v||v==="__new__"))return;
        try{
            const r=await fetch("/api/method/nippey_print.filament.colour_metadata?"+new URLSearchParams(args),{credentials:"same-origin",cache:"no-store"});
            if(!r.ok)return;
            const {message:m}=await r.json();
            if(seq!==metaSeq)return;
            if(!hex.value && m.display_color){hex.value=m.display_color;sync();}
            if(!byId("ral").value)byId("ral").value=m.ral||"";
            if(!byId("manufacturer-color").value)byId("manufacturer-color").value=m.manufacturer_color||"";
        }catch{}
    }
    for(const k of ["material","manufacturer","colour"])byId(k).addEventListener("change",metadata);
    async function showSpool(){
        const card=byId("spool-card"); card.hidden=false; byId("spool").hidden=true;
        card.textContent="Rollendaten werden geladen …";
        try{
            const r=await fetch("/api/method/nippey_print.filament.spool_details?"+new URLSearchParams({label}),{credentials:"same-origin",cache:"no-store"});
            if(!r.ok)throw Error("HTTP "+r.status);
            const {message:m}=await r.json();
            const format=(v,unit="")=>v==null?"–":Number(v).toLocaleString("de-DE",{maximumFractionDigits:2})+unit;
            card.replaceChildren();
            const title=document.createElement("h3");title.textContent=m.label;card.append(title);
            if(Number(m.nominal)>0 && m.qty!=null){
                const percent=100*Number(m.qty)/Number(m.nominal);
                const summary=document.createElement("p");
                summary.className="h4 mt-3 mb-2";
                summary.textContent=format(percent," %")+" / "+format(m.qty," g")+" verbleiben";
                const track=document.createElement("div"),bar=document.createElement("div");
                Object.assign(track.style,{height:"16px",borderRadius:"999px",background:"#88888835",overflow:"hidden",marginBottom:"16px"});
                Object.assign(bar.style,{height:"100%",width:Math.max(0,Math.min(100,percent))+"%",background:"#459a70",borderRadius:"999px"});
                track.setAttribute("role","progressbar");track.setAttribute("aria-label","Verbleibendes Filament");track.setAttribute("aria-valuemin","0");track.setAttribute("aria-valuemax","100");track.setAttribute("aria-valuenow",String(Math.max(0,Math.min(100,percent))));track.setAttribute("aria-valuetext",summary.textContent);
                track.append(bar);card.append(summary,track);
            }
            const list=document.createElement("dl");
            for(const [key,value] of [["Artikel",m.item],["Material",m.material],["Hersteller",m.manufacturer],["Farbe",m.colour],["Hersteller-Farbbezeichnung",m.manufacturer_color],["RAL",m.ral],["Lager",m.warehouse],["Restbestand",format(m.qty," g")],["Restwert (geschätzt)",format(m.estimated_value," €")],["Nenngewicht",format(m.nominal," g")],["Leerrollengewicht",format(m.tare," g")],["Letztes Bruttogewicht",format(m.gross," g")],["Letzte Wiegung",m.last_weighing]]){
                const dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=key;dd.textContent=value??"–";list.append(dt,dd);
            }
            if(/^#[0-9a-f]{6}$/i.test(m.display_color||"")){const swatch=document.createElement("div");Object.assign(swatch.style,{width:"48px",height:"32px",backgroundColor:m.display_color,border:"1px solid #888",marginBottom:"12px"});card.append(swatch);}
            card.append(list);
        }catch(e){card.textContent="Rollendaten konnten nicht geladen werden: "+e.message;}
    }
    if (label) {
        byId("label-info").textContent = "Prüfe Etikett …";
        fetch("/api/method/nippey_print.filament.get_label?"+new URLSearchParams({label}),{credentials:"same-origin",cache:"no-store"})
            .then(r=>{if(!r.ok) throw Error("HTTP "+r.status);return r.json();})
            .then(({message:m})=>{reserved=m.status==="Reserved" && !m.batch; calculate(); byId("label-info").textContent = m.name+" – "+({Reserved:"Reserviert",Active:"Aktiv",Empty:"Leer",Archived:"Archiviert"}[m.status]||m.status)+(m.batch?" / "+m.batch:"");if(m.batch)showSpool();})
            .catch(e=>{byId("label-info").textContent="Etikett nicht verfügbar: "+e.message;});
    }
    calculate();
})();
