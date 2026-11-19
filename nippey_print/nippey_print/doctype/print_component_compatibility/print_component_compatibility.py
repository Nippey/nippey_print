import json
import frappe
from frappe.model.document import Document
from ..print_configuration.print_configuration import signature
from ..print_component.print_component import inherited_geometry

class PrintComponentCompatibility(Document):
    def validate(self):
        revision = frappe.get_doc("Print Component Revision", self.component_revision)
        model = frappe.get_doc("Print Model Revision", self.model_revision)
        component = frappe.get_doc("Print Component", revision.component)
        kind = frappe.get_doc("Print Component Type", component.component_type)
        config = frappe.get_doc("Print Configuration", model.configuration)
        for doc in (revision, model, component, kind, config):
            doc.check_permission("read")
        if kind.product != config.product:
            frappe.throw("Compatibility requires the same product")
        if self.status == "Compatible" and inherited_geometry(kind, config) != json.loads(component.geometry_parameters):
            frappe.throw("Compatible revisions must share inherited geometry")
        self.compatibility_signature = signature([revision.name, model.name])
