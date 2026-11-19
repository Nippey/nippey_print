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
    revisions=frappe.get_list("Print Model Revision",fields=["name","configuration","internal_revision","status"],limit_page_length=0,order_by="modified desc")
    return dict(products=products,configurations=configurations,revisions=revisions)

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
