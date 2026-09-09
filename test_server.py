#!/usr/bin/env python3
"""
Sokchad — Local Test Server
Serves the Admin Panel + Mock API on http://localhost:8080
For testing purposes only — not for production.
"""

import http.server
import json
import os
import re
import sqlite3
import hashlib
import time
import secrets
import threading
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

PORT = 9090
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'sokchad_test.db')
ADMIN_HTML = os.path.join(BASE_DIR, 'backend', 'admin', 'index.html')
JWT_SECRET = '09b1708f2f6b806fcc8688a489a98d9d5679e9b418fab8b849dc749bac499a24'

# ============================================================
# DATABASE INIT (SQLite for testing)
# ============================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT, username TEXT, email TEXT, phone TEXT,
            role TEXT DEFAULT 'buyer', avatar_url TEXT, cover_url TEXT,
            is_verified INTEGER DEFAULT 0, verified_until TEXT,
            is_banned INTEGER DEFAULT 0, banned_until TEXT,
            seller_id TEXT, rating REAL DEFAULT 0, total_sales INTEGER DEFAULT 0,
            total_purchases INTEGER DEFAULT 0, location TEXT, bio TEXT,
            language_pref TEXT DEFAULT 'en', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            password_hash TEXT
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id INTEGER, title_en TEXT, title_fr TEXT, title_ar TEXT,
            description_en TEXT, price INTEGER DEFAULT 0, category_id TEXT,
            condition TEXT DEFAULT 'new', location TEXT, status TEXT DEFAULT 'active',
            is_pinned INTEGER DEFAULT 0, is_featured INTEGER DEFAULT 0, views INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP, images TEXT
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER, buyer_id INTEGER, seller_id INTEGER,
            amount INTEGER DEFAULT 0, payment_method_id TEXT, reference_id TEXT,
            buyer_phone TEXT, status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS admin_staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, name TEXT, email TEXT, password_hash TEXT,
            permissions TEXT DEFAULT '[]', is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS verification_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, id_front_url TEXT, id_back_url TEXT,
            selfie_url TEXT, receipt_url TEXT, status TEXT DEFAULT 'pending',
            admin_notes TEXT, reviewed_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ad_banners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT, image_url TEXT, link TEXT, is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS store_settings (
            key TEXT PRIMARY KEY, value TEXT
        );
    ''')

    # Seed admin user if not exists
    c.execute("SELECT id FROM admin_staff WHERE email='admin@sokchad.com'")
    if not c.fetchone():
        pw_hash = hashlib.sha256('admin123'.encode()).hexdigest()
        c.execute("INSERT INTO admin_staff (user_id, name, email, password_hash, permissions, is_active) VALUES (1, 'Super Admin', 'admin@sokchad.com', ?, '[\"manage_sellers\",\"manage_disputes\",\"manage_payments\",\"manage_users\",\"view_blacklist\"]', 1)", (pw_hash,))
        c.execute("INSERT OR IGNORE INTO users (id, full_name, username, email, role, is_verified) VALUES (1, 'Super Admin', 'admin', 'admin@sokchad.com', 'super_admin', 1)")

    # Seed sample products if empty
    c.execute("SELECT COUNT(*) FROM products")
    if c.fetchone()[0] == 0:
        for i in range(1, 6):
            c.execute("INSERT INTO products (seller_id, title_en, price, category_id, status) VALUES (1, ?, ?, 'electronics', 'active')",
                      (f'Product {i}', 15000 + i * 1000))

    # Seed sample orders if empty
    c.execute("SELECT COUNT(*) FROM orders")
    if c.fetchone()[0] == 0:
        statuses = ['pending', 'confirmed', 'completed', 'disputed', 'cancelled', 'delivered']
        for i, s in enumerate(statuses):
            c.execute("INSERT INTO orders (product_id, buyer_id, seller_id, amount, status) VALUES (?, 2, 1, ?, ?)",
                      (i+1, 20000 + i*5000, s))

    # Seed more users
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] <= 1:
        for i in range(2, 12):
            role = 'seller' if i % 3 == 0 else 'buyer'
            c.execute("INSERT INTO users (id, full_name, username, email, phone, role, is_verified, total_sales, total_purchases) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                      (i, f'User {i}', f'user{i}', f'user{i}@test.com', f'+23560000{i:02d}', role, i % 2, i*3, i*2))

    conn.commit()
    conn.close()

# ============================================================
# JWT (simplified)
# ============================================================
import base64

def b64encode(data):
    return base64.urlsafe_b64encode(data).decode().rstrip('=')

def b64decode(data):
    padding = 4 - len(data) % 4
    return base64.urlsafe_b64decode(data + '=' * padding)

def encode_jwt(payload):
    header = b64encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    payload['exp'] = int(time.time()) + 7 * 86400
    payload_encoded = b64encode(json.dumps(payload).encode())
    sig = b64encode(hashlib.sha256(f"{header}.{payload_encoded}".encode() + JWT_SECRET.encode()).digest())
    return f"{header}.{payload_encoded}.{sig}"

def decode_jwt(token):
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        expected_sig = b64encode(hashlib.sha256(f"{parts[0]}.{parts[1]}".encode() + JWT_SECRET.encode()).digest())
        if not secrets.compare_digest(expected_sig, parts[2]): return None
        payload = json.loads(b64decode(parts[1]))
        if payload.get('exp', 0) < time.time(): return None
        return payload
    except:
        return None

# ============================================================
# REQUEST HANDLER
# ============================================================
class SokchadHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Suppress logs

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_json({'success': True})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        # Serve admin panel
        if path == '/' or path == '/admin' or path == '/admin/':
            self.serve_admin_html()
            return

        # Health check
        if path == '/health.php':
            self.send_json({
                'status': 'healthy', 'checks': {'php': True, 'db': True, 'uploads_dir': True, 'jwt': True},
                'timestamp': datetime.now().isoformat()
            })
            return

        # API routes
        if path.startswith('/admin/api_'):
            self.handle_admin_api('GET', path, params, None)
            return

        self.send_json({'success': False, 'error': 'Not found'}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.read_body()

        if path.startswith('/admin/api_'):
            self.handle_admin_api('POST', path, None, body)
            return

        self.send_json({'success': False, 'error': 'Not found'}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        body = self.read_body()
        if path.startswith('/admin/api_'):
            self.handle_admin_api('PUT', path, params, body)
            return
        self.send_json({'success': False, 'error': 'Not found'}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        if path.startswith('/admin/api_'):
            self.handle_admin_api('DELETE', path, params, None)
            return
        self.send_json({'success': False, 'error': 'Not found'}, 404)

    def serve_admin_html(self):
        try:
            with open(ADMIN_HTML, 'r', encoding='utf-8') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(content.encode())
        except:
            self.send_json({'success': False, 'error': 'Admin panel not found'}, 404)

    def read_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length:
                data = self.rfile.read(length)
                return json.loads(data)
        except:
            pass
        return {}

    def get_auth(self):
        auth = self.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None
        token = auth[7:]
        payload = decode_jwt(token)
        if not payload:
            return None
        return payload

    def require_admin(self):
        auth = self.get_auth()
        if not auth or auth.get('role') not in ('admin', 'super_admin', 'staff'):
            self.send_json({'success': False, 'error': 'Admin access required'}, 403)
            return None
        return auth

    def handle_admin_api(self, method, path, params, body):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # Login
        if path == '/admin/api_login.php' and method == 'POST':
            email = body.get('email', '')
            password = body.get('password', '')
            pw_hash = hashlib.sha256(password.encode()).hexdigest()
            c.execute("SELECT * FROM admin_staff WHERE email=? AND is_active=1", (email,))
            staff = c.fetchone()
            if not staff or staff['password_hash'] != pw_hash:
                self.send_json({'success': False, 'error': 'Invalid credentials'}, 401)
                conn.close()
                return
            c.execute("SELECT id, role FROM users WHERE email=?", (email,))
            user = c.fetchone()
            role = user['role'] if user else 'staff'
            token = encode_jwt({'user_id': user['id'] if user else 1, 'email': email, 'role': role, 'permissions': json.loads(staff['permissions'] or '[]')})
            self.send_json({'success': True, 'data': {'token': token, 'user': {'id': 1, 'name': staff['name'], 'email': email, 'role': role, 'permissions': json.loads(staff['permissions'] or '[]')}}})
            conn.close()
            return

        # All other admin endpoints require auth
        auth = self.require_admin()
        if not auth:
            conn.close()
            return

        # Stats
        if path == '/admin/api_stats.php' and method == 'GET':
            c.execute("SELECT COUNT(*) FROM users WHERE role='seller'")
            sellers = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM users WHERE role='buyer'")
            buyers = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM products WHERE status='active'")
            products = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM orders")
            orders = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM orders WHERE status='disputed'")
            disputes = c.fetchone()[0]
            c.execute("SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status IN ('confirmed', 'completed')")
            revenue = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM admin_staff")
            staff = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM users WHERE is_banned=1")
            banned = c.fetchone()[0]
            c.execute("SELECT o.id, o.amount, o.status, o.created_at, p.title_en as product_title, buyer.username as buyer_name, seller.username as seller_name FROM orders o LEFT JOIN products p ON o.product_id=p.id LEFT JOIN users buyer ON o.buyer_id=buyer.id LEFT JOIN users seller ON o.seller_id=seller.id ORDER BY o.created_at DESC LIMIT 10")
            recent = [dict(r) for r in c.fetchall()]
            c.execute("SELECT status, COUNT(*) as count FROM orders GROUP BY status")
            dist = {r['status']: r['count'] for r in c.fetchall()}
            self.send_json({'success': True, 'data': {
                'sellers': sellers, 'buyers': buyers, 'products': products, 'orders': orders,
                'disputes': disputes, 'total_revenue': revenue, 'staff': staff, 'banned_users': banned,
                'recent_orders': recent, 'order_status_dist': dist
            }})
            conn.close()
            return

        # Users
        if path == '/admin/api_users.php':
            if method == 'GET':
                c.execute("SELECT id, full_name, username, email, phone, role, is_verified, is_banned, seller_id, rating, total_sales, total_purchases, location, created_at FROM users ORDER BY created_at DESC")
                users = [dict(r) for r in c.fetchall()]
                self.send_json({'success': True, 'data': users})
            elif method == 'PUT':
                uid = params.get('id', [''])[0]
                if 'is_banned' in body:
                    c.execute("UPDATE users SET is_banned=? WHERE id=?", (1 if body['is_banned'] else 0, uid))
                if 'is_verified' in body:
                    c.execute("UPDATE users SET is_verified=? WHERE id=?", (1 if body['is_verified'] else 0, uid))
                if 'role' in body and auth.get('role') == 'super_admin':
                    c.execute("UPDATE users SET role=? WHERE id=?", (body['role'], uid))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': uid}, 'message': 'User updated'})
            elif method == 'DELETE':
                uid = params.get('id', [''])[0]
                c.execute("DELETE FROM users WHERE id=?", (uid,))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': uid}, 'message': 'User deleted'})
            conn.close()
            return

        # Staff
        if path == '/admin/api_staff.php':
            if method == 'GET':
                c.execute("SELECT id, user_id, name, email, permissions, is_active, created_at FROM admin_staff ORDER BY created_at DESC")
                staff = [dict(r) for r in c.fetchall()]
                self.send_json({'success': True, 'data': staff})
            elif method == 'POST':
                pw_hash = hashlib.sha256(body.get('password', '').encode()).hexdigest()
                c.execute("INSERT INTO admin_staff (user_id, name, email, password_hash, permissions, is_active) VALUES (1, ?, ?, ?, ?, 1)",
                          (body.get('name',''), body.get('email',''), pw_hash, json.dumps(body.get('permissions', []))))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': c.lastrowid}, 'message': 'Staff created'})
            elif method == 'PUT':
                sid = params.get('id', [''])[0]
                if 'is_active' in body:
                    c.execute("UPDATE admin_staff SET is_active=? WHERE id=?", (1 if body['is_active'] else 0, sid))
                if 'permissions' in body:
                    c.execute("UPDATE admin_staff SET permissions=? WHERE id=?", (json.dumps(body['permissions']), sid))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': sid}, 'message': 'Staff updated'})
            elif method == 'DELETE':
                sid = params.get('id', [''])[0]
                c.execute("DELETE FROM admin_staff WHERE id=?", (sid,))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': sid}, 'message': 'Staff removed'})
            conn.close()
            return

        # Products
        if path == '/admin/api_products.php':
            if method == 'GET':
                c.execute("SELECT p.*, u.username as seller_name FROM products p LEFT JOIN users u ON p.seller_id=u.id ORDER BY p.created_at DESC")
                products = [dict(r) for r in c.fetchall()]
                self.send_json({'success': True, 'data': products})
            elif method == 'PUT':
                pid = params.get('id', [''])[0]
                if 'is_pinned' in body:
                    c.execute("UPDATE products SET is_pinned=? WHERE id=?", (1 if body['is_pinned'] else 0, pid))
                if 'status' in body:
                    c.execute("UPDATE products SET status=? WHERE id=?", (body['status'], pid))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': pid}, 'message': 'Product updated'})
            elif method == 'DELETE':
                pid = params.get('id', [''])[0]
                c.execute("DELETE FROM products WHERE id=?", (pid,))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': pid}, 'message': 'Product deleted'})
            conn.close()
            return

        # Orders
        if path == '/admin/api_orders.php':
            scope = params.get('scope', [''])[0]
            if scope == 'disputes':
                c.execute("SELECT o.*, p.title_en as product_title, buyer.username as buyer_name, seller.username as seller_name FROM orders o LEFT JOIN products p ON o.product_id=p.id LEFT JOIN users buyer ON o.buyer_id=buyer.id LEFT JOIN users seller ON o.seller_id=seller.id WHERE o.status='disputed' ORDER BY o.created_at DESC")
                self.send_json({'success': True, 'data': [dict(r) for r in c.fetchall()]})
            elif method == 'GET':
                c.execute("SELECT o.*, p.title_en as product_title, buyer.username as buyer_name, seller.username as seller_name, pm.name as payment_method_name FROM orders o LEFT JOIN products p ON o.product_id=p.id LEFT JOIN users buyer ON o.buyer_id=buyer.id LEFT JOIN users seller ON o.seller_id=seller.id ORDER BY o.created_at DESC")
                self.send_json({'success': True, 'data': [dict(r) for r in c.fetchall()]})
            elif method == 'PUT':
                oid = params.get('id', [''])[0]
                action = body.get('action', '')
                if action == 'resolve_dispute':
                    c.execute("UPDATE orders SET status=? WHERE id=?", (body.get('resolution', 'completed'), oid))
                elif action == 'cancel':
                    c.execute("UPDATE orders SET status='cancelled' WHERE id=?", (oid,))
                elif action == 'confirm':
                    c.execute("UPDATE orders SET status='confirmed' WHERE id=?", (oid,))
                conn.commit()
                self.send_json({'success': True, 'data': {'id': oid}, 'message': 'Order updated'})
            conn.close()
            return

        self.send_json({'success': False, 'error': 'Endpoint not found'}, 404)
        conn.close()

def run_server():
    init_db()
    server = http.server.HTTPServer(('0.0.0.0', PORT), SokchadHandler)
    print(f'🚀 Sokchad Test Server running at http://localhost:{PORT}')
    print(f'📊 Admin Panel: http://localhost:{PORT}/admin')
    print(f'🔑 Login: admin@sokchad.com / admin123')
    print(f'❤️ Health: http://localhost:{PORT}/health.php')
    server.serve_forever()

if __name__ == '__main__':
    run_server()