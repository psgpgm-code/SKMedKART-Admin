SKMedKART V5.9.30 — FINAL STOCK LEDGER AUDIT

Purpose:
This build keeps the existing Offline + Billing Safe mode. Firebase live sync is NOT enabled and no payment/billing plan is required for local billing.

Stock source-of-truth fix:
1. Purchase-backed batches use their recorded PURCHASE movements as the opening quantity.
2. SALE, RETURN, ORDER_RESERVE and ORDER_CANCEL_RESTOCK movements are applied exactly once.
3. A billed online order that already reserved stock does not have its SALE movement deducted a second time.
4. Legacy bills without SALE movements are deducted once from the ledger calculation.
5. Returned legacy bills without RETURN movements are restored once.
6. Product stock is rebuilt from batch stock.
7. Medicine Check and Stock Detection use the same batch/product calculation.
8. Opening-stock batches without purchase movements retain their stored opening quantity.
9. A one-time safety backup is created before local stock reconciliation.
10. Service-worker cache and admin.js cache-busting versions are aligned to V5.9.30.

Expected examples:
- Purchase 20 - Bill 3 = 17
- Purchase 20 - Reserved 3 + billed reserved order = 17
- Purchase 1 + Purchase 1, no bill = 2
- Purchase 20 - Sale 3 + Return 3 = 20

Validation:
- admin.js syntax check: PASS
- sw.js syntax check: PASS
- stock-ledger scenario tests: PASS
