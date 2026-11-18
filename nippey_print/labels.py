"""Reserve durable filament labels and render repeatable A4 PDF sheets."""
import json
import math
from io import BytesIO
from urllib.parse import urlencode, urlsplit

import frappe
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF
from reportlab.graphics.shapes import Drawing
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

DIMENSIONS = ("page_width", "page_height", "label_width", "label_height",
              "margin_left", "margin_top", "pitch_x", "pitch_y")
MAX_LABELS = 500


def _layout(doc):
    result = {key: float(doc.get(key) or 0) for key in DIMENSIONS}
    result.update(columns=int(doc.columns or 0), rows=int(doc.rows or 0))
    if not all(math.isfinite(v) for v in result.values()):
        frappe.throw("Invalid label dimensions")
    w, h, lw, lh, x, y, px, py = (result[k] for k in DIMENSIONS)
    cols, rows = result["columns"], result["rows"]
    if not (0 < cols * rows <= MAX_LABELS and cols > 0 and rows > 0
            and 0 < w <= 500 and 0 < h <= 500 and lw >= 38 and lh >= 20
            and x >= 0 and y >= 0 and px >= lw and py >= lh
            and x + (cols-1)*px + lw <= w + 0.001
            and y + (rows-1)*py + lh <= h + 0.001):
        frappe.throw("Label dimensions do not fit the supported page layout")
    return result


@frappe.whitelist(methods=["POST"])
def reserve_sheet(label_format, start_position=1, label_count=None):
    fmt = frappe.get_doc("Print Label Format", label_format)
    fmt.check_permission("read")
    if not fmt.verified:
        frappe.throw("Verify the label dimensions before reserving labels")
    layout = _layout(fmt)
    capacity = layout["columns"] * layout["rows"]
    start = int(start_position)
    count = capacity-start+1 if label_count is None else int(label_count)
    if not (1 <= start <= capacity and 1 <= count <= capacity-start+1):
        frappe.throw("Invalid start position or label count")
    frappe.has_permission("Filament Label", "create", throw=True)
    settings = frappe.get_single("Nippey Print Settings")
    settings.check_permission("read")
    base = (settings.base_url or "").strip().rstrip("/")
    url = urlsplit(base)
    if url.scheme not in ("http", "https") or not url.netloc or url.query or url.fragment or url.username or url.password:
        frappe.throw("Configure a valid HTTP(S) base URL first")
    layout["base_url"] = base
    sheet = frappe.get_doc(dict(doctype="Print Label Sheet", label_format=fmt.name,
        start_position=start, label_count=count, layout_snapshot=json.dumps(layout))).insert()
    for pos in range(start, start+count):
        frappe.get_doc(dict(doctype="Filament Label", label_sheet=sheet.name,
            position=pos, status="Reserved")).insert()
    return {"sheet": sheet.name, "count": count}


@frappe.whitelist(methods=["GET"])
def download_sheet(sheet):
    doc = frappe.get_doc("Print Label Sheet", sheet)
    doc.check_permission("read")
    frappe.has_permission("Filament Label", "read", throw=True)
    layout = json.loads(doc.layout_snapshot)
    labels = frappe.get_list("Filament Label", filters={"label_sheet": doc.name},
        fields=["name", "position"], order_by="position asc", limit_page_length=MAX_LABELS)
    if len(labels) != doc.label_count:
        frappe.throw("Label sheet is incomplete or not accessible")
    buf = BytesIO()
    pdf = canvas.Canvas(buf, pagesize=(layout["page_width"]*mm, layout["page_height"]*mm))
    for label in labels:
        row, col = divmod(label.position-1, layout["columns"])
        x = (layout["margin_left"]+col*layout["pitch_x"])*mm
        y = (layout["page_height"]-layout["margin_top"]-row*layout["pitch_y"]-layout["label_height"])*mm
        size = min(layout["label_height"]-2, 23)*mm
        payload = layout["base_url"] + "/nippey-print?" + urlencode({"label": label.name})
        qr = QrCodeWidget(payload, barLevel="M", barBorder=4)
        a,b,c,d = qr.getBounds()
        scale = size/(c-a)
        drawing = Drawing(size,size,transform=[scale,0,0,scale,-a*scale,-b*scale])
        drawing.add(qr)
        renderPDF.draw(drawing,pdf,x+mm,y+(layout["label_height"]*mm-size)/2)
        tx = x+size+2*mm
        available = layout["label_width"]*mm-size-3*mm
        font_size = min(9, available*1000/max(1,pdf.stringWidth(label.name,"Courier-Bold",1000)))
        pdf.setFont("Helvetica",7)
        pdf.drawString(tx,y+layout["label_height"]*mm/2+4*mm,"nippey.print")
        pdf.setFont("Courier-Bold",font_size)
        pdf.drawString(tx,y+layout["label_height"]*mm/2,label.name)
    pdf.showPage()
    pdf.save()
    frappe.local.response.filename = doc.name + ".pdf"
    frappe.local.response.filecontent = buf.getvalue()
    frappe.local.response.type = "download"
    frappe.local.response.content_type = "application/pdf"
