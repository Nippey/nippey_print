import frappe

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/nippey-print"
        raise frappe.Redirect
    frappe.has_permission("Item", "read", throw=True)
    context.no_cache = 1
    context.title = "Filamentinventur"
