# Filament consumption roadmap

Planned, not implemented. Track physical consumption by spool/batch in grams, separately from purpose and financial treatment.

- Purpose: production, research/development, private, maintenance/calibration.
- Outcome: successful, failed, purge/support/waste as applicable. Failed prints can be linked to a work order or standalone.
- Record timestamp, spool/batch, quantity, printer, optional work order and print job, reason, measurement/source, and linked stock movement.
- Manual entries first; later import printer history as reviewable suggestions with stable external job identifiers, deduplication and explicit approval. A single physical consumption must not be booked twice by work order and import.
- Use ERPNext stock ledger as physical inventory source. Determine actual order material costs including failures, distinguish development costs and private withdrawals. Private use must not be treated as ordinary business expense; financial handling to be designed for non-perpetual inventory and EÜR separately.
- Support corrections by reversal or adjustment with audit trail. Do not silently overwrite historical inventory movements.
