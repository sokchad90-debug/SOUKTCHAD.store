# Sokchad — Admin Panel API

This is the **separate admin API** for the Sokchad admin dashboard. It is completely independent from the main app API.

## Architecture

```
backend/
├── config/
│   └── database.php        ← Shared DB config (main app)
├── api_orders.php          ← Main app API (orders)
├── api_stats.php           ← Main app API (seller stats)
└── admin/                  ← ADMIN API (separate)
    ├── .htaccess           ← Security rules
    ├── config.php          ← Admin-specific config (CORS, auth guard)
    ├── api_stats.php       ← Admin dashboard stats
    ├── api_users.php       ← User management (ban, verify, roles)
    ├── api_staff.php       ← Staff management (CRUD, permissions)
    ├── api_products.php    ← Product management (delete, pin, feature)
    └── api_orders.php      ← Order management (disputes, cancel)
```

## Key Differences from Main API

| Feature | Main API | Admin API |
|---------|----------|-----------|
| CORS | `*` (all origins) | Restricted to `admin.sokchad.com` only |
| Auth | Any authenticated user | `admin` / `super_admin` / `staff` only |
| Access | User's own data | All users' data |
| Permissions | None (role-based in logic) | Fine-grained staff permissions |

## Endpoints

### Stats
- `GET /admin/api_stats.php` — Dashboard overview

### Users
- `GET /admin/api_users.php` — List users (paginated, filterable)
- `GET /admin/api_users.php?id=X` — Single user
- `PUT /admin/api_users.php?id=X` — Ban/unban, verify, change role
- `DELETE /admin/api_users.php?id=X` — Delete user (super_admin only)

### Staff
- `GET /admin/api_staff.php` — List staff
- `POST /admin/api_staff.php` — Create staff (super_admin only)
- `PUT /admin/api_staff.php?id=X` — Update permissions, toggle active
- `DELETE /admin/api_staff.php?id=X` — Remove staff (super_admin only)

### Products
- `GET /admin/api_products.php` — List all products
- `PUT /admin/api_products.php?id=X` — Pin, feature, change status
- `DELETE /admin/api_products.php?id=X` — Delete product

### Orders & Disputes
- `GET /admin/api_orders.php` — List all orders
- `GET /admin/api_orders.php?scope=disputes` — Disputed orders
- `PUT /admin/api_orders.php?id=X` — Resolve dispute, cancel, confirm

## Deployment

Upload `backend/admin/` to: `public_html/api/admin/`

URL: `https://sokchad.com/api/admin/api_stats.php`

## Security Notes

1. **CORS is restricted** — Update `$ADMIN_ALLOWED_ORIGINS` in `config.php` with your admin panel domain
2. **All requests require admin JWT** — Non-admin tokens get 403
3. **Staff permissions enforced** — Each endpoint checks specific permissions
4. **Super_admin only** for: deleting users, changing roles, creating/removing staff, cancelling orders