SKMedKART V5.9.26 — MEDICINE CHECK STOCK CONSISTENCY FIX

Root cause:
Medicine Check previously looked for saleable batches using an exact productId match only. Legacy/duplicate medicine records can have the same medicine name but different productId values. In that situation Purchase/Stock Detection can show stock while Medicine Check incorrectly reports Out of Stock.

Fix included:
1. Medicine Check matches batches by productId OR normalized medicine name.
2. Duplicate product records with the same medicine name are grouped for availability checking.
3. Medicine-search suggestions use the same matching logic.
4. Stock/expiry views use the same batch matching logic for consistency.
5. If product stock exists but no saleable batch is linked, the screen reports the mismatch instead of falsely saying Out of Stock.
6. Existing Purchase, Billing, Orders, Returns, Invoice and Firebase business logic were not otherwise changed.

Verified: admin.js passes Node JavaScript syntax check.


V5.9.27 FULL STOCK AUDIT FIX
- Removed duplicate pending-sale stock deduction.
- Medicine Check and Stock list use canonical medicine-level effective stock.
- Legacy product/batch ID mismatches no longer create false Out of Stock.
