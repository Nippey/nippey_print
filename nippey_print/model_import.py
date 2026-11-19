"""Reviewed standard STL import, executed by bench on a trusted local directory."""
import csv
import hashlib
import re
from pathlib import Path
import frappe

def run(root, manifest, apply=False, housing_colour="RAL 7016", warm_filter=True):
    if not isinstance(apply,bool):
        raise ValueError("apply must be a JSON boolean")
    if not isinstance(warm_filter,bool):
        raise ValueError("warm_filter must be a JSON boolean")
    from nippey_print.nippey_print.doctype.print_configuration.print_configuration import signature
    root=Path(root).resolve(strict=True)
    product=frappe.get_doc("Print Product",frappe.db.get_value("Print Product",{"visualizer_key":"fence-light-standard"},"name"))
    product.check_permission("read")
    plan=[]
    seen={}
    with open(manifest,encoding="utf-8-sig",newline="") as f:
        for row in csv.DictReader(f,delimiter=";"):
            if row["import_group"]!="Standard-Zuordnung": continue
            rel=row["relative_path"]
            geom=row["geometry_proposal"]
            rev=row["revision_proposal"]
            m=re.fullmatch(r"ZL-STD-([VHD])-U(0|17)-B(\d+)",geom)
            if not m or not re.fullmatch(r"V\d+(?:\.\d+)*",rev) or row["file_role"]!="STL":
                raise ValueError(f"Invalid mapping: {rel}")
            file=(root/rel).resolve(strict=True)
            if not file.is_relative_to(root) or file.suffix.lower()!=".stl": raise ValueError(rel)
            raw=file.read_bytes()
            sha=hashlib.sha256(raw).hexdigest()
            if sha!=row["sha256"]: raise ValueError(f"Hash mismatch: {rel}")
            values=dict(light_position=m[1],overhang=m[2],hole_position=m[3],housing_colour=housing_colour,warm_filter=warm_filter)
            import json
            conf=frappe.get_doc(dict(doctype="Print Configuration",product=product.name,configuration_name=geom,parameter_values=json.dumps(values)))
            conf.check_permission("create")
            conf.validate()
            key=signature([conf.geometry_signature,rev.casefold()])
            if key in seen:
                if seen[key]!=sha: raise ValueError(f"Conflicting revision: {geom} {rev}")
                continue
            seen[key]=sha
            existing=frappe.db.get_value("Print Model Revision",{"revision_signature":key},"name")
            if existing:
                doc=frappe.get_doc("Print Model Revision",existing)
                doc.check_permission("read")
                if not any(x.file_role=="STL" and x.sha256==sha for x in doc.files):
                    raise ValueError(f"Existing revision conflict: {existing}")
            plan.append((row,conf,raw,existing))
    result={"mode":"apply" if apply else "dry-run","new":sum(not p[3] for p in plan),"existing":sum(bool(p[3]) for p in plan),"rows":[{"file":r["relative_path"],"geometry":r["geometry_proposal"],"revision":r["revision_proposal"],"existing":e} for r,c,b,e in plan]}
    if not apply: return result
    try:
        for row,conf,raw,existing in plan:
            if existing: continue
            # Reuse any readable configuration of this geometry to avoid creating extra sale variants.
            config=frappe.db.get_value("Print Configuration",{"geometry_signature":conf.geometry_signature},"name")
            if config: frappe.get_doc("Print Configuration",config).check_permission("read")
            else:
                conf.insert()
                config=conf.name
            doc=frappe.get_doc(dict(doctype="Print Model Revision",configuration=config,internal_revision=row["revision_proposal"],status="Draft",export_date=row["export_date_estimate"] or None,change_description="Historical import; export date estimated from filesystem modification time. Source: "+row["relative_path"]))
            doc.insert()
            from frappe.utils.file_manager import save_file
            attachment=save_file(Path(row["relative_path"]).name,raw,doc.doctype,doc.name,is_private=1)
            doc.append("files",dict(file_role="STL",file_attachment=attachment.file_url))
            doc.save()
            if doc.files[-1].sha256!=row["sha256"]: raise ValueError("Stored hash mismatch")
        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        raise
    return result
