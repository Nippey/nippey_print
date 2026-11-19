import json
import frappe
from frappe.model.document import Document
from ..print_configuration.print_configuration import signature

def inherited_geometry(component_type, config):
    if config.product != component_type.product:
        frappe.throw("Configuration belongs to a different product")
    values = json.loads(config.parameter_values)
    return {r.parameter_key: values.get(r.parameter_key) for r in component_type.inherited_parameters}

class PrintComponent(Document):
    def validate(self):
        kind = frappe.get_doc("Print Component Type", self.component_type)
        config = frappe.get_doc("Print Configuration", self.source_configuration)
        kind.check_permission("read")
        config.check_permission("read")
        values = inherited_geometry(kind, config)
        self.geometry_parameters = json.dumps(values, sort_keys=True, ensure_ascii=False)
        self.geometry_signature = signature([kind.name, values])
        self.component_code = (self.component_code or "").strip()
        if not self.component_code.startswith(kind.code_prefix + "-"):
            frappe.throw("Component code must start with the type prefix")
        old = self.get_doc_before_save()
        if old and frappe.db.exists("Print Component Revision", {"component": self.name}):
            if old.geometry_signature != self.geometry_signature or old.component_code != self.component_code:
                frappe.throw("Component geometry is in use; create a new component")
