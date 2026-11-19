# Visual product configurator (planned)

Internal order entry first; optional customer-facing configurator later, with explicit authorization and no exposure of internal costs or CAD files. SVG rendering is independent of Inventor. Reference: [fence light sketch](fence-light-concept.svg).

Standard fence light: fixed 60 x 40 mm post. Light positions front (mesh side), rear, double. Standard overhang approximately 17 mm includes mesh and retaining strip; short 0 mm. Front/rear short variants remain distinct because of drilling tab position. Hole 0 (none), 57 mm (Camas), or custom. ASA colors RAL 7016, 9005, 9006 and other available ASA. Neutral white LED with removable warm-white filter as standard. Double uses two LEDs, PETG covers and filters, one terminal. Separate special product definition for nonstandard post dimensions because cover and filter geometry change. Visualizer should respond to parameters, show hole/tab and lit sides, surface color, and label dimensions. Concept only, not CAD or dimensional proof. Export Inventor files manually with review; optional API later.

Technical data model first; typed parameter validation, canonical geometry signatures, duplicate prevention, immutable released revisions, file SHA256 verification, release workflow and BOM mapping are follow-up tasks before production use.
