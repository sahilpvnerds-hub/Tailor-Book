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

## LAN hosting

The API server listens on `0.0.0.0`, so other devices on the same LAN/Wi-Fi can
reach it through the host machine's private IP address.

1. Find the host IP address:

   ```powershell
   ipconfig
   ```

   Use the IPv4 address for the active Wi-Fi/Ethernet adapter, for example
   `192.168.0.89`.

2. Start the API:

   ```bash
   cd artifacts/api-server
   pnpm run dev
   ```

3. From another device on the same network, open:

   ```text
   http://<host-lan-ip>:4000/api/healthz
   ```

4. Allow only the required API port through the host firewall:

   ```powershell
   New-NetFirewallRule -DisplayName "Tailor Book API 4000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4000 -Profile Private
   ```

## MySQL LAN access

Keep the existing database and tables unchanged. Only change MySQL server and
user access settings when the database must accept LAN connections.

1. Configure MySQL to bind to a LAN-reachable address in `my.ini`/`mysqld.cnf`:

   ```ini
   [mysqld]
   bind-address=0.0.0.0
   ```

   For tighter access, use the database host's specific LAN IP instead of
   `0.0.0.0`.

2. Create or update an application user restricted to your LAN subnet:

   ```sql
   CREATE USER IF NOT EXISTS 'tailorbook_app'@'192.168.0.%' IDENTIFIED BY 'use-a-strong-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
     ON tailorbook.* TO 'tailorbook_app'@'192.168.0.%';
   FLUSH PRIVILEGES;
   ```

   Adjust `192.168.0.%` to match your network, such as `10.0.0.%`.

3. Set the API database URL in `artifacts/api-server/.env`:

   ```env
   DATABASE_URL=mysql://tailorbook_app:<password>@<mysql-host-lan-ip>:3306/tailorbook
   ```

4. Allow only MySQL port `3306` from trusted LAN devices in the database host
   firewall. Do not expose MySQL to the public internet.

## Mobile app on LAN

For a physical device, set the mobile app API URL to the API host's LAN IP:

```env
EXPO_PUBLIC_API_URL=http://<api-host-lan-ip>:4000/api
```

Then start Expo in LAN mode:

```bash
cd artifacts/mobile
pnpm run start:lan
```

Local development still works with:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```
