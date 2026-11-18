import frappe
no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/nippey-print-labels"
        raise frappe.Redirect
    frappe.has_permission("Print Label Sheet", "read", throw=True)
    context.title = "QR-Etiketten"
