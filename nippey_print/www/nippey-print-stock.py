import frappe
from nippey_print.web_cache import prepare_page

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=%2Fnippey-print-stock"
        raise frappe.Redirect
    frappe.has_permission("Item", "read", throw=True)
    context.no_cache = 1
    prepare_page(context, "stock.js")
    context.title = "Filamentlager"
