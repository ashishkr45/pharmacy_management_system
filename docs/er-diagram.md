# ER diagram

Source of truth: `backend/prisma/schema.prisma`. Render this Mermaid block to
`docs/er-diagram.png` when the schema changes. The relationship labels name the
business meaning of each foreign key.

```mermaid
erDiagram
  USERS ||--o{ PURCHASES : "created_by"
  USERS ||--o{ SALES : "created_by"
  USERS ||--o{ RETURNS : "created_by"
  USERS ||--o{ STOCK_ADJUSTMENTS : "created_by"
  USERS ||--o{ STOCK_MOVEMENTS : "created_by (nullable)"
  USERS ||--o{ AUDIT_LOGS : "user (nullable)"

  CATEGORIES ||--o{ MEDICINES : groups
  SUPPLIERS ||--o{ PURCHASES : supplies
  SUPPLIERS ||--o{ BATCHES : "supplier (nullable)"

  PURCHASES ||--|{ PURCHASE_ITEMS : contains
  MEDICINES ||--o{ PURCHASE_ITEMS : "bought as"
  MEDICINES ||--o{ BATCHES : has
  BATCHES ||--o{ PURCHASE_ITEMS : "receives"
  BATCHES ||--o{ SALE_ITEMS : "sold from"
  BATCHES ||--o{ STOCK_ADJUSTMENTS : adjusted
  BATCHES ||--o{ STOCK_MOVEMENTS : "ledger rows"

  MEDICINES ||--o{ SALE_ITEMS : "sold as"
  SALES ||--|{ SALE_ITEMS : contains
  SALE_ITEMS ||--o{ RETURNS : "returned via"

  USERS {
    int id PK
    string name
    string email UK
    string password_hash
    enum role "ADMIN | PHARMACIST | INVENTORY_MANAGER"
    bool is_active
  }
  CATEGORIES {
    int id PK
    string name UK
  }
  SUPPLIERS {
    int id PK
    string name
    string contact_person
    string phone
    string email
    string address
    bool is_active
  }
  MEDICINES {
    int id PK
    string name
    string generic_name
    string sku UK
    int category_id FK
    string unit
    int reorder_level
    decimal tax_rate "nullable -> settings.defaultTaxRate"
    decimal default_sale_price
    bool is_active
  }
  BATCHES {
    int id PK
    int medicine_id FK
    string batch_no "unique per medicine"
    date expiry_date "expired when <= today"
    int quantity_on_hand "CHECK >= 0"
    decimal purchase_price
    decimal sale_price
    int supplier_id FK
  }
  PURCHASES {
    int id PK
    int supplier_id FK
    string supplier_invoice_no
    datetime purchase_date
    decimal total_cost
    int created_by_id FK
  }
  PURCHASE_ITEMS {
    int id PK
    int purchase_id FK
    int medicine_id FK
    int batch_id FK
    int quantity "CHECK > 0"
    decimal cost_price
    decimal sale_price
    date expiry_date
  }
  SALES {
    int id PK
    string invoice_no UK
    string customer_name
    string customer_phone
    enum payment_method "CASH | CARD | UPI"
    decimal subtotal
    decimal tax_total
    decimal total
    enum status "COMPLETED | PARTIALLY_RETURNED | FULLY_RETURNED"
    string idempotency_key UK
    string request_hash
    int created_by_id FK
    datetime created_at
  }
  SALE_ITEMS {
    int id PK
    int sale_id FK
    int medicine_id FK
    int batch_id FK
    int quantity "CHECK > 0"
    decimal unit_price
    decimal tax_rate
    decimal tax_amount
    decimal line_total "tax-inclusive"
    int returned_quantity "0 <= returned <= quantity"
  }
  RETURNS {
    int id PK
    int sale_item_id FK
    int quantity "CHECK > 0"
    string reason
    int created_by_id FK
  }
  STOCK_ADJUSTMENTS {
    int id PK
    int batch_id FK
    int delta "CHECK <> 0"
    enum reason_code "DAMAGED | EXPIRED | COUNT_CORRECTION | LOST | OTHER"
    string note
    int created_by_id FK
  }
  STOCK_MOVEMENTS {
    int id PK
    int batch_id FK
    enum type "OPENING | PURCHASE | SALE | RETURN | ADJUSTMENT"
    int qty_delta "CHECK <> 0"
    enum reference_type
    int reference_id "-> purchase/sale/return/adjustment id"
    string reason
    int created_by_id FK
    datetime created_at
  }
  AUDIT_LOGS {
    int id PK
    int user_id FK
    string action
    string entity_type
    string entity_id
    json before
    json after
    datetime created_at
  }
  SETTINGS {
    string key PK
    string value
  }
```

## Notes

- **Ledger invariant:** for every batch, `SUM(stock_movements.qty_delta) = batches.quantity_on_hand`.
- `stock_movements.reference_id` intentionally has no FK: it points at one of four tables depending on `reference_type`.
- `batches` is unique on `(medicine_id, batch_no)`; money columns are `DECIMAL(12,2)`; dates are `DATE`.
- DB-level `CHECK` constraints live in `backend/prisma/migrations/*/migration.sql` (hand-edited).
