---
id: 15
slug: sql-duplicate-order-ids-having
type: subjective
version: 2
labels: [sql, data-quality]
keywords: [SELECT, GROUP BY, HAVING, COUNT, order_id]
minKeywords: 4
maxLength: 350
---

Table `orders` has at least columns `order_id` and `customer_id`. Write a SQL query that lists every `order_id` value that appears **more than once** in the table, and how many times each appears.

```mermaid
erDiagram
    orders {
        int order_id
        int customer_id
    }
```

## Expected answer

SELECT order_id, COUNT(*) AS cnt FROM orders GROUP BY order_id HAVING COUNT(*) > 1;

## Hints

- Aggregate per `order_id`, then filter aggregates with `HAVING`, not `WHERE` on the raw rows.
- `COUNT(*)` counts rows per group after `GROUP BY order_id`.
