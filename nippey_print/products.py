import frappe
import json

@frappe.whitelist(methods=["GET"])
def overview():
    products=[]
    for row in frappe.get_list("Print Product",fields=["name"],limit_page_length=0,order_by="product_name asc"):
        d=frappe.get_doc("Print Product",row.name)
        d.check_permission("read")
        products.append(dict(name=d.name,title=d.product_name,description=d.description,visualizer_key=d.visualizer_key,
            parameters=[{k:r.get(k) for k in ("parameter_key","parameter_label","parameter_type","choices","default_value","required_value","unit")} for r in d.parameters]))
    configurations=frappe.get_list("Print Configuration",fields=["name","product","configuration_name","parameter_values","geometry_signature"],limit_page_length=0,order_by="modified desc")
    revisions=frappe.get_list("Print Model Revision",fields=["name","configuration","internal_revision","marked_revision","model_year","export_date","predecessor","status"],limit_page_length=0,order_by="modified desc")
    colours={}
    for row in frappe.get_list("Item", filters={"variant_of":"FIL-ASA","disabled":0},
        fields=["name","custom_ral_code","custom_manufacturer_color_name","custom_display_color"],limit_page_length=0):
        item=frappe.get_doc("Item",row.name)
        item.check_permission("read")
        shade=next((a.attribute_value for a in item.attributes if a.attribute=="Colour"),None)
        ral=str(row.custom_ral_code or "").strip().upper().removeprefix("RAL").strip()
        value="RAL "+ral if ral else (shade or row.custom_manufacturer_color_name)
        if not value: continue
        hex_value=str(row.custom_display_color or "")
        import re
        if not re.fullmatch(r"#[0-9a-fA-F]{6}",hex_value): hex_value=None
        if value not in colours or (not colours[value]["hex"] and hex_value):
            colours[value]=dict(value=value,label=row.custom_manufacturer_color_name or shade or value,hex=hex_value)
    return dict(products=products,configurations=configurations,revisions=revisions,colours=sorted(colours.values(),key=lambda c:c["value"]))

@frappe.whitelist(methods=["POST"])
def create_configuration(product,configuration_name,parameter_values):
    doc=frappe.get_doc(dict(doctype="Print Configuration",product=product,
        configuration_name=configuration_name,parameter_values=json.dumps(parameter_values) if isinstance(parameter_values,dict) else parameter_values))
    doc.check_permission("create")
    doc.validate()
    existing=frappe.db.get_value("Print Configuration",{"configuration_signature":doc.configuration_signature},"name")
    if existing:
        frappe.get_doc("Print Configuration",existing).check_permission("read")
        return dict(name=existing,existing=True)
    doc.insert()
    return dict(name=doc.name,existing=False)

@frappe.whitelist(methods=["POST"])
def create_revision(configuration, internal_revision, marked_revision=None, model_year=None, export_date=None, predecessor=None, change_description=None):
    doc=frappe.get_doc(dict(doctype="Print Model Revision", configuration=configuration,
        internal_revision=internal_revision, marked_revision=marked_revision,
        model_year=model_year or None, export_date=export_date or None,
        predecessor=predecessor or None, change_description=change_description, status="Draft"))
    doc.check_permission("create")
    doc.insert()
    return {"name":doc.name}
