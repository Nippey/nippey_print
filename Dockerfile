ARG ERPNEXT_VERSION=v16.54.0
FROM frappe/erpnext:${ERPNEXT_VERSION}
USER frappe
WORKDIR /home/frappe/frappe-bench
COPY --chown=frappe:frappe . apps/nippey_print
RUN env/bin/pip install --no-deps -e apps/nippey_print \
    && (grep -qxF nippey_print sites/apps.txt || echo nippey_print >> sites/apps.txt) \
    && bench build --app nippey_print
