import frappe
from nippey_print.web_cache import prepare_page
no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/nippey-print-labels"
        raise frappe.Redirect
    frappe.has_permission("Print Label Sheet", "read", throw=True)
    prepare_page(context, "labels.js")
    context.title = "QR-Etiketten"
