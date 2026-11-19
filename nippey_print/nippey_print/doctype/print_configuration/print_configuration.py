import json
import hashlib
from decimal import Decimal, InvalidOperation
import frappe
from frappe.model.document import Document

def signature(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()

def normalize(row,value):
    kind=row.parameter_type
    if kind in ("Decimal","Integer"):
        try:
            n=Decimal(str(value))
            if not n.is_finite() or abs(n)>Decimal("1000000") or (kind=="Integer" and n!=n.to_integral_value()):
                raise ValueError()
            if row.parameter_key in ("overhang","hole_position") and n<0:
                raise ValueError()
            if row.parameter_key in ("post_width","post_depth") and n<=0:
                raise ValueError()
            return "0" if not n else format(n.normalize(),"f")
        except (InvalidOperation,ValueError):
            frappe.throw("Invalid numeric parameter: "+row.parameter_key)
    if kind=="Check":
        if value in (True,1,"1","true","True"): return True
        if value in (False,0,"0","false","False"): return False
        frappe.throw("Invalid checkbox: "+row.parameter_key)
    if not isinstance(value,str):
        frappe.throw("Expected text: "+row.parameter_key)
    value=value.strip()
    if kind=="Select" and value not in [x.strip() for x in (row.choices or "").splitlines()]:
        frappe.throw("Invalid choice: "+row.parameter_key)
    return value

class PrintConfiguration(Document):
    def validate(self):
        product=frappe.get_doc("Print Product",self.product)
        product.check_permission("read")
        try:
            values=json.loads(self.parameter_values)
        except (TypeError,ValueError):
            frappe.throw("Invalid parameter JSON")
        if not isinstance(values,dict):
            frappe.throw("Parameters must be a JSON object")
        known={r.parameter_key:r for r in product.parameters}
        if set(values)-set(known):
            frappe.throw("Unknown parameter keys")
        normalized={}
        for key,row in known.items():
            value=values.get(key,row.default_value)
            if value is None or value=="":
                if row.required_value: frappe.throw("Missing parameter: "+key)
                continue
            normalized[key]=normalize(row,value)
        self.parameter_values=json.dumps(normalized,sort_keys=True,ensure_ascii=False)
        self.configuration_signature=signature([self.product,normalized])
        self.geometry_signature=signature([self.product,{k:v for k,v in normalized.items() if known[k].geometry_affecting}])
        old=self.get_doc_before_save()
        if old and old.configuration_signature!=self.configuration_signature and frappe.db.exists("Print Model Revision",{"configuration":self.name}):
            frappe.throw("Configuration is referenced by a model revision; create a new configuration")
