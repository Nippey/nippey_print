(() => {
    const el = id => document.getElementById("label-" + id);
    const api = "/api/method/nippey_print.labels.";
    let formats = [], busy = false, nextRoll = null;
    const selected = () => formats.find(x => x.name === el("format").value);
    const status = text => { el("status").textContent = text; };
    const url = (method, args) => api + method + "?" + new URLSearchParams(args);
    function preview(target, f, start, count, onPick, ids=[]) {
        target.replaceChildren();
        if(!f || !f.page_width || !f.page_height || !f.columns || !f.rows)return;
        const cap=f.columns*f.rows;
        if(!Number.isInteger(start)||start<1||start>cap||!Number.isInteger(count)||count<1)return;
        const pages=Math.ceil((start-1+count)/cap);
        if(pages>500)return;
        const hint=document.createElement("p"); hint.className="small text-muted";
        hint.textContent="Startposition auf dem ersten Bogen antippen. Grün = Druckbereich.";
        target.append(hint);
        for(let page=0;page<pages;page++){
            const caption=document.createElement("p");caption.className="small mb-1";caption.textContent="Bogen "+(page+1)+" / "+pages;target.append(caption);
            const paper=document.createElement("div");
            Object.assign(paper.style,{position:"relative",width:"100%",maxWidth:"420px",aspectRatio:f.page_width+" / "+f.page_height,background:"#fff",border:"1px solid #aaa",marginBottom:"12px"});
            for(let i=0;i<cap;i++){
                const index=page*cap+i-start+1, printed=index>=0&&index<count;
                const b=document.createElement("button");b.type="button";
                b.textContent=printed?(ids[index]||"–"):String(i+1);
                b.title="Position "+(i+1)+(printed?" – Etikett "+(ids[index]||"–"):" – frei");
                b.setAttribute("aria-label",b.title);
                Object.assign(b.style,{position:"absolute",left:(100*(Number(f.margin_left)+(i%f.columns)*f.pitch_x)/f.page_width)+"%",top:(100*(Number(f.margin_top)+Math.floor(i/f.columns)*f.pitch_y)/f.page_height)+"%",width:(100*f.label_width/f.page_width)+"%",height:(100*f.label_height/f.page_height)+"%",background:printed?"#c3e6cc":"#eee",color:printed?"#245738":"#666",border:page===0&&i===start-1?"2px solid #25834c":"1px solid #bbb",borderRadius:"2px",fontSize:"10px",padding:"0",overflow:"hidden"});
                if(page===0)b.addEventListener("click",()=>onPick(i+1));else b.disabled=true;
                paper.append(b);
            }
            target.append(paper);
        }
    }
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
        preview(el("preview"),f,Number(el("start").value),Number(el("count").value),pos=>{if(busy)return;el("start").value=pos;sync();},Array.from({length:Math.max(0,Math.min(500,Number(el("count").value)||0))},(_,i)=>nextRoll===null?"–":"ROLL-"+String(nextRoll+i).padStart(5,"0")));
    }
    async function load() {
        const response = await fetch(api + "get_print_options", {credentials:"same-origin"});
        if (!response.ok) throw Error("HTTP " + response.status);
        const {message: data} = await response.json();
        formats = data.formats;
        nextRoll = data.next_roll;
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
    el("count").addEventListener("input", () => sync());
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
    let source=null, sourceIds=[], sourceSeq=0;
    function reprintSync(){
        const f=formats.find(x=>x.name===el("reprint-format").value);
        const cap=f?f.columns*f.rows:0;
        const start=Number(el("reprint-start").value), first=Number(el("reprint-first").value);
        let count=Number(el("reprint-count").value);
        if(source && Number.isInteger(first) && first>=1 && first<=source.label_count && count>source.label_count-first+1){count=source.label_count-first+1;el("reprint-count").value=count;}
        el("reprint-start").max=cap;
        el("reprint-count").max=source?source.label_count-first+1:0;
        const valid=!!source && sourceIds.length===source.label_count && !!f?.verified && start>=1 && start<=cap && first>=1 && count>=1 && first+count-1<=source.label_count && [start,first,count].every(Number.isInteger);
        el("reprint-download").disabled=!valid;
        preview(el("reprint-preview"),f,start,source&&first+count-1<=source.label_count?count:0,pos=>{el("reprint-start").value=pos;reprintSync();},sourceIds.slice(first-1,first-1+count));
        el("reprint-pages").textContent=valid?Math.ceil((start-1+count)/cap)+" Druckbogen – keine neuen IDs.":"Bitte bestätigtes Format und gültigen Bereich wählen.";
    }
    async function openReprint(s){
        const seq=++sourceSeq;
        source=s; sourceIds=[];
        el("reprint-source").textContent=s.name+" ("+s.label_count+" Etiketten)";
        el("reprint-format").replaceChildren(...formats.map(f=>new Option(f.name+(f.verified?"":" (unbestätigt)"),f.name)));
        el("reprint-format").value=s.label_format;
        el("reprint-start").value=1;
        el("reprint-first").value=1; el("reprint-first").max=s.label_count;
        el("reprint-count").value=s.label_count;
        el("reprint-form").hidden=false; reprintSync();
        el("reprint-form").scrollIntoView({block:"nearest"});
        try{const r=await fetch(url("sheet_labels",{sheet:s.name}),{credentials:"same-origin"});if(!r.ok)throw Error("HTTP "+r.status);const {message}=await r.json();if(seq!==sourceSeq)return;sourceIds=message;reprintSync();}catch(e){if(seq===sourceSeq)el("reprint-pages").textContent="Etiketten konnten nicht geladen werden: "+e.message;}
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
