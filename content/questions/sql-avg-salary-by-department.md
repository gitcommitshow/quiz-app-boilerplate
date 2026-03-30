---
id: 2
slug: sql-avg-salary-by-department
type: subjective
version: 26
labels: []
keywords:
  - SELECT
  - AVG
  - FROM
  - GROUP BY
  - department
  - HAVING
  - COUNT
  - ORDER BY
  - DESC
minKeywords: 6
maxLength: 500
---

Write a `SQL` query to find the average salary for each department, but only include departments with more than 5 employees. Order the results by the average salary in descending order.

```mermaid
erDiagram
    Department ||--o{ Employee : "has many"
    Employee {
        int id
        string name
        int salary
        int department_id
    }
    Department {
        int id
        string name
    }
```

**Note:** The schema is only indicative, you may use any reasonable table schema in your mental model; the core concept is what matters.

## Expected answer

select department, AVG(salary) as salary_avg from employees group by department having count(*) > 5 order by salary_avg desc

## Hints

- Use GROUP BY to group by department.
- HAVING is used to filter grouped results.
