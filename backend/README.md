# Sokchad PHP Backend

## Deployment Guide (Hostinger)

### Step 1: Create MySQL Database
1. Go to **Hostinger hPanel → Databases → MySQL Databases**
2. Create a new database (e.g., `u123456789_sokchad`)
3. Create a database user with full privileges
4. Note down: **DB Name**, **DB User**, **DB Password**

### Step 2: Import Schema
1. Go to **Hostinger hPanel → Databases → phpMyAdmin**
2. Select your database
3. Click **Import** tab
4. Upload `schema.sql` file and execute

### Step 3: Upload PHP Files
1. Go to **Hostinger hPanel → File Manager**
2. Navigate to `public_html/` (or create `public_html/api/`)
3. Upload the following files:
   ```
   public_html/api/
   ├── config/
   │   └── database.php
   ├── api_orders.php
   ├── api_stats.php
   └── .htaccess
   ```

### Step 4: Configure Credentials
1. Open `config/database.php`
2. Update these constants:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'u123456789_sokchad');
   define('DB_USER', 'u123456789_admin');
   define('DB_PASS', 'your_password_here');
   define('JWT_SECRET', 'change_to_64_random_chars');
   ```

### Step 5: Configure Frontend
1. Open `services/ordersService.ts` in the app
2. Set `API_BASE_URL`:
   ```typescript
   export const API_BASE_URL = 'https://yourdomain.com/api';
   ```

### Step 6: Test
```bash
# Test orders endpoint
curl https://yourdomain.com/api/api_orders.php \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test create order
curl -X POST https://yourdomain.com/api/api_orders.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"product_id":"1","payment_method_id":"airtel","reference_id":"REF123","buyer_phone":"90123456"}'
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api_orders.php` | Yes | List user orders |
| GET | `/api_orders.php?id=X` | Yes | Get single order |
| POST | `/api_orders.php` | Yes | Create order |
| PUT | `/api_orders.php?id=X` | Yes | Update order status |
| GET | `/api_stats.php` | Yes | Seller statistics |
| GET | `/api_stats.php?scope=admin` | Yes | Admin dashboard stats |

## Security Notes
- All passwords are hashed with `password_hash()` (bcrypt)
- JWT tokens expire after 7 days
- CORS headers allow all origins (restrict in production)
- Reference IDs have a UNIQUE constraint to prevent reuse
- Role-based access: buyers cannot sell, sellers cannot buy
