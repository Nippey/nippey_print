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
                select.dispatchEvent(new CustomEvent("change",{detail:{preserveMetadata:true}}));
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
        if(code!==label && !completed && !byId("spool").hidden && [...byId("spool").querySelectorAll("input")].some(e=>e.value && e.id!=="nominal" && e.id!=="color-picker") && !confirm("Rollennummer wechseln und bisherige Eingaben verwerfen?")) return;
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
    async function metadata(event){
        const seq=++metaSeq;
        const args=Object.fromEntries(["material","manufacturer","colour"].map(k=>[k,byId(k).value]));
        const fallback={red:"#ff0000",green:"#008000",blue:"#0000ff",black:"#000000",white:"#ffffff"};
        if(!event?.detail?.preserveMetadata && args.colour!=="__new__" && args.manufacturer!=="__new__"){hex.value="";byId("ral").value="";byId("manufacturer-color").value="";}sync();
        if(!hex.value)picker.value=fallback[args.colour.toLowerCase()]||"#808080";
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
    // RAL Classic screen approximations, see docs/ral-palette.md.
    const ralColors={"1000":["Green beige","#CDBA88"],"1001":["Beige","#D0B084"],"1002":["Sand yellow","#D2AA6D"],"1003":["Signal yellow","#F9A800"],"1004":["Golden yellow","#E49E00"],"1005":["Honey yellow","#CB8E00"],"1006":["Maize yellow","#E29000"],"1007":["Daffodil yellow","#E88C00"],"1011":["Brown beige","#AF804F"],"1012":["Lemon yellow","#DDAF27"],"1013":["Oyster white","#E3D9C6"],"1014":["Ivory","#DDC49A"],"1015":["Light ivory / Gaz's Beige","#E6D2B5"],"1016":["Sulfur yellow","#F1DD38"],"1017":["Saffron yellow","#F6A950"],"1018":["Zinc yellow","#FACA30"],"1019":["Grey beige","#A48F7A"],"1020":["Olive yellow","#A08F65"],"1021":["Rape yellow","#F6B600"],"1023":["Traffic yellow","#F7B500"],"1024":["Ochre yellow","#BA8F4C"],"1026":["Luminous yellow","#FFFF00"],"1027":["Curry","#A77F0E"],"1028":["Melon yellow","#FF9B00"],"1032":["Broom yellow","#E2A300"],"1033":["Dahlia yellow","#F99A1C"],"1034":["Pastel yellow","#EB9C52"],"1035":["Pearl beige","#908370"],"1036":["Pearl gold","#80643F"],"1037":["Sun yellow","#F09200"],"2000":["Yellow orange","#DD7907"],"2001":["Red orange","#BE4E20"],"2002":["Vermillion","#C63927"],"2003":["Pastel orange","#FA842B"],"2004":["Pure orange","#E75B12"],"2005":["Luminous orange","#FF2300"],"2007":["Luminous bright orange","#FFA421"],"2008":["Bright red orange","#F3752C"],"2009":["Traffic orange","#E15501"],"2010":["Signal orange","#D4652F"],"2011":["Deep orange","#EC7C25"],"2012":["Salmon orange","#DB6A50"],"2013":["Pearl orange","#954527"],"3000":["Flame red","#AB2524"],"3001":["Signal red","#A02128"],"3002":["Carmine red","#A1232B"],"3003":["Ruby red","#8D1D2C"],"3004":["Purple red","#701F29"],"3005":["Wine red","#5E2028"],"3007":["Black red","#402225"],"3009":["Oxide red","#703731"],"3011":["Brown red","#7E292C"],"3012":["Beige red","#CB8D73"],"3013":["Tomato red","#9C322E"],"3014":["Antique pink","#D47479"],"3015":["Light pink","#E1A6AD"],"3016":["Coral red","#AC4034"],"3017":["Rose","#D3545F"],"3018":["Strawberry red","#D14152"],"3020":["Traffic red","#C1121C"],"3022":["Salmon pink","#D56D56"],"3024":["Luminous red","#F70000"],"3026":["Luminous bright red","#FF0000"],"3027":["Raspberry red","#B42041"],"3028":["Pure red","#E72512"],"3031":["Orient red","#AC323B"],"3032":["Pearl ruby red","#711521"],"3033":["Pearl pink","#B24C43"],"4001":["Red lilac","#8A5A83"],"4002":["Red violet","#933D50"],"4003":["Heather violet","#D15B8F"],"4004":["Claret violet","#691639"],"4005":["Blue lilac","#83639D"],"4006":["Traffic purple","#992572"],"4007":["Purple violet","#4A203B"],"4008":["Signal violet","#904684"],"4009":["Pastel violet","#A38995"],"4010":["Telemagenta","#C63678"],"4011":["Pearl violet","#8773A1"],"4012":["Pearl blackberry","#6B6880"],"5000":["Violet blue","#384C70"],"5001":["Green blue","#1F4764"],"5002":["Ultramarine blue","#2B2C7C"],"5003":["Sapphire blue","#2A3756"],"5004":["Black blue","#1D1F2A"],"5005":["Signal blue","#154889"],"5007":["Brilliant blue","#41678D"],"5008":["Grey blue","#313C48"],"5009":["Azure blue","#2E5978"],"5010":["Gentian blue","#13447C"],"5011":["Steel blue","#232C3F"],"5012":["Light blue","#3481B8"],"5013":["Cobalt blue","#232D53"],"5014":["Pigeon blue","#6C7C98"],"5015":["Sky blue","#2874B2"],"5017":["Traffic blue","#0E518D"],"5018":["Turquoise blue","#21888F"],"5019":["Capri blue","#1A5784"],"5020":["Ocean blue","#0B4151"],"5021":["Water blue","#07737A"],"5022":["Night blue","#2F2A5A"],"5023":["Distant blue","#4D668E"],"5024":["Pastel blue","#6A93B0"],"5025":["Pearl Gentian blue","#296478"],"5026":["Pearl night blue","#102C54"],"6000":["Patina green","#327662"],"6001":["Emerald green","#28713E"],"6002":["Leaf green","#276235"],"6003":["olive green","#4B573E"],"6004":["Blue green","#0E4243"],"6005":["Moss green","#0F4336"],"6006":["Grey olive","#40433B"],"6007":["Bottle green","#283424"],"6008":["Brown green","#35382E"],"6009":["Fir green","#26392F"],"6010":["Grass green","#3E753B"],"6011":["Reseda green","#68825B"],"6012":["Black green","#31403D"],"6013":["Reed green","#797C5A"],"6014":["Yellow olive","#444337"],"6015":["Black olive","#3D403A"],"6016":["Turquoise green","#026A52"],"6017":["May green","#468641"],"6018":["Yellow green","#48A43F"],"6019":["pastel green","#B7D9B1"],"6020":["Chrome green","#354733"],"6021":["Pale green","#86A47C"],"6022":["Brown olive","#3E3C32"],"6024":["Traffic green","#008754"],"6025":["Fern green","#53753C"],"6026":["Opal green","#005D52"],"6027":["Light green","#81C0BB"],"6028":["Pine green","#2D5546"],"6029":["Mint green","#007243"],"6032":["Signal green","#0F8558"],"6033":["Mint turquoise","#478A84"],"6034":["Pastel turquoise","#7FB0B2"],"6035":["Pearl green","#1B542C"],"6036":["Pearl opal green","#005D4C"],"6037":["Pure green","#25E712"],"6038":["Luminous green","#00F700"],"7000":["Squirrel grey","#7E8B92"],"7001":["Silver grey","#8F999F"],"7002":["Olive grey","#817F68"],"7003":["Moss grey","#7A7B6D"],"7004":["Signal grey","#9EA0A1"],"7005":["Mouse grey","#6B716F"],"7006":["Beige grey","#756F61"],"7008":["Khaki grey","#746643"],"7009":["Green grey","#5B6259"],"7010":["Tarpaulin grey","#575D57"],"7011":["Iron grey","#555D61"],"7012":["Basalt grey","#596163"],"7013":["Brown-grey also NATO-olive also Stone-grey-olive","#555548"],"7015":["Slate grey","#51565C"],"7016":["Anthracite grey","#373F43"],"7021":["Black grey","#2E3234"],"7022":["Umbra grey","#4B4D46"],"7023":["Concrete grey","#818479"],"7024":["Graphite grey","#474A50"],"7026":["Granite grey","#374447"],"7030":["Stone grey","#939388"],"7031":["Blue grey","#5D6970"],"7032":["Pebble grey","#B9B9A8"],"7033":["Cement grey","#818979"],"7034":["Yellow grey","#939176"],"7035":["Light grey","#CBD0CC"],"7036":["Platinum grey","#9A9697"],"7037":["Dusty grey","#7C7F7E"],"7038":["Agate grey","#B4B8B0"],"7039":["Quartz grey","#6B695F"],"7040":["Window grey","#9DA3A6"],"7042":["Traffic grey A","#8F9695"],"7043":["Traffic grey B","#4E5451"],"7044":["Silk grey","#BDBDB2"],"7045":["Telegrey 1","#91969A"],"7046":["Telegrey 2","#82898E"],"7047":["Telegrey 4","#CFD0CF"],"7048":["Pearl mouse grey","#888175"],"8000":["Green brown","#887142"],"8001":["Ochre brown","#9C6B30"],"8002":["Signal brown","#7B5141"],"8003":["Clay brown","#80542F"],"8004":["Copper brown","#8F4E35"],"8007":["Fawn brown","#6F4A2F"],"8008":["Olive brown","#6F4F28"],"8011":["Nut brown","#5A3A29"],"8012":["Red brown","#673831"],"8014":["Sepia brown","#49392D"],"8015":["Chestnut brown","#633A34"],"8016":["Mahogany brown","#4C2F26"],"8017":["Chocolate brown","#44322D"],"8019":["Grey brown","#3F3A3A"],"8022":["Black brown","#211F20"],"8023":["Orange brown","#A65E2F"],"8024":["Beige brown","#79553C"],"8025":["Pale brown","#755C49"],"8028":["Terra brown","#4E3B2B"],"8029":["Pearl copper","#773C27"],"9001":["Cream","#EFEBDC"],"9002":["Grey white","#DDDED4"],"9003":["Signal white","#F4F8F4"],"9004":["Signal black","#2E3032"],"9005":["Jet black","#0A0A0D"],"9006":["White aluminium","#A5A8A6"],"9007":["Grey aluminium","#8F8F8C"],"9010":["Pure white","#F7F9EF"],"9011":["Graphite black","#292C2F"],"9016":["Traffic white","#F7FBF5"],"9017":["Traffic black","#2A2D2F"],"9018":["Papyrus white","#CFD3CD"],"9022":["Pearl light grey","#9C9C9C"],"9023":["Pearl dark grey","#7E8182"]};
    const ralInput=byId("ral"), lookup=document.createElement("button");
    lookup.type="button";lookup.className="btn btn-secondary mt-2";lookup.textContent="RAL abrufen";
    const ralStatus=document.createElement("div");ralStatus.setAttribute("role","status");
    ralInput.after(lookup,ralStatus);
    lookup.addEventListener("click",()=>{
        const code=ralInput.value.trim().replace(/^RAL\s*/i,"");
        const entry=ralColors[code];
        if(!/^\d{4}$/.test(code)||!entry){ralStatus.textContent="Unbekannter RAL-Classic-Code.";return;}
        const [name,color]=entry, select=byId("colour");
        const existing=[...select.options].find(o=>o.value.toLowerCase()===name.toLowerCase());
        select.value=existing?existing.value:"__new__";
        if(!existing)byId("colour-name").value=name;
        ralInput.value=code;hex.value=color;sync();
        select.dispatchEvent(new CustomEvent("change",{detail:{preserveMetadata:true}}));
        ralStatus.textContent=name+" · "+color+" (Bildschirmannäherung)"+(existing?"":" – bitte Farbe anlegen.");
    });
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
            if(m.status==="Active" && Number(m.qty)>0){
                const panel=document.createElement("div"), open=document.createElement("button");
                open.type="button";open.className="btn btn-primary w-100 mb-2";open.textContent="Verbrauch erfassen";
                panel.className="border rounded p-3 mb-3";panel.hidden=new URLSearchParams(location.search).get("mode")!=="consume";
                const field=(label,control)=>{const title=document.createElement("label");title.textContent=label;title.className="d-block";title.append(control);panel.append(title);control.className="form-control mb-2";return control;};
                const grams=field("Verbrauch (g)",document.createElement("input"));grams.type="number";grams.min="0.001";grams.max=String(m.qty);grams.step="0.001";
                const select=(label,options)=>{const s=field(label,document.createElement("select"));for(const [v,t] of options)s.add(new Option(t,v));return s;};
                const purpose=select("Verwendungszweck",[["Production","Produktion"],["Development","Entwicklung"],["Private","Privat"],["Maintenance","Wartung"],["Other","Sonstiges"]]);
                const outcome=select("Druckergebnis",[["Successful","Erfolgreich"],["Failed","Fehldruck"],["Support","Stützmaterial"],["Purge","Spülmaterial"],["Waste","Sonstiger Ausschuss"]]);
                const note=field("Notiz / Auftragsreferenz (optional)",document.createElement("textarea"));note.maxLength=500;
                const preview=document.createElement("p"),result=document.createElement("p"),save=document.createElement("button");result.setAttribute("role","status");
                save.type="button";save.className="btn btn-success w-100";save.textContent="Verbrauch buchen";
                const update=()=>{const g=grams.valueAsNumber;const valid=Number.isFinite(g)&&g>0&&g<=Number(m.qty)&&grams.checkValidity();save.disabled=!valid;preview.textContent=valid?"Neuer Restbestand: "+format(Number(m.qty)-g," g")+(m.estimated_value==null?"":" · Verbrauch geschätzt: "+format(g*Number(m.estimated_value)/Number(m.qty)," €")):"Bitte Verbrauchsmenge eingeben.";};
                grams.addEventListener("input",update);open.addEventListener("click",()=>{panel.hidden=!panel.hidden;if(!panel.hidden)grams.focus();});
                save.addEventListener("click",async()=>{if(save.disabled)return;for(const x of [grams,purpose,outcome,note,save,open])x.disabled=true;result.textContent="Buchung läuft …";
                    try{
                        if(!window.frappe?.csrf_token)throw Error("CSRF-Token fehlt");
                        const r=await fetch("/api/method/nippey_print.filament.consume_spool",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},body:JSON.stringify({label,grams:grams.value,expected_qty:m.qty,purpose:purpose.value,outcome:outcome.value,note:note.value})});
                        const data=await r.json();if(!r.ok||!data.message?.stock_entry)throw Error("HTTP "+r.status);
                        await showSpool();const msg=document.createElement("p");msg.className="text-success";msg.textContent="Verbrauch gebucht: "+data.message.stock_entry;card.prepend(msg);
                    }catch(e){result.textContent="Buchung nicht bestätigt: "+e.message+". Bitte neu laden und Bestand prüfen.";}
                });
                panel.append(preview,save,result);card.append(open,panel);update();
            }
            if(m.status==="Active" && m.qty!=null && m.tare!=null && Number(m.nominal)>0){
                const panel=document.createElement("div"), button=document.createElement("button");
                button.type="button";button.className="btn btn-primary w-100";button.textContent="Erneut wiegen";
                panel.hidden=true;panel.className="mt-3";
                const weight=document.createElement("input"), reason=document.createElement("input"), result=document.createElement("p"), save=document.createElement("button");
                weight.type="number";weight.step="any";weight.min="0";weight.className="form-control mb-2";weight.placeholder="Aktuelles Gesamtgewicht (g)";weight.setAttribute("aria-label",weight.placeholder);weight.value=String(Math.round((Number(m.qty)+Number(m.tare))*1000)/1000);
                reason.className="form-control mb-2";reason.placeholder="Grund der Bestandskorrektur";reason.setAttribute("aria-label",reason.placeholder);reason.maxLength=500;reason.value="Inventur";
                const preview=document.createElement("p");result.setAttribute("role","status");
                save.type="button";save.className="btn btn-success w-100";save.textContent="Wiegung speichern";
                function update(){
                    const n=weight.valueAsNumber-Number(m.tare), d=n-Number(m.qty);
                    const valid=Number.isFinite(n)&&n>=0&&n<=Number(m.nominal)*1.1;
                    preview.textContent=valid?format(n," g")+" verbleiben · Korrektur: "+(d>0?"+":"")+format(d," g"):"Bitte gültiges Gesamtgewicht eingeben.";
                    save.disabled=!valid||!reason.value.trim();
                }
                weight.addEventListener("input",update);reason.addEventListener("input",update);
                button.addEventListener("click",()=>{panel.hidden=!panel.hidden;if(!panel.hidden){weight.focus();weight.select();}});
                save.addEventListener("click",async()=>{
                    if(save.disabled)return;save.disabled=true;weight.disabled=true;reason.disabled=true;result.textContent="Wiegung wird gespeichert …";
                    try{
                        if(!window.frappe?.csrf_token)throw Error("CSRF-Token fehlt");
                        const r=await fetch("/api/method/nippey_print.filament.reweigh_spool",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-Frappe-CSRF-Token":frappe.csrf_token},body:JSON.stringify({label,gross:weight.value,expected_qty:m.qty,reason:reason.value})});
                        const payload=await r.json();
                        if(!r.ok){let detail="";try{detail=JSON.parse(payload._server_messages||"[]").map(x=>JSON.parse(x).message).join(" ");}catch{}throw Error("HTTP "+r.status+(detail?" – "+detail:""));}
                        await showSpool();
                        const message=document.createElement("p");message.className="text-success";message.textContent="Wiegung gespeichert"+(payload.message.stock_entry?" · "+payload.message.stock_entry:" (keine Bestandsänderung)");byId("spool-card").prepend(message);
                    }catch(e){result.textContent="Nicht bestätigt: "+e.message+". Bitte Seite neu laden und Bestand prüfen.";}
                });
                panel.append(weight,reason,preview,save,result);card.append(button,panel);update();
            }
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
