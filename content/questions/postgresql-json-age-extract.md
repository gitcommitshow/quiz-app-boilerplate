---
id: 6
slug: postgresql-json-age-extract
type: subjective
version: 3
labels: []
keywords:
  - SELECT
  - "->"
  - "->>"
  - name
  - age
  - user_data
  - FROM
minKeywords: 6
maxLength: 500
---

Write a PostgreSQL query to extract the `name` field from a JSON column called `user_data` in a table named `users`, but only for records where the JSON contains a `age` field greater than 30.

## Expected answer

SELECT user_data->>'name' AS user_name FROM users WHERE (user_data->>'age')::int > 30;

## Hints

- Use the '->' operator to access JSON object fields.
- Use the '->>' operator to return JSON object fields as text.
- Cast the 'age' field to an integer for comparison.
