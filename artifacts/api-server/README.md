# Tailor Book — API Server

Express + Drizzle ORM + MySQL backend for the Tailor Book mobile app.

## Quick start

```bash
# 1. Make sure MySQL is running and DATABASE_URL is set
#    (defaults to mysql://root:root@localhost:3306/tailorbook)

# 2. Apply migrations + seed data
cd lib/db
pnpm db:migrate
pnpm db:seed

# 3. Start the API server
cd ../../artifacts/api-server
npm run dev
# → API:    http://localhost:4000/api
# → Health: http://localhost:4000/api/healthz
```

## Demo credentials (after seeding)

| Role  | Email                  | Mobile        | Password   |
| ----- | ---------------------- | ------------- | ---------- |
| Admin | admin@tailorbook.com   | 9999999999    | admin123   |
| Tailor| ramesh@tailor.com      | 9876543210    | tailor123  |

You can sign in with **either** the email or the mobile number.

## Endpoints

All endpoints are mounted under `/api`.

- `POST   /api/auth/login`           — `{ emailOrMobile, password }` → `{ token, user }`
- `POST   /api/auth/register`        — create a pending user
- `GET    /api/auth/me`              — current user (Bearer)
- `PATCH  /api/auth/me`              — update own profile
- `POST   /api/auth/logout`          — invalidate session

- `GET    /api/customers`            — list (tailor-scoped; admin sees all)
- `POST   /api/customers`            — create
- `PATCH  /api/customers/:id`        — update
- `DELETE /api/customers/:id`        — delete (audited)

- `GET    /api/measurements`         — list, optional `?customerId=…`
- `POST   /api/measurements`         — create
- `PATCH  /api/measurements/:id`     — update
- `DELETE /api/measurements/:id`     — delete (audited)
- `GET    /api/measurements/latest`  — most recent for `?customerId=…&productType=…` (used by the auto-fill feature)

- `GET    /api/invoices`             — list
- `POST   /api/invoices`             — create
- `PATCH  /api/invoices/:id`         — update
- `PATCH  /api/invoices/:id/status`  — change status
- `DELETE /api/invoices/:id`         — delete (audited)

- `GET    /api/users`                — admin: list users
- `GET    /api/users/pending`        — admin: list pending users
- `PATCH  /api/users/:id/approve`    — admin: approve
- `PATCH  /api/users/:id/reject`     — admin: reject
- `PATCH  /api/users/:id`            — admin: update

## Auto-fill feature

Used by the mobile app's **Add Order → Add Item** flow:

```
GET /api/measurements/latest?customerId=…&productType=Shirt
```

Returns the single most-recent measurement for that customer + product type
(sorted by `measurementDate` desc, then `createdAt` desc). The mobile app
calls this every time the product type changes on an order item.

## Audit log

Every delete (and other destructive actions) writes a row to `audit_log` with
`actorId`, `action`, `entityType`, `entityId`, and a JSON payload.
