import re
import frappe
from frappe.model.document import Document

class PrintProduct(Document):
    def validate(self):
        seen=set()
        for row in self.parameters:
            key=row.parameter_key
            if not re.fullmatch(r"[a-z][a-z0-9_]*",key or "") or key in seen:
                frappe.throw("Invalid or duplicate parameter key: "+str(key))
            seen.add(key)
            if row.parameter_type=="Select" and not (row.choices or "").strip():
                frappe.throw("Select parameters require choices")
        old=self.get_doc_before_save()
        if old and frappe.db.exists("Print Configuration",{"product":self.name}):
            fields=("parameter_key","parameter_type","choices","default_value","geometry_affecting","required_value","unit")
            if [[r.get(f) for f in fields] for r in old.parameters]!=[[r.get(f) for f in fields] for r in self.parameters]:
                frappe.throw("Parameter definitions are locked after configurations exist; create a new product definition")
