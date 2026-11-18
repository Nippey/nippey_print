import frappe
from urllib.parse import urlencode

no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        label = frappe.form_dict.get("label")
        target = "/nippey-print" + ("?" + urlencode({"label": label}) if label else "")
        frappe.local.flags.redirect_location = "/login?" + urlencode({"redirect-to": target})
        raise frappe.Redirect
    frappe.has_permission("Item", "read", throw=True)
    context.no_cache = 1
    context.title = "Filamentinventur"
