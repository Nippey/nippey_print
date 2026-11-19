"""Install editable Avery template presets without overwriting user changes."""
import frappe


def execute():
    for code, height, rows in (("L6140", 25.4, 10), ("L4778", 21.2, 12)):
        name = "Avery " + code
        if frappe.db.exists("Print Label Format", name):
            continue
        # Preliminary centered geometry. Confirm against the physical sheet
        # or official template before enabling reservation.
        pitch_x = 48.3
        pitch_y = height
        frappe.get_doc(dict(
            doctype="Print Label Format", format_name=name,
            manufacturer="Avery Zweckform", article_number=code,
            page_width=210, page_height=297, label_width=45.7,
            label_height=height, columns=4, rows=rows,
            margin_left=(210-45.7-3*pitch_x)/2,
            margin_top=(297-rows*height)/2,
            pitch_x=pitch_x, pitch_y=pitch_y, verified=0
        )).insert()
    for code, width, height, columns, rows in (("3657", 48.5, 25.4, 4, 10), ("3666", 38, 21.2, 5, 13)):
        name = "Avery " + code
        if not frappe.db.exists("Print Label Format", name):
            frappe.get_doc(dict(doctype="Print Label Format", format_name=name,
                manufacturer="Avery Zweckform", article_number=code,
                page_width=210, page_height=297, label_width=width, label_height=height,
                columns=columns, rows=rows, margin_left=(210-columns*width)/2,
                margin_top=(297-rows*height)/2, pitch_x=width, pitch_y=height,
                verified=0)).insert()
    settings = frappe.get_single("Nippey Print Settings")
    if not settings.default_label_format:
        settings.default_label_format = "Avery L6140"
        settings.save()
