(() => {
    const el = id => document.getElementById("label-" + id);
    const api = "/api/method/nippey_print.labels.";
    let formats = [], busy = false;
    const selected = () => formats.find(x => x.name === el("format").value);
    const status = text => { el("status").textContent = text; };
    const url = (method, args) => api + method + "?" + new URLSearchParams(args);
    function sync(reset = false) {
        const f = selected();
        const capacity = f ? f.columns * f.rows : 0;
        el("start").max = capacity;
        if (reset) el("start").value = 1;
        const remaining = Math.max(0, capacity - Number(el("start").value) + 1);
        el("count").max = remaining;
        if (reset || Number(el("count").value) > remaining || !el("count").value) el("count").value = remaining;
        el("reserve").disabled = busy || !f || !f.verified;
        el("calibrate").disabled = busy || !f;
    }
    async function load() {
        const response = await fetch(api + "get_print_options", {credentials:"same-origin"});
        if (!response.ok) throw Error("HTTP " + response.status);
        const {message: data} = await response.json();
        formats = data.formats;
        const prior = el("format").value;
        el("format").replaceChildren(...formats.map(f => new Option(f.name + (f.verified ? "" : " (unbestätigt)"),f.name)));
        if (formats.some(f => f.name === (prior || data.default_format))) el("format").value = prior || data.default_format;
        el("sheets").replaceChildren(...data.sheets.map(s => {
            const p = document.createElement("p"), a = document.createElement("a");
            a.href = url("download_sheet",{sheet:s.name});
            a.textContent = s.name + " – " + s.label_format + " (" + s.label_count + ")";
            const b=document.createElement("button"); b.type="button"; b.className="btn btn-sm btn-secondary ml-2"; b.textContent="Erneut drucken"; b.addEventListener("click",()=>openReprint(s)); p.append(a,b); return p;
        }));
        sync(true);
    }
    el("format").addEventListener("change", () => sync(true));
    el("start").addEventListener("input", () => sync());
    el("calibrate").addEventListener("click", () => { location.href = url("calibration",{label_format:el("format").value}); });
    el("form").addEventListener("submit", async event => {
        event.preventDefault();
        if (busy || !selected()?.verified) return;
        busy = true; sync();
        try {
            if (!window.frappe?.csrf_token) throw Error("CSRF-Token nicht verfügbar");
            const response = await fetch(api + "reserve_sheet", {
                method:"POST", credentials:"same-origin",
                headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},
                body:JSON.stringify({label_format:el("format").value,start_position:Number(el("start").value),label_count:Number(el("count").value)})
            });
            if (!response.ok) throw Error("HTTP " + response.status);
            const {message:m} = await response.json();
            status(m.count + " IDs reserviert: " + m.sheet + ". PDF in der Liste öffnen.");
            await load();
        } catch (e) { status("Fehler: " + e.message + ". Vor erneutem Reservieren die Bogenliste prüfen."); }
        finally { busy = false; sync(); }
    });
    let source=null;
    function reprintSync(){
        const f=formats.find(x=>x.name===el("reprint-format").value);
        const cap=f?f.columns*f.rows:0;
        const start=Number(el("reprint-start").value), first=Number(el("reprint-first").value), count=Number(el("reprint-count").value);
        el("reprint-start").max=cap;
        el("reprint-count").max=source?source.label_count-first+1:0;
        const valid=!!source && !!f?.verified && start>=1 && start<=cap && first>=1 && count>=1 && first+count-1<=source.label_count && [start,first,count].every(Number.isInteger);
        el("reprint-download").disabled=!valid;
        el("reprint-pages").textContent=valid?Math.ceil((start-1+count)/cap)+" Druckbogen – keine neuen IDs.":"Bitte bestätigtes Format und gültigen Bereich wählen.";
    }
    function openReprint(s){
        source=s;
        el("reprint-source").textContent=s.name+" ("+s.label_count+" Etiketten)";
        el("reprint-format").replaceChildren(...formats.map(f=>new Option(f.name+(f.verified?"":" (unbestätigt)"),f.name)));
        el("reprint-format").value=s.label_format;
        el("reprint-start").value=1;
        el("reprint-first").value=1; el("reprint-first").max=s.label_count;
        el("reprint-count").value=s.label_count;
        el("reprint-form").hidden=false; reprintSync();
        el("reprint-form").scrollIntoView({block:"nearest"});
    }
    el("reprint-form").addEventListener("input",reprintSync);
    el("reprint-form").addEventListener("change",reprintSync);
    el("reprint-form").addEventListener("submit",e=>{
        e.preventDefault(); reprintSync();
        if(el("reprint-download").disabled)return;
        location.href=url("reprint_sheet",{sheet:source.name,label_format:el("reprint-format").value,start_position:el("reprint-start").value,first:el("reprint-first").value,count:el("reprint-count").value});
    });
    load().then(() => status("Bereit. Unbestätigte Formate zuerst kalibrieren.")).catch(e => status("Fehler: " + e.message));
})();
