ARG ERPNEXT_VERSION=v16.54.0
FROM frappe/erpnext:${ERPNEXT_VERSION}
USER frappe
WORKDIR /home/frappe/frappe-bench
COPY --chown=frappe:frappe . apps/nippey_print
RUN env/bin/pip install -e apps/nippey_print \
    && env/bin/python -c "from pathlib import Path; p = Path('sites/apps.txt'); apps = p.read_text().splitlines(); p.write_text('\\n'.join(dict.fromkeys(apps + ['nippey_print'])) + '\\n')" \
    && env/bin/python -c "from reportlab.graphics.barcode.qr import QrCodeWidget; from reportlab.graphics import renderPDF; from reportlab.pdfgen import canvas" \
    && env/bin/python apps/nippey_print/build_portal.py \
    && bench build --app nippey_print \
    && mkdir -p /home/frappe/frappe-bench/assets \
    && ln -sfnT /home/frappe/frappe-bench/apps/nippey_print/nippey_print/public /home/frappe/frappe-bench/assets/nippey_print \
    && test -r /home/frappe/frappe-bench/assets/nippey_print/js/inventory.js
