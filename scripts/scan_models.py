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
            if "simpel" not in low: result["notes"]="Assumed standard overhang; verify"
        hole=re.search(r"(?:^|_)b(\d+(?:[.,]\d+)?)(?:mm)?(?=_|$)",low)
        if hole: result["hole_hint"]=hole[1].replace(",",".")
        elif re.search(r"(?:^|_)kb(?=_|$)",low): result["hole_hint"]="0";result["notes"]=(result.get("notes","")+"; KB meaning to confirm").strip("; ")
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
    fields=["relative_path","file_role","bytes","sha256","duplicate_of","revision_hint","component","family_hint","light_position_hint","overhang_hint","hole_hint","post_width_hint","post_depth_hint","contour_hint","feature_hints","archived_path","modified_utc","created_utc","configuration","internal_revision","review_status","notes"]
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
                row["revision_hint"]=" | ".join(dict.fromkeys(hints))
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
