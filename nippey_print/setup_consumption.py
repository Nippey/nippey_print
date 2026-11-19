import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def can_open():
    return frappe.session.user != "Guest" and frappe.has_permission("Item", "read") and frappe.has_permission("Filament Label", "read")

def execute():
    create_custom_fields({"Stock Entry": [
        {"fieldname":"custom_np_consumption_label","label":"Filament Roll","fieldtype":"Link","options":"Filament Label","insert_after":"remarks","read_only":1},
        {"fieldname":"custom_np_consumption_purpose","label":"Filament Usage","fieldtype":"Select","options":"\nProduction\nDevelopment\nPrivate\nMaintenance\nOther","insert_after":"custom_np_consumption_label","read_only":1},
        {"fieldname":"custom_np_consumption_outcome","label":"Print Outcome","fieldtype":"Select","options":"\nSuccessful\nFailed\nSupport\nPurge\nWaste","insert_after":"custom_np_consumption_purpose","read_only":1}
    ]}, update=True)
