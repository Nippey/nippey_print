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
            p.append(a); return p;
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
    load().then(() => status("Bereit. Unbestätigte Formate zuerst kalibrieren.")).catch(e => status("Fehler: " + e.message));
})();
