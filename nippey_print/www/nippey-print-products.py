import frappe
from nippey_print.web_cache import prepare_page

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=%2Fnippey-print-products"
        raise frappe.Redirect
    frappe.has_permission("Print Product", "read", throw=True)
    context.no_cache = 1
    prepare_page(context, "products.js")
    context.title = "Druckprodukte"
