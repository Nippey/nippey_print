import frappe

@frappe.whitelist()
def get_options():
    frappe.has_permission("Item", "read", throw=True)
    frappe.has_permission("Item Attribute", "read", throw=True)
    materials = frappe.get_list("Item", filters={"has_variants": 1, "item_code": ["like", "FIL-%"]}, fields=["name", "item_code", "item_name"], limit_page_length=100)
    attributes = {}
    for name in ("Manufacturer", "Colour"):
        doc = frappe.get_doc("Item Attribute", name)
        doc.check_permission("read")
        attributes[name] = [{"value": row.attribute_value, "abbr": row.abbr} for row in doc.item_attribute_values]
    return {"materials": materials, "manufacturers": attributes["Manufacturer"], "colours": attributes["Colour"]}


@frappe.whitelist(methods=["GET"])
def get_label(label):
    doc = frappe.get_doc("Filament Label", label)
    doc.check_permission("read")
    return {"name": doc.name, "status": doc.status, "batch": doc.batch}


@frappe.whitelist(methods=["POST"])
def add_attribute_value(attribute, value, abbr=None):
    import re
    import unicodedata
    if attribute not in ("Manufacturer", "Colour"):
        frappe.throw("Unsupported attribute")
    value = unicodedata.normalize("NFC", str(value or "")).strip()
    if not value or len(value) > 100 or any(unicodedata.category(c).startswith("C") for c in value):
        frappe.throw("Invalid attribute value")
    doc = frappe.get_doc("Item Attribute", attribute)
    doc.check_permission("write")
    frappe.db.sql("select name from `tabItem Attribute` where name=%s for update", (attribute,))
    doc.reload()
    for row in doc.item_attribute_values:
        if row.attribute_value.casefold() == value.casefold():
            return {"value": row.attribute_value, "abbr": row.abbr}
    used = {row.abbr.casefold() for row in doc.item_attribute_values}
    stem = re.sub("[^A-Z0-9]", "", unicodedata.normalize("NFKD", value.upper()))[:8] or "VAL"
    code = str(abbr or stem).strip().upper()
    if not re.fullmatch("[A-Z0-9]{1,12}", code):
        frappe.throw("Invalid abbreviation")
    if abbr and code.casefold() in used:
        frappe.throw("Abbreviation already in use")
    i = 2
    while code.casefold() in used:
        code = stem + str(i)
        i += 1
    doc.append("item_attribute_values", {"attribute_value": value, "abbr": code})
    doc.save()
    return {"value": value, "abbr": code}


@frappe.whitelist(methods=["POST"])
def register_spool(label, material, manufacturer, colour, nominal, gross, tare, price,
                   ral="", manufacturer_color="", display_color=""):
    import math
    import re
    from erpnext.controllers.item_variant import create_variant, get_variant
    from frappe.utils import now_datetime

    if not re.fullmatch(r"ROLL-[0-9]+", str(label)):
        frappe.throw("Invalid label")
    nominal, gross, tare, price = map(float, (nominal, gross, tare, price))
    net = gross - tare
    if not all(math.isfinite(x) for x in (nominal, gross, tare, price)) or not (
            nominal > 0 and tare >= 0 and 0 < net <= nominal * 1.1 and price >= 0):
        frappe.throw("Invalid weight or price")
    if display_color and not re.fullmatch(r"#[0-9a-fA-F]{6}", display_color):
        frappe.throw("Invalid display colour")
    tag = frappe.get_doc("Filament Label", label)
    tag.check_permission("write")
    frappe.db.sql("select name from `tabFilament Label` where name=%s for update", (label,))
    tag.reload()
    if tag.status != "Reserved" or tag.batch:
        frappe.throw("Label already used")
    settings = frappe.get_single("Nippey Print Settings")
    settings.check_permission("read")
    if not settings.company or not settings.warehouse:
        frappe.throw("Configure company and warehouse")
    if frappe.db.get_value("Company", settings.company, "enable_perpetual_inventory"):
        frappe.throw("Opening inventory workflow requires non-perpetual inventory")
    if frappe.db.get_value("Warehouse", settings.warehouse, "company") != settings.company:
        frappe.throw("Warehouse belongs to another company")
    template = frappe.get_doc("Item", material)
    template.check_permission("read")
    if not template.has_variants or not template.item_code.startswith("FIL-") or template.stock_uom != "Gram":
        frappe.throw("Invalid filament template")
    frappe.db.sql("select name from `tabItem` where name=%s for update", (template.name,))
    args = {"Manufacturer": manufacturer, "Colour": colour}
    for attr, value in args.items():
        d = frappe.get_doc("Item Attribute", attr)
        d.check_permission("read")
        if value not in [row.attribute_value for row in d.item_attribute_values]:
            frappe.throw("Unknown attribute value")
    existing = get_variant(template.name, args=args)
    item = frappe.get_doc("Item", existing) if existing else create_variant(template.name, args)
    fields = {"custom_ral_code": ral, "custom_manufacturer_color_name": manufacturer_color,
              "custom_display_color": display_color}
    for key, value in fields.items():
        if value and item.get(key) and item.get(key) != value:
            frappe.throw("Colour metadata conflicts with existing variant: " + key)
        if value:
            item.set(key, value)
    if ral and not item.get("custom_ral_accuracy"):
        item.custom_ral_accuracy = "Unbekannt"
    if not existing:
        item.has_batch_no = 1
        item.create_new_batch = 0
        item.insert()
    elif any(value for value in fields.values()):
        item.save()
    if not item.has_batch_no or item.stock_uom != "Gram" or item.disabled:
        frappe.throw("Invalid stock variant")
    if frappe.db.exists("Batch", label):
        frappe.throw("Batch ID already exists")
    batch = frappe.get_doc(dict(doctype="Batch", batch_id=label, item=item.name,
        custom_nominal_weight=nominal, custom_spool_tare_weight=tare,
        custom_last_gross_weight=gross, custom_last_weighing=now_datetime(),
        use_batchwise_valuation=1)).insert()
    entry = frappe.get_doc(dict(doctype="Stock Entry", company=settings.company,
        stock_entry_type="Material Receipt", purpose="Material Receipt",
        is_opening="Yes", remarks="Filament opening inventory: " + label,
        items=[dict(item_code=item.name, t_warehouse=settings.warehouse, qty=net,
            uom="Gram", stock_uom="Gram", conversion_factor=1,
            basic_rate=price/nominal, set_basic_rate_manually=1,
            allow_zero_valuation_rate=int(price == 0), use_serial_batch_fields=1,
            batch_no=batch.name)]))
    entry.insert()
    entry.submit()
    tag.batch = batch.name
    tag.status = "Active"
    tag.save()
    return {"label": tag.name, "batch": batch.name, "item": item.name,
            "stock_entry": entry.name, "net": net}


@frappe.whitelist(methods=["GET"])
def available_labels(query=""):
    import re
    q = str(query or "").strip().upper()
    if q and not re.fullmatch(r"(?:ROLL-)?[0-9]{0,12}", q):
        return []
    filters = {"status": "Reserved"}
    if q:
        filters["name"] = ["like", "%" + q.removeprefix("ROLL-") + "%"]
    return frappe.get_list("Filament Label", filters=filters, pluck="name",
                           order_by="name asc", limit_page_length=50)


@frappe.whitelist(methods=["GET"])
def colour_metadata(material, manufacturer, colour):
    from erpnext.controllers.item_variant import get_variant
    frappe.has_permission("Item", "read", throw=True)
    template = frappe.get_doc("Item", material)
    template.check_permission("read")
    if not template.has_variants or not template.item_code.startswith("FIL-"):
        return {}
    name = get_variant(material, args={"Manufacturer": manufacturer, "Colour": colour})
    if not name:
        return {}
    item = frappe.get_doc("Item", name)
    item.check_permission("read")
    return {"display_color": item.get("custom_display_color"),
            "ral": item.get("custom_ral_code"),
            "manufacturer_color": item.get("custom_manufacturer_color_name")}


@frappe.whitelist(methods=["GET"])
def spool_details(label):
    from erpnext.stock.doctype.batch.batch import get_batch_qty
    tag = frappe.get_doc("Filament Label", label)
    tag.check_permission("read")
    if not tag.batch:
        frappe.throw("Label has no batch")
    batch = frappe.get_doc("Batch", tag.batch)
    batch.check_permission("read")
    item = frappe.get_doc("Item", batch.item)
    item.check_permission("read")
    settings = frappe.get_single("Nippey Print Settings")
    settings.check_permission("read")
    frappe.has_permission("Stock Ledger Entry", "read", throw=True)
    qty = get_batch_qty(batch_no=batch.name, warehouse=settings.warehouse, item_code=item.name)
    attrs = {r.attribute: r.attribute_value for r in item.attributes}
    receipts = frappe.get_list("Stock Entry", filters={"company": settings.company,
        "docstatus": 1, "remarks": "Filament opening inventory: " + tag.name},
        pluck="name", limit_page_length=2)
    rate = None
    if len(receipts) == 1:
        receipt = frappe.get_doc("Stock Entry", receipts[0])
        receipt.check_permission("read")
        lines = [r for r in receipt.items if r.item_code == item.name]
        if len(lines) == 1:
            rate = lines[0].basic_rate
    return {"label": tag.name, "status": tag.status, "item": item.name,
        "material": item.item_group, "manufacturer": attrs.get("Manufacturer"),
        "colour": attrs.get("Colour"), "ral": item.get("custom_ral_code"),
        "manufacturer_color": item.get("custom_manufacturer_color_name"),
        "display_color": item.get("custom_display_color"), "warehouse": settings.warehouse,
        "qty": qty, "estimated_value": float(qty)*float(rate) if rate is not None else None,
        "nominal": batch.get("custom_nominal_weight"), "tare": batch.get("custom_spool_tare_weight"),
        "gross": batch.get("custom_last_gross_weight"), "last_weighing": batch.get("custom_last_weighing")}


@frappe.whitelist(methods=["POST"])
def reweigh_spool(label, gross, expected_qty, reason):
    import math
    from frappe.utils import now_datetime
    gross, expected_qty = float(gross), float(expected_qty)
    reason = str(reason or "").strip()
    if not reason or len(reason) > 500 or not all(math.isfinite(x) for x in (gross, expected_qty)):
        frappe.throw("Invalid weight or reason")
    tag = frappe.get_doc("Filament Label", label)
    tag.check_permission("write")
    frappe.db.sql("select name from `tabFilament Label` where name=%s for update", (label,))
    tag.reload()
    if tag.status != "Active" or not tag.batch:
        frappe.throw("Only active spools can be weighed")
    details = spool_details(label)
    batch = frappe.get_doc("Batch", tag.batch)
    batch.check_permission("write")
    if batch.get("custom_spool_tare_weight") is None or not details["nominal"]:
        frappe.throw("Missing spool weight")
    net = round(gross - float(details["tare"]), 3)
    qty = float(details["qty"])
    if net < 0 or net > float(details["nominal"])*1.1:
        frappe.throw("Invalid net weight")
    if abs(qty-expected_qty)>0.0005:
        frappe.throw("Stock changed. Reload before weighing.")
    delta = round(net - qty, 3)
    settings = frappe.get_single("Nippey Print Settings")
    if frappe.db.get_value("Company", settings.company, "enable_perpetual_inventory"):
        frappe.throw("This workflow requires non-perpetual inventory")
    entry = None
    if delta:
        issue = delta < 0
        purpose = "Material Issue" if issue else "Material Receipt"
        row = dict(item_code=batch.item, qty=abs(delta), uom="Gram", stock_uom="Gram",
            conversion_factor=1, use_serial_batch_fields=1, batch_no=batch.name)
        if issue:
            row["s_warehouse"] = settings.warehouse
        else:
            rate = None
            receipts = frappe.get_list("Stock Entry", filters={"company":settings.company,
                "docstatus":1,"remarks":"Filament opening inventory: "+tag.name}, pluck="name", limit_page_length=2)
            if len(receipts)==1:
                receipt=frappe.get_doc("Stock Entry", receipts[0])
                receipt.check_permission("read")
                lines=[r for r in receipt.items if r.item_code==batch.item]
                if len(lines)==1:
                    rate=lines[0].basic_rate
            if rate is None:
                frappe.throw("Original valuation rate not found")
            row.update(t_warehouse=settings.warehouse,basic_rate=rate,
                set_basic_rate_manually=1,allow_zero_valuation_rate=int(rate==0))
        entry=frappe.get_doc(dict(doctype="Stock Entry",company=settings.company,
            stock_entry_type=purpose,purpose=purpose,
            remarks="Filament weighing correction: "+tag.name+" | "+reason,items=[row]))
        entry.insert()
        entry.submit()
    batch.custom_last_gross_weight=gross
    batch.custom_last_weighing=now_datetime()
    batch.save()
    return {"qty":net,"delta":delta,"stock_entry":entry.name if entry else None}


@frappe.whitelist(methods=["GET"])
def inventory_overview():
    settings = frappe.get_single("Nippey Print Settings")
    settings.check_permission("read")
    frappe.has_permission("Stock Ledger Entry", "read", throw=True)
    frappe.has_permission("Warehouse", "read", throw=True)
    frappe.get_doc("Warehouse", settings.warehouse).check_permission("read")
    rows = []
    start = 0
    while True:
        tags = frappe.get_list("Filament Label", filters={"status": "Active", "batch": ["is", "set"]},
            pluck="name", order_by="name asc", limit_start=start, limit_page_length=100)
        for label in tags:
            rows.append(spool_details(label))
        if len(tags) < 100:
            break
        start += len(tags)
    return {"warehouse": settings.warehouse, "rows": rows}


@frappe.whitelist(methods=["POST"])
def consume_spool(label, grams, expected_qty, purpose, outcome, note=""):
    import math
    grams, expected_qty = float(grams), float(expected_qty)
    note = str(note or "").strip()
    if not all(math.isfinite(x) for x in (grams, expected_qty)) or grams <= 0 or abs(grams-round(grams,3))>1e-8:
        frappe.throw("Invalid consumption quantity")
    if purpose not in ("Production","Development","Private","Maintenance","Other") or outcome not in ("Successful","Failed","Support","Purge","Waste"):
        frappe.throw("Invalid consumption classification")
    if len(note)>500:
        frappe.throw("Note too long")
    tag=frappe.get_doc("Filament Label", label)
    tag.check_permission("write")
    frappe.db.sql("select name from `tabFilament Label` where name=%s for update",(label,))
    tag.reload()
    if tag.status!="Active" or not tag.batch:
        frappe.throw("Only active spools can be used")
    details=spool_details(label)
    qty=float(details["qty"])
    if abs(qty-expected_qty)>0.0005 or grams>qty:
        frappe.throw("Stock changed or insufficient material. Reload.")
    settings=frappe.get_single("Nippey Print Settings")
    if frappe.db.get_value("Company",settings.company,"enable_perpetual_inventory"):
        frappe.throw("This workflow requires non-perpetual inventory")
    entry=frappe.get_doc(dict(doctype="Stock Entry",company=settings.company,
        stock_entry_type="Material Issue",purpose="Material Issue",
        custom_np_consumption_label=tag.name,custom_np_consumption_purpose=purpose,
        custom_np_consumption_outcome=outcome,
        remarks="Filament consumption: "+tag.name+" | "+purpose+" | "+outcome+" | "+note,
        items=[dict(item_code=details["item"],s_warehouse=settings.warehouse,qty=grams,
            uom="Gram",stock_uom="Gram",conversion_factor=1,use_serial_batch_fields=1,batch_no=tag.batch)]))
    entry.insert()
    entry.submit()
    return {"stock_entry":entry.name,"qty":round(qty-grams,3),"consumed":grams,"cost":entry.items[0].amount}
