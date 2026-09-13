SKMedKART V5.9.49
Full stock-ledger integrity audit.

Changes ONLY to inventory reconciliation:
1. Purchase quantities are the inbound source for purchase-backed batches.
2. Non-returned bills are counted once by invoice number; returned bills are excluded.
3. Bills created from an active reserved order do not deduct twice; once the order is Billed, the bill is counted as the sale.
4. Active order reservations are counted once from reservation records, with legacy movement fallback.
5. Exact duplicate purchase rows created by a repeated restore are not double-counted when supplier invoice + medicine + batch + date + quantity + cost match.
6. Legacy product/batch links are resolved safely by product ID/name and batch number; unambiguous links are repaired.
7. Product stock is rebuilt from reconciled batch stock, keeping all products on the same rule.

No application sections/features were removed. Existing Billing, Purchase, Search, Reminder, Reports, Orders, Returns and Backup/Restore UI remain present.

Audit checks completed: JavaScript syntax, Service Worker syntax, button handler references, duplicate HTML ids, required search/button ids, and ZIP integrity.
