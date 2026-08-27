SKMedKART – ORDER CANCEL AUTO RESTOCK UPDATE

Feature added:
- Admin cancels a customer order.
- If that order had already reserved/deducted stock, the exact batch stock and product stock are automatically added back.
- A stockMovements record is created with type ORDER_CANCEL_RESTOCK.
- stockRestored flag prevents the same cancelled order from adding stock twice.
- If no stock was ever reserved/deducted for the order, cancellation does NOT add stock, preventing incorrect extra stock.
- Selecting Cancelled from the order status dropdown also uses the same safe cancellation logic.

Important:
The order must contain reservation data such as stockDeductedItems/reservedItems/stockReservedItems/allocatedItems, or item-level stockReserved/stockDeducted/reserved flags with productId and batchId. Otherwise there is no stock to restore, and the app safely cancels without increasing stock.
