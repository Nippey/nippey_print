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
