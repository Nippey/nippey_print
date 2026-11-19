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
            byId("status").textContent = "Stammdaten geladen. Bitte QR-Etikett scannen, um eine Rolle zu erfassen.";
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
                byId(id+"-name").value = "";
                byId("status").textContent = "Stammdatum gespeichert.";
                calculate();
            } catch(e) { byId("status").textContent = "Fehler: "+e.message; }
            finally {button.disabled = false;}
        });
    }
    const label = new URLSearchParams(location.search).get("label");
    if (label) {
        byId("label-info").textContent = "Prüfe Etikett …";
        fetch("/api/method/nippey_print.filament.get_label?"+new URLSearchParams({label}),{credentials:"same-origin"})
            .then(r=>{if(!r.ok) throw Error("HTTP "+r.status);return r.json();})
            .then(({message:m})=>{reserved=m.status==="Reserved" && !m.batch; calculate(); byId("label-info").textContent = m.name+" – "+({Reserved:"Reserviert",Active:"Aktiv",Empty:"Leer",Archived:"Archiviert"}[m.status]||m.status)+(m.batch?" / "+m.batch:"");})
            .catch(e=>{byId("label-info").textContent="Etikett nicht verfügbar: "+e.message;});
    }
    calculate();
})();
