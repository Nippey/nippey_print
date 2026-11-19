(() => {
    const byId = id => document.getElementById(id);
    const fill = (id, rows) => {
        const select = byId(id);
        select.replaceChildren(new Option("Bitte wählen", ""));
        for (const row of rows) select.add(new Option(row.label, row.value));
        if (id !== "material") select.add(new Option("+ Neu anlegen", "__new__"));
    };
    let reserved = false, busy = false;
    function calculate() {
        const fields = ["nominal", "gross", "tare", "price"].map(byId);
        const [n,g,t,p] = fields.map(el => el.valueAsNumber);
        const valid = Number.isFinite(g) && Number.isFinite(t) && g >= t && t >= 0;
        byId("net").textContent = valid ? (g-t).toLocaleString("de-DE") + " g" : "–";
        byId("save-spool").disabled = !reserved || busy || !valid || !(g>t && n>0 && g-t<=n*1.1 && Number.isFinite(p) && p>=0) || ["material","manufacturer","colour"].some(id=>!byId(id).value || byId(id).value==="__new__") || !byId("spool").checkValidity();
        byId("worth").textContent = valid && n > 0 && p >= 0 ? ((g-t)*p/n).toLocaleString("de-DE",{style:"currency",currency:"EUR"}) : "–";
    }
    byId("spool").addEventListener("input", calculate);
    byId("spool").addEventListener("submit", async event => {
        event.preventDefault();
        calculate();
        if (byId("save-spool").disabled) return;
        busy=true; calculate();
        const result=byId("save-result");
        result.textContent="Lagerbuchung läuft …";
        try {
            if (!window.frappe?.csrf_token) throw Error("CSRF-Token fehlt");
            const data={label};
            for(const key of ["material","manufacturer","colour","nominal","gross","tare","price","ral"]) data[key]=byId(key).value;
            data.manufacturer_color=byId("manufacturer-color").value.trim();
            data.display_color=byId("display-color").value.trim();
            const response=await fetch("/api/method/nippey_print.filament.register_spool",{
                method:"POST", credentials:"same-origin",
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
            reserved=false;
            byId("label-info").textContent=m.label+" – Aktiv / "+m.batch;
            result.textContent="Rolle erfolgreich erfasst.\nArtikel: "+m.item+"\nRestmenge: "+m.net+" g\nLagerbuchung: "+m.stock_entry;
            for(const el of byId("spool").querySelectorAll("input,select,button")) el.disabled=true;
        } catch(e) {
            reserved=false;
            result.textContent="Buchung nicht bestätigt: "+e.message+"\nBitte Etikettenstatus durch erneutes Laden prüfen, bevor du erneut speicherst.";
        } finally {busy=false;calculate();}
    });
    fetch("/api/method/nippey_print.filament.get_options", {credentials:"same-origin"})
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
                    method:"POST", credentials:"same-origin",
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
    let searchSeq=0;
    async function suggestions(){
        const seq=++searchSeq;
        try {
            const r=await fetch("/api/method/nippey_print.filament.available_labels?"+new URLSearchParams({query:manual.value}),{credentials:"same-origin"});
            if(!r.ok) throw Error("HTTP "+r.status);
            const {message}=await r.json();
            if(seq===searchSeq) byId("available-labels").replaceChildren(...message.map(v=>new Option(v,v)));
        } catch(e) { if(seq===searchSeq) byId("available-labels").replaceChildren(); }
    }
    manual.addEventListener("focus",suggestions);
    manual.addEventListener("input",suggestions);
    function chooseLabel(){
        const q=manual.value.trim().toUpperCase();
        if(!/^(ROLL-)?[0-9]{1,12}$/.test(q)) return;
        const code="ROLL-"+q.replace(/^ROLL-/,"").padStart(5,"0");
        if(code!==label && [...byId("spool").querySelectorAll("input")].some(e=>e.value && e.id!=="nominal" && e.id!=="color-picker") && !confirm("Rollennummer wechseln und bisherige Eingaben verwerfen?")) return;
        location.href="/nippey-print?"+new URLSearchParams({label:code});
    }
    byId("choose-label").addEventListener("click",chooseLabel);
    manual.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();chooseLabel();}});
    manual.addEventListener("change",()=>{if([...byId("available-labels").options].some(o=>o.value===manual.value)) chooseLabel();});
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
            const r=await fetch("/api/method/nippey_print.filament.colour_metadata?"+new URLSearchParams(args),{credentials:"same-origin"});
            if(!r.ok)return;
            const {message:m}=await r.json();
            if(seq!==metaSeq)return;
            if(!hex.value && m.display_color){hex.value=m.display_color;sync();}
            if(!byId("ral").value)byId("ral").value=m.ral||"";
            if(!byId("manufacturer-color").value)byId("manufacturer-color").value=m.manufacturer_color||"";
        }catch{}
    }
    for(const k of ["material","manufacturer","colour"])byId(k).addEventListener("change",metadata);
    if (label) {
        byId("label-info").textContent = "Prüfe Etikett …";
        fetch("/api/method/nippey_print.filament.get_label?"+new URLSearchParams({label}),{credentials:"same-origin"})
            .then(r=>{if(!r.ok) throw Error("HTTP "+r.status);return r.json();})
            .then(({message:m})=>{reserved=m.status==="Reserved" && !m.batch; calculate(); byId("label-info").textContent = m.name+" – "+({Reserved:"Reserviert",Active:"Aktiv",Empty:"Leer",Archived:"Archiviert"}[m.status]||m.status)+(m.batch?" / "+m.batch:"");})
            .catch(e=>{byId("label-info").textContent="Etikett nicht verfügbar: "+e.message;});
    }
    calculate();
})();
