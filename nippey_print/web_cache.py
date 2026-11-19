"""Cache policy for authenticated nippey.print pages."""
import hashlib
from pathlib import Path
import frappe
from nippey_print import __version__


def prepare_page(context, asset):
    root = Path(__file__).resolve().parent
    context.no_cache = 1
    frappe.local.no_cache = True
    frappe.local.response_headers["Cache-Control"] = "private, no-store, max-age=0"
    context.asset_version = hashlib.sha256((root / "public" / "js" / asset).read_bytes()).hexdigest()[:16]
    context.app_version = __version__
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix in (".py", ".js", ".html", ".json", ".css") and "__pycache__" not in path.parts:
            digest.update(str(path.relative_to(root)).encode())
            digest.update(path.read_bytes())
    context.build_id = digest.hexdigest()[:12]
