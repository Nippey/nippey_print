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
