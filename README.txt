SKMedKART V5.9.45 - Stock Reconciliation Only Fix

Only the legacy stock reconciliation mismatch was changed: when purchase history exists but its PURCHASE stock movement is missing/incomplete, purchase records are used to rebuild the batch stock, then actual billed sales and returns are applied. Existing opening-stock batches without purchase history are preserved. No billing, purchase entry UI, reminders, orders, restore logic, or other business features were intentionally changed.
