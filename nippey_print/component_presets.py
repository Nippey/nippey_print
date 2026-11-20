import frappe

def execute():
    for key, title, keys in (
        ("fence-light-standard", "Abdeckung Standard", []),
        ("fence-light-special", "Abdeckung Sonderanfertigung", ["post_width", "post_depth", "outer_contour", "led_x", "led_y", "manual_construction", "construction_notes"]),
    ):
        product = frappe.db.get_value("Print Product", {"visualizer_key": key}, "name")
        if not product or frappe.db.exists("Print Component Type", {"product": product, "code_prefix": "ABD"}):
            continue
        doc = frappe.get_doc("Print Product", product)
        allowed = {r.parameter_key for r in doc.parameters if r.geometry_affecting}
        if not set(keys).issubset(allowed):
            continue
        frappe.get_doc(dict(doctype="Print Component Type", type_name=title, product=product,
            code_prefix="ABD", inherited_parameters=[dict(parameter_key=k) for k in keys])).insert()
