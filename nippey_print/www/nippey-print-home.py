import frappe
from nippey_print.setup_consumption import can_open
from nippey_print.web_cache import prepare_page
no_cache = 1

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=%2Fnippey-print-home"
        raise frappe.Redirect
    if not can_open():
        frappe.throw("Not permitted", frappe.PermissionError)
    context.no_cache = 1
    context.title = "nippey.print"
