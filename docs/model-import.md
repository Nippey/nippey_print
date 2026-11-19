# Existing model inventory

Run locally with Python 3.10+:

```sh
python scripts/scan_models.py "/path/to/models" -o model_inventory.csv
```

Read-only scan of STL, 3MF, Inventor and STEP files. The semicolon-separated UTF-8 BOM CSV contains relative paths, sizes, SHA256, duplicate candidates and filename revision hints. Hints are never accepted automatically. Files with identical hashes may still belong to distinct revisions. File modification dates are deliberately not treated as export dates.

Review the manifest before importing. Configuration and internal_revision start empty. No ERPNext writes or upload occur in this step. Existing output is not overwritten. The next import stage will use confirmed configuration and revision mappings and revalidate hashes. Keep the manifest local or redact private names before sharing; do not commit customer data.
