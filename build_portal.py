"""Bake cache identifiers into shipped portal HTML, independent of Jinja."""
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parent / "nippey_print"
digest = hashlib.sha256()
for path in sorted(root.rglob("*")):
    if path.is_file() and path.suffix in (".py", ".js", ".html", ".json", ".css"):
        digest.update(str(path.relative_to(root)).encode())
        digest.update(path.read_bytes())
build = digest.hexdigest()[:12]
version = re.search(r'__version__\s*=\s*["\']([^"\']+)["\']', (root / "__init__.py").read_text()).group(1)
for name in ("nippey-print.html", "nippey-print-labels.html"):
    path = root / "www" / name
    path.write_text(path.read_text().replace("__PORTAL_BUILD__", build).replace("__PORTAL_VERSION__", version))
