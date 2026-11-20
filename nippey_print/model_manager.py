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
        result.append(dict(name=doc.name, kind="model", configuration_name=config.configuration_name,
            internal_revision=doc.internal_revision, status=doc.status, files=files))
    return result

@frappe.whitelist(methods=["GET"])
def component_catalog():
    result = {}
    for key, doctype, fields in (
        ("types", "Print Component Type", ["name", "type_name", "product", "code_prefix"]),
        ("components", "Print Component", ["name", "component_code", "component_type"]),
        ("configurations", "Print Configuration", ["name", "configuration_name", "product"]),
    ):
        result[key] = frappe.get_list(doctype, fields=fields, limit_page_length=0)
    result["compatibilities"] = frappe.get_list("Print Component Compatibility", fields=["name", "component_revision", "model_revision", "status", "notes"], limit_page_length=0)
    result["revisions"] = []
    for row in frappe.get_list("Print Component Revision", fields=["name"], limit_page_length=0):
        doc = frappe.get_doc("Print Component Revision", row.name)
        doc.check_permission("read")
        component = frappe.get_doc("Print Component", doc.component)
        if not component.has_permission("read"):
            continue
        result["revisions"].append(dict(name=doc.name, kind="component", configuration_name=component.component_code,
            internal_revision=doc.internal_revision, status=doc.status, files=[
                dict(file_role=r.file_role, filename=PurePosixPath(r.file_attachment).name, url=r.file_attachment)
                for r in doc.files if (r.file_attachment or "").startswith(("/files/", "/private/files/"))]))
    return result

@frappe.whitelist(methods=["GET"])
def suggest_component(component_type, configuration):
    from .nippey_print.doctype.print_component.print_component import inherited_geometry
    from .nippey_print.doctype.print_configuration.print_configuration import signature
    kind = frappe.get_doc("Print Component Type", component_type)
    config = frappe.get_doc("Print Configuration", configuration)
    kind.check_permission("read")
    config.check_permission("read")
    values = inherited_geometry(kind, config)
    matches = frappe.get_list("Print Component", filters={"geometry_signature": signature([kind.name, values])}, fields=["name", "component_code"])
    if matches:
        return dict(code=matches[0].component_code, existing=matches[0].name, values=values)
    def part(value):
        if value is None:
            return "NA"
        if isinstance(value, bool):
            return "1" if value else "0"
        return str(value).replace(" ", "_")
    suffix = "-".join(part(v) for v in values.values()) or "STD"
    return dict(code=kind.code_prefix + "-" + suffix, existing=None, values=values)

@frappe.whitelist(methods=["POST"])
def create_component_revision(component_type, configuration, component_code, internal_revision, historical_compatibility="", change_description=""):
    from frappe.utils.file_manager import save_file
    from hashlib import sha256
    suggestion = suggest_component(component_type, configuration)
    upload = frappe.request.files.get("file")
    if not upload or not upload.filename.lower().endswith(".stl"):
        frappe.throw("An STL file is required")
    content = upload.read()
    if not content or len(content) > 100 * 1024 * 1024:
        frappe.throw("Invalid STL file size")
    component_name = suggestion["existing"]
    if component_name:
        component = frappe.get_doc("Print Component", component_name)
        component.check_permission("read")
    else:
        component = frappe.get_doc(dict(doctype="Print Component", component_type=component_type,
            source_configuration=configuration, component_code=component_code)).insert()
    revision = frappe.get_doc(dict(doctype="Print Component Revision", component=component.name,
        internal_revision=internal_revision, historical_compatibility=historical_compatibility,
        change_description=change_description, status="Draft")).insert()
    attachment = save_file(PurePosixPath(upload.filename.replace(chr(92), "/")).name, content,
        revision.doctype, revision.name, is_private=1)
    revision.append("files", dict(file_role="STL", file_attachment=attachment.file_url))
    revision.save()
    return dict(name=revision.name, component=component.name, sha256=sha256(content).hexdigest())

@frappe.whitelist(methods=["POST"])
def assign_compatibility(component_revision, model_revision, status="Unverified", notes=""):
    if status not in ("Unverified", "Compatible", "Incompatible"):
        frappe.throw("Invalid compatibility status")
    existing = frappe.db.get_value("Print Component Compatibility",
        {"component_revision": component_revision, "model_revision": model_revision}, "name")
    if existing:
        doc = frappe.get_doc("Print Component Compatibility", existing)
        doc.check_permission("write")
        doc.status = status
        doc.notes = notes
        doc.save()
    else:
        doc = frappe.get_doc(dict(doctype="Print Component Compatibility",
            component_revision=component_revision, model_revision=model_revision,
            status=status, notes=notes)).insert()
    return dict(name=doc.name)
