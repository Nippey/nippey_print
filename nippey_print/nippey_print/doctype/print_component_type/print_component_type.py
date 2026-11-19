import frappe
from frappe.model.document import Document

class PrintComponentType(Document):
    def validate(self):
        product = frappe.get_doc("Print Product", self.product)
        product.check_permission("read")
        keys = [r.parameter_key for r in self.inherited_parameters]
        allowed = {r.parameter_key for r in product.parameters if r.geometry_affecting}
        if len(keys) != len(set(keys)) or set(keys) - allowed:
            frappe.throw("Inherited parameters must be unique geometry parameters of the product")
        self.code_prefix = (self.code_prefix or "").strip().upper()
        if not self.code_prefix:
            frappe.throw("Code prefix required")
        old = self.get_doc_before_save()
        if old and frappe.db.exists("Print Component", {"component_type": self.name}):
            if (old.product, old.code_prefix, sorted(r.parameter_key for r in old.inherited_parameters)) != (self.product, self.code_prefix, sorted(keys)):
                frappe.throw("Component type is in use; create a new type")
