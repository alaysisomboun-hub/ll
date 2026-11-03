# Security Specification & Test Matrix

## 1. Data Invariants
1. Products cannot have negative stock or negative price values.
2. Sales must contain valid subtotal, totalAmount, cost, and profit where `profit = totalAmount - totalCost`.
3. Inventory transactions must record previousStock, newStock, and quantityChange with a verified reason.
4. Sales cannot be modified after completion except for voiding or status update with a valid void reason.
5. Deletion of sale records is restricted to store owners to preserve transaction audit integrity.
6. Settings can only be edited by Store Owners or Managers.

## 2. Dirty Dozen Payloads (Targeting Security Boundaries)
1. **Unauthenticated Read/Write**: Attempting to read `/sales` without Firebase auth tokens -> PERMISSION_DENIED.
2. **Negative Stock Insertion**: Inserting product with `stockQty: -50` -> PERMISSION_DENIED.
3. **Price Manipulation in Sale**: Sending sale with invalid math (`totalProfit: 99999999` while `totalAmount: 10`) -> PERMISSION_DENIED.
4. **Non-Owner Settings Override**: Cashier updating `storeName` or `taxRatePercent` -> PERMISSION_DENIED.
5. **Junk ID Poisoning**: Creating document with a 2048-character junk ID string -> PERMISSION_DENIED.
6. **Debt ledger alteration**: Cashier arbitrarily clearing a debt without record -> PERMISSION_DENIED.
7. **Expense tampering**: Deleting audited expenses by unauthorized employee -> PERMISSION_DENIED.
8. **Direct inventory mutation**: Bypassing inventory transaction records -> PERMISSION_DENIED.
9. **Role self-escalation**: Cashier changing own user role to `owner` -> PERMISSION_DENIED.
10. **Customer deletion with active debt**: Deleting customer who still has positive `outstandingDebt` -> PERMISSION_DENIED.
11. **Spoofed Payment record**: Writing negative payment amounts or zero currency -> PERMISSION_DENIED.
12. **Blanket Collection Dumping**: Unauthenticated crawler scanning `/customers` PII -> PERMISSION_DENIED.
