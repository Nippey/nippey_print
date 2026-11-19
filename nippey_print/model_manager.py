import frappe
from pathlib import PurePosixPath

@frappe.whitelist(methods=["GET"])
def overview():
    result = []
    for row in frappe.get_list("Print Model Revision", fields=["name"], limit_page_length=0, order_by="modified desc"):
        doc = frappe.get_doc("Print Model Revision", row.name)
        doc.check_permission("read")
        config = frappe.get_doc("Print Configuration", doc.configuration)
        if not config.has_permission("read"):
            continue
        files = []
        for entry in doc.files:
            url = entry.file_attachment or ""
            if not url.startswith(("/private/files/", "/files/")):
                continue
            files.append(dict(file_role=entry.file_role, filename=PurePosixPath(url).name, url=url))
        result.append(dict(name=doc.name, configuration_name=config.configuration_name,
            internal_revision=doc.internal_revision, status=doc.status, files=files))
    return result
