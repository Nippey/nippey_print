import hashlib
import frappe
from frappe.model.document import Document
from ..print_configuration.print_configuration import signature

class PrintModelRevision(Document):
    def validate(self):
        config=frappe.get_doc("Print Configuration",self.configuration)
        config.check_permission("read")
        self.internal_revision=(self.internal_revision or "").strip()
        if not self.internal_revision: frappe.throw("Revision required")
        self.revision_signature=signature([config.geometry_signature,self.internal_revision.casefold()])
        old=self.get_doc_before_save()
        if old and old.status in ("Released","Obsolete"):
            if self.status not in (("Released","Obsolete") if old.status=="Released" else ("Obsolete",)):
                frappe.throw("Released revisions cannot return to draft")
            fields=("configuration","internal_revision","marked_revision","model_year","predecessor","export_date","change_description","profile","bom","revision_signature")
            if any(old.get(f)!=self.get(f) for f in fields) or [(r.file_role,r.file_attachment,r.sha256) for r in old.files]!=[(r.file_role,r.file_attachment,r.sha256) for r in self.files]:
                frappe.throw("Released revisions are immutable")
            return
        if self.predecessor:
            prev=frappe.get_doc("Print Model Revision",self.predecessor)
            prev.check_permission("read")
            if prev.name==self.name or frappe.db.get_value("Print Configuration",prev.configuration,"geometry_signature")!=config.geometry_signature:
                frappe.throw("Predecessor must belong to the same geometry")
        for row in self.files:
            file_name=frappe.db.get_value("File",{"file_url":row.file_attachment},"name")
            if not file_name: frappe.throw("Upload a local file first")
            file=frappe.get_doc("File",file_name)
            file.check_permission("read")
            if not str(file.file_url or "").startswith(("/files/", "/private/files/")): frappe.throw("Remote model files are not supported")
            content=file.get_content()
            if isinstance(content,str): content=content.encode()
            row.sha256=hashlib.sha256(content).hexdigest()
        if self.status=="Released" and not any(r.file_role in ("STL","3MF") for r in self.files):
            frappe.throw("Release requires an STL or 3MF file")
