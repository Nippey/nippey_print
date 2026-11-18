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
