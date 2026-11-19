# Local model assignment assistant

Open `scripts/model_assignment.html` directly in a desktop browser. Select a scanner CSV and optionally its original model directory. All files stay in the browser. The assistant uses the existing schematic special geometry preview and a simplified, rotatable STL preview (sampled triangles, not CAD or dimensional verification).

Review each relevant row, enter geometry, and confirm it explicitly. Names are suggestions and can be overridden for shared components. Historical diffuser V numbers are compatibility hints, not component revision numbers. Export intermediate CSV files regularly and reopen them to resume. The output is a review manifest, not yet an ERPNext import manifest. Do not commit private inventories. No source model is modified. Browser directory selection may not work on mobile; use a desktop browser with access to the model directory.

The first version supports standard and single-LED special fence-light geometry. Multiple LEDs, manual construction, existing-geometry selection and generic product parameter schemas are future work. No release or compatibility is inferred automatically.
