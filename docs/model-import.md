# Existing model inventory

Run locally with Python 3.10+:

```sh
python scripts/scan_models.py "/path/to/models" -o model_inventory.csv
```

Read-only scan of STL, 3MF, Inventor and STEP files. The semicolon-separated UTF-8 BOM CSV contains relative paths, sizes, SHA256, duplicate candidates and filename revision hints. Hints are never accepted automatically. Files with identical hashes may still belong to distinct revisions. File modification dates are deliberately not treated as export dates.

Review the manifest before importing. Configuration and internal_revision start empty. No ERPNext writes or upload occur in this step. Existing output is not overwritten. The next import stage will use confirmed configuration and revision mappings and revalidate hashes. Keep the manifest local or redact private names before sharing; do not commit customer data.

The scanner recognizes fence light housing/diffuser, standard/special hints, position, Simpel, B57/B57mm, confirmed KB or absent drilling suffix=0, standard overhang=17 unless Simpel, post dimensions and contour/feature hints. Archive paths are flags, never automatic revision status. UTC modification and available birth timestamps are evidence only, not confirmed export dates. Diffusers are separate components and may have independent revisions. No automatic mapping of special LED coordinates.

Owner confirmed KB and absent drilling suffix mean no drilling, Simpel means zero overhang and otherwise standard housing overhang is 17 mm. Eckig means Bounding Box, Gerade means Gummiband. Diffuser revisions are independent of housing revisions; subsequent BOMs specify compatible component revisions. Special geometry still requires review.

Legacy printer prefixes CE5/CE5K, quantities, nonzero duration and material estimates are hints, not actual consumption. Diffuser compatibility ranges are not own revision numbers. Kurz/Lang/KurzLang are qualitative overhang classes without invented dimensions. Test/Draft/BETA and OldVersions are flagged. No G-code required.
