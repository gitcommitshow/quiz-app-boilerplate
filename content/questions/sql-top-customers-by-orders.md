---
id: 3
slug: sql-top-customers-by-orders
type: subjective
version: 9
labels: []
keywords:
  - SELECT
  - customer_name
  - COUNT
  - orders
  - JOIN
  - customers
  - GROUP BY
  - ORDER BY
  - DESC
  - LIMIT
minKeywords: 7
maxLength: 600
---

Write a query to select the top 5 customers who have made the most orders. Include the customer name and the total number of orders they've made. Assume the following database schema:

```mermaid
erDiagram
    customers ||--o{ orders : "has many"
    customers {
        int customer_id
         string customer_name
    }
    orders {
        int order_id
        int customer_id
    }
```

## Expected answer

select c.customer_name, count(o.order_id) as total_orders from customers c join orders o on c.customer_id = o.customer_id group by c.customer_id order by total_orders desc limit 5

## Hints

- Join the customers and orders tables.
- Use COUNT and GROUP BY to get the total orders per customer.
