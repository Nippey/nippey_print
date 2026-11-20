# User guide – from master data to a product definition

[Deutsch](user-guide.de.md)

Status: development version. Examples are illustrative, not business data.

1. **Prerequisites:** Check Company, Warehouse, Gram UOM and Nippey Print Settings in ERPNext. The existing opening inventory workflow requires perpetual inventory to be disabled. Variant Item templates with FIL- prefix, Gram stock UOM and Manufacturer and Colour attributes must exist.
2. **Manufacturer/colour:** Open Item Attribute (Manufacturer or Colour), add a value and unique abbreviation, or add it during spool registration. HEX and RAL are stored per Item variant, not attribute: custom_display_color, custom_ral_code, custom_ral_accuracy, custom_manufacturer_color_name. Use the item editing link in filament stock to correct them; all spools of that variant are affected.
3. **Spool:** Reserve a QR label (/nippey-print-labels), register the spool (/nippey-print), enter material, manufacturer, colour, nominal weight, gross, tare and price. The current workflow creates opening inventory, an Item variant if needed, Batch and Stock Entry. Do not use as a replacement for regular goods receipt. Check filament stock; use weighing corrections rather than editing stock directly.
4. **Print product:** Create Print Product in Desk or use an existing preset. Define parameter key, type, default, required flag and geometry relevance. Colour is normally not a geometry parameter.
5. **Configuration:** Open /nippey-print-products, select product and values, save configuration. Geometry signatures allow reuse of models across variants.
6. **Housing revision:** Create Print Model Revision for configuration, add internal revision, files and optional predecessor in Desk. STL/3MF is required for release. Inspect preview in model manager; release only after review.
7. **Component:** Print Component Type defines product, code prefix and inherited geometry parameters. An empty list gives shared geometry within that product. In model manager select type and source configuration, check or edit suggested code, choose a local STL, enter internal revision and optional hints, save. Matching components are reused; files are private and revision is Draft.
8. **Compatibility:** Create Print Component Compatibility in Desk for specific component and model revisions. Historical hints are not approval. Set Compatible after verification. Released models are immutable; create a new revision for changes.
9. **Manufacturing:** BOMs, material mapping, operations, printers, work orders and actual costs are not fully integrated. A product definition is not a complete production setup.

## Open items
Fresh database master data setup, specialized naming templates, bulk assignment, CAD automation and the end-to-end manufacturing workflow are not fully tested or implemented. Do not edit signatures or stock transactions directly in the database.
