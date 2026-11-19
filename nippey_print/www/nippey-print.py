import frappe
from nippey_print.web_cache import prepare_page
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
    prepare_page(context, "inventory.js")
    context.title = "Filamentinventur"
