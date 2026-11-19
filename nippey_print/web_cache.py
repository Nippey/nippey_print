"""Cache policy for authenticated nippey.print pages."""
import frappe



def prepare_page(context, asset):
    context.no_cache = 1
    frappe.local.no_cache = True
    frappe.local.response_headers["Cache-Control"] = "private, no-store, max-age=0"
