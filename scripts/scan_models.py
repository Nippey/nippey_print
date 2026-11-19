#!/usr/bin/env python3
"""Read-only model inventory; no ERPNext connection or uploads."""
import argparse
import csv
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

ROLES={".stl":"STL",".3mf":"3MF",".ipt":"CAD",".iam":"CAD",".ipn":"CAD",".step":"CAD",".stp":"CAD"}

def digest(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def parse_name(stem):
    low=stem.casefold()
    result={}
    printer=re.match(r"^(ce5k|ce5)_",low)
    if printer:
        result["printer_hint"]=printer[1].upper()
        count=re.search(r"(?:^|_)(\d+)x(?=kappe|diffuser|_)|(?:^|_)x(\d+)(?=_|$)",low)
        if count: result["quantity_hint"]=count[1] or count[2]
        duration=re.search(r"(?:^|_)(\d+)h(\d{2})(?=_|$)",low)
        if duration and int(duration[2])<60 and int(duration[1])*60+int(duration[2])>0: result["duration_minutes_hint"]=int(duration[1])*60+int(duration[2])
        weight=re.search(r"(?:^|_)(\d+(?:[.,]\d+)?)g(?=_|$)",low)
        if weight and float(weight[1].replace(",","."))>0: result["material_grams_hint"]=weight[1].replace(",",".")
        start=re.search(r"kappeled|diffuser",low)
        if start: low=low[start.start():]
    if low.startswith("test_"): low=low[5:];result["draft_hint"]="Test"
    if any(k in low for k in ("draft","beta")): result["draft_hint"]="Draft"
    if low.startswith("diffuser"):
        compat=re.search(r"(v\d+)_bis_(v\d+)",low)
        if compat: result["compatibility_hint"]=compat[1].upper()+"–"+compat[2].upper()
    if "kurzlang" in low: result["overhang_class_hint"]="Mixed"
    elif "pfosten" in low and "lang" in low: result["overhang_class_hint"]="Long"
    elif "pfosten" in low and "kurz" in low: result["overhang_class_hint"]="Short"
    if "dualled" in low or "doppel" in low: result["led_count_hint"]=2
    elif "keineled" in low: result["led_count_hint"]=0
    if low.startswith("kappeled"): result["component"]="Housing"
    elif low.startswith("diffuser"): result["component"]="Diffuser"
    else: return result
    dim=re.search(r"(?:pfosten(?:lang)?)?(\d+)x(\d+)",low)
    special=bool(dim or any(k in low for k in ("pfosten","diagonal","ecke","seite","dualled","eckig","gerade")))
    result["family_hint"]="Special" if special else ("Standard" if result["component"]=="Housing" else "Unknown")
    if dim: result.update(post_width_hint=dim[1],post_depth_hint=dim[2])
    if result["component"]=="Housing":
        if not special:
            for token,pos in (("vorne","V"),("hinten","H"),("doppel","D")):
                if token in low: result["light_position_hint"]=pos
            result["overhang_hint"]="0" if "simpel" in low else "17"
        hole=re.search(r"(?:^|_)(?:b|bohrung_)(\d+(?:[.,]\d+)?)(?:mm)?(?=_|$)",low)
        if hole: result["hole_hint"]=hole[1].replace(",",".")
        else: result["hole_hint"]="0"
    for token,value in (("eckig","Bounding Box"),("gerade","Gummiband"),("konkav","Konkav"),("konvex","Konvex")):
        if token in low: result["contour_hint"]=value
    result["feature_hints"]=" | ".join(k for k in ("simpel","diagonal","dualled","ecke","seite","rechts","links","scheibe","nase","lang","eckig2") if k in low)
    return result

def timestamp(value):
    return datetime.fromtimestamp(value,timezone.utc).isoformat()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("root",type=Path)
    p.add_argument("-o","--output",type=Path,default=Path("model_inventory.csv"))
    args=p.parse_args()
    root=args.root.resolve(strict=True)
    if not root.is_dir(): p.error("root must be a directory")
    fields=["relative_path","file_role","bytes","sha256","duplicate_of","revision_hint","component","family_hint","light_position_hint","overhang_hint","hole_hint","post_width_hint","post_depth_hint","contour_hint","feature_hints","printer_hint","quantity_hint","duration_minutes_hint","material_grams_hint","compatibility_hint","overhang_class_hint","led_count_hint","draft_hint","archived_path","modified_utc","created_utc","configuration","internal_revision","review_status","notes"]
    seen={}
    count=0
    with args.output.open("x",encoding="utf-8-sig",newline="") as out:
        writer=csv.DictWriter(out,fieldnames=fields,delimiter=";")
        writer.writeheader()
        for path in sorted(root.rglob("*")):
            if path.is_symlink() or not path.is_file() or path.suffix.lower() not in ROLES: continue
            if not path.resolve().is_relative_to(root): continue
            rel=path.relative_to(root).as_posix()
            row=dict(relative_path=rel,file_role=ROLES[path.suffix.lower()],review_status="Review",archived_path=any(p.casefold() in ("archiv","archive") for p in path.relative_to(root).parts[:-1]))
            row.update(parse_name(path.stem))
            if any(p.casefold() in ("oldversions","entwürfe") for p in path.relative_to(root).parts[:-1]): row["draft_hint"]="Backup" if "oldversions" in [p.casefold() for p in path.parts] else "Draft"
            try:
                before=path.stat()
                sha=digest(path)
                after=path.stat()
                if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
                    raise OSError("File changed while hashing")
                row.update(bytes=after.st_size,sha256=sha,duplicate_of=seen.get(sha,""))
                seen.setdefault(sha,rel)
                row["modified_utc"]=timestamp(after.st_mtime)
                birth=getattr(after,"st_birthtime",None)
                # Windows Python <3.12 exposes creation time as st_ctime; never use Unix ctime.
                import os
                if birth is None and os.name=="nt": birth=after.st_ctime
                if birth is not None: row["created_utc"]=timestamp(birth)
                hints=re.findall(r"(?<![A-Za-z0-9])V[0-9]+(?:[._-][0-9]+)*(?![A-Za-z0-9])",path.stem,re.I)
                row["revision_hint"]="" if row.get("compatibility_hint") else " | ".join(dict.fromkeys(hints))
            except OSError as e:
                row.update(review_status="Error",notes=str(e))
            # Prevent spreadsheet formula execution from untrusted filenames.
            for k,v in row.items():
                if isinstance(v,str) and v.startswith(("=","+","-","@","\t","\r")): row[k]="'"+v
            writer.writerow(row)
            count+=1
    print(f"{count} files inventoried: {args.output}")

if __name__=="__main__":
    main()
