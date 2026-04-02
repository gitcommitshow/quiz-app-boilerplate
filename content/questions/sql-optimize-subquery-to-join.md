---
id: 11
slug: sql-optimize-subquery-to-join
type: subjective
version: 3
labels: []
keywords:
  - SELECT
  - FROM
  - WHERE
  - JOIN
minKeywords: 4
maxLength: 300
---

Optimize the following SQL query to improve its performance: `SELECT * FROM orders WHERE customer_id IN (SELECT customer_id FROM customers WHERE status = 'active');`

```mermaid
erDiagram
    customers ||--o{ orders : "customer_id"
    customers {
        int customer_id
        string status
    }
    orders {
        int order_id
        int customer_id
    }
```

## Expected answer

SELECT o.* FROM orders o JOIN customers c ON o.customer_id = c.customer_id WHERE c.status = 'active';

## Hints

- Consider using a JOIN instead of a subquery.
- Think about how to reduce the number of rows processed.
