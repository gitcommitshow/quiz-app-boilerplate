---
id: 10
slug: sql-group-by-category-fix
type: subjective
version: 3
labels: []
keywords:
  - SELECT
  - SUM
  - FROM
  - GROUP BY
minKeywords: 4
maxLength: 300
---

The following SQL query is intended to retrieve the total sales for each product category, but it contains an error. Identify and fix the error: `SELECT category, SUM(sales) FROM products GROUP BY product_id;`

```mermaid
erDiagram
    products {
        int product_id
        string category
        decimal sales
    }
```

## Expected answer

SELECT category, SUM(sales) FROM products GROUP BY category;

## Hints

- Ensure that the GROUP BY clause includes the correct column.
- Think about how to aggregate data by category.
