#!/bin/bash
# ============================================================
# Sokchad — One-Click VPS Deployment Script
# ============================================================
# Works on ANY VPS (Ubuntu, Debian, CentOS, Alpine)
# Only requires: bash + curl
#
# USAGE:
#   curl -sSL <this_script_url> | bash
#   OR:
#   chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

echo "============================================"
echo "  Sokchad — VPS Deployment"
echo "============================================"

# ── Check if Docker is installed ──
if ! command -v docker &> /dev/null; then
    echo "📦 Docker not found. Installing..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "✅ Docker installed."
fi

# ── Check if Docker Compose is available ──
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose plugin not found. Installing..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin 2>/dev/null || {
        # Fallback for older systems
        curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    }
    echo "✅ Docker Compose installed."
fi

# ── Create .env if not exists ──
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env

    # Generate random passwords
    DB_PASS=$(openssl rand -hex 16)
    MYSQL_ROOT_PASS=$(openssl rand -hex 16)
    JWT=$(openssl rand -hex 32)

    sed -i "s/ChangeMe_StrongPassword123!/$DB_PASS/g" .env
    sed -i "s/ChangeMe_RootPassword123!/$MYSQL_ROOT_PASS/g" .env
    sed -i "s/09b1708f2f6b806fcc8688a489a98d9d5679e9b418fab8b849dc749bac499a24/$JWT/g" .env

    echo "✅ .env created with random passwords."
    echo "⚠️  Save these credentials! They are in .env"
fi

# ── Build and start containers ──
echo "🔨 Building and starting containers..."
docker compose up -d --build

# ── Wait for DB to be ready ──
echo "⏳ Waiting for database..."
for i in $(seq 1 30); do
    if docker compose exec -T db mysqladmin ping -h localhost -u root -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) &> /dev/null; then
        echo "✅ Database is ready."
        break
    fi
    sleep 2
    if [ $i -eq 30 ]; then
        echo "❌ Database failed to start. Check: docker compose logs db"
        exit 1
    fi
done

# ── Health check ──
echo "🏥 Running health check..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health.php 2>/dev/null || echo "000")

if [ "$HEALTH" = "200" ]; then
    echo "✅ Health check passed!"
    echo ""
    echo "============================================"
    echo "  🎉 Sokchad API is LIVE!"
    echo "============================================"
    echo ""
    echo "  API URL:  http://$(hostname -I | awk '{print $1}')/"
    echo "  Health:   http://$(hostname -I | awk '{print $1}')/health.php"
    echo "  Admin:    http://$(hostname -I | awk '{print $1}')/admin/"
    echo ""
    echo "  Next steps:"
    echo "    1. Point your domain DNS to this VPS IP"
    echo "    2. Update CORS_ALLOWED_ORIGINS in .env with your domain"
    echo "    3. Set up SSL: use 'certbot --nginx' or Cloudflare"
    echo ""
else
    echo "⚠️  Health check returned: $HEALTH"
    echo "  Check logs: docker compose logs app"
fi

echo ""
echo "📊 Container status:"
docker compose ps