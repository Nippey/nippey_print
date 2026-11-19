#!/usr/bin/env python3
"""Read-only model inventory; no ERPNext connection or uploads."""
import argparse
import csv
import hashlib
import re
from pathlib import Path

ROLES={".stl":"STL",".3mf":"3MF",".ipt":"CAD",".iam":"CAD",".ipn":"CAD",".step":"CAD",".stp":"CAD"}

def digest(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("root",type=Path)
    p.add_argument("-o","--output",type=Path,default=Path("model_inventory.csv"))
    args=p.parse_args()
    root=args.root.resolve(strict=True)
    if not root.is_dir(): p.error("root must be a directory")
    fields=["relative_path","file_role","bytes","sha256","duplicate_of","revision_hint","configuration","internal_revision","review_status","notes"]
    seen={}
    count=0
    with args.output.open("x",encoding="utf-8-sig",newline="") as out:
        writer=csv.DictWriter(out,fieldnames=fields,delimiter=";")
        writer.writeheader()
        for path in sorted(root.rglob("*")):
            if path.is_symlink() or not path.is_file() or path.suffix.lower() not in ROLES: continue
            if not path.resolve().is_relative_to(root): continue
            rel=path.relative_to(root).as_posix()
            row=dict(relative_path=rel,file_role=ROLES[path.suffix.lower()],review_status="Review")
            try:
                before=path.stat()
                sha=digest(path)
                after=path.stat()
                if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):
                    raise OSError("File changed while hashing")
                row.update(bytes=after.st_size,sha256=sha,duplicate_of=seen.get(sha,""))
                seen.setdefault(sha,rel)
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
