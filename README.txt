SKMedKART V5.9.32 — PURCHASE EDIT + LIGHT PERFORMANCE FIX

Changes in this build (only the requested changes):
1. Added “Edit Purchase” button to each purchase history row.
2. Editing loads the original purchase into the existing Purchase Entry form.
3. Correcting quantity safely adjusts the current batch stock by the quantity difference.
4. Correcting purchase details updates the matching purchase record and its stock movement.
5. Batch-number changes are blocked when the batch has already been used by a sale/return/order, because changing it then could corrupt stock history.
6. Changing the medicine/product during an edit is blocked for the same stock-safety reason.
7. Pending local purchase data is updated together with the edited purchase.
8. Removed one duplicate full-screen render after a new purchase save, reducing unnecessary work.
9. Service-worker and script cache versions bumped so the new code is loaded.

No Firebase mode, payment options, billing logic, stock-deduction rules, return rules, order rules, invoice layout, or other requested features were intentionally changed.

Verification:
- admin.js passes Node JavaScript syntax check.
- index.html references the new script version.
- service worker cache/version references the same build version.

V5.9.33: Purchase header persistence only. Purchase Date, Supplier and Purchase Invoice No. remain populated for consecutive purchase entries until the user changes them. Other features unchanged.
