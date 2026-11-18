ARG ERPNEXT_VERSION=v16.54.0
FROM frappe/erpnext:${ERPNEXT_VERSION}
USER frappe
WORKDIR /home/frappe/frappe-bench
COPY --chown=frappe:frappe . apps/nippey_print
RUN env/bin/pip install --no-deps -e apps/nippey_print \
    && env/bin/python -c "from pathlib import Path; p = Path('sites/apps.txt'); apps = p.read_text().splitlines(); p.write_text('\\n'.join(dict.fromkeys(apps + ['nippey_print'])) + '\\n')" \
    && bench build --app nippey_print
