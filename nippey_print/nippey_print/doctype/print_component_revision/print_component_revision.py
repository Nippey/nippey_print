import hashlib
import frappe
from frappe.model.document import Document
from ..print_configuration.print_configuration import signature

class PrintComponentRevision(Document):
    def validate(self):
        component = frappe.get_doc("Print Component", self.component)
        component.check_permission("read")
        self.internal_revision = (self.internal_revision or "").strip()
        if not self.internal_revision:
            frappe.throw("Revision required")
        self.revision_signature = signature([component.name, self.internal_revision.casefold()])
        old = self.get_doc_before_save()
        if old and old.status in ("Released", "Obsolete"):
            fields = ("component", "internal_revision", "predecessor", "export_date", "change_description", "historical_compatibility", "profile", "revision_signature")
            if self.status not in (("Released", "Obsolete") if old.status == "Released" else ("Obsolete",)) or any(old.get(k) != self.get(k) for k in fields) or [(r.file_role,r.file_attachment,r.sha256) for r in old.files] != [(r.file_role,r.file_attachment,r.sha256) for r in self.files]:
                frappe.throw("Released revisions are immutable")
            return
        seen = {self.name}
        predecessor = self.predecessor
        while predecessor:
            if predecessor in seen:
                frappe.throw("Revision predecessor cycle")
            seen.add(predecessor)
            prev = frappe.get_doc("Print Component Revision", predecessor)
            prev.check_permission("read")
            if prev.component != self.component:
                frappe.throw("Predecessor must belong to the same component")
            predecessor = prev.predecessor
        for row in self.files:
            name = frappe.db.get_value("File", {"file_url": row.file_attachment}, "name")
            if not name:
                frappe.throw("Upload a local file first")
            file = frappe.get_doc("File", name)
            file.check_permission("read")
            if not (file.file_url or "").startswith(("/files/", "/private/files/")):
                frappe.throw("Remote model files are not supported")
            content = file.get_content()
            row.sha256 = hashlib.sha256(content.encode() if isinstance(content, str) else content).hexdigest()
        if self.status == "Released" and not any(r.file_role in ("STL", "3MF") for r in self.files):
            frappe.throw("Release requires an STL or 3MF file")
