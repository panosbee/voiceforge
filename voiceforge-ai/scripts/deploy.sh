#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# VoiceForge AI — Production Deployment Script
# DigitalOcean Droplet: Ubuntu 22.04+ / 4GB RAM / 2 vCPU
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Color Output ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${BLUE}═══ $1 ═══${NC}"; }

# ── Pre-flight Checks ──────────────────────────────────────────────

log_step "Pre-flight Checks"

if [ ! -f ".env.production" ]; then
  log_error ".env.production not found!"
  log_info "Copy .env.production.template to .env.production and fill in values."
  exit 1
fi

# Source env for variable checks
set -a
source .env.production
set +a

# Verify critical vars
required_vars=(
  "ENCRYPTION_KEY"
  "SUPABASE_JWT_SECRET"
  "TELNYX_API_KEY"
  "ELEVENLABS_API_KEY"
  "POSTGRES_PASSWORD"
  "REDIS_PASSWORD"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_error "Missing required variable: $var"
    exit 1
  fi
done

log_info "All required environment variables are set ✓"

# ── Step 1: System Dependencies ───────────────────────────────────

log_step "Step 1: System Dependencies"

if ! command -v docker &> /dev/null; then
  log_info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker $USER
  log_info "Docker installed ✓"
else
  log_info "Docker already installed ✓"
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
  log_info "Installing Docker Compose v2..."
  sudo apt-get update && sudo apt-get install -y docker-compose-plugin
  log_info "Docker Compose installed ✓"
else
  log_info "Docker Compose already installed ✓"
fi

# ── Step 2: Create Required Directories ───────────────────────────

log_step "Step 2: Creating Directories"

mkdir -p docker/certbot/conf
mkdir -p docker/certbot/www
mkdir -p /var/log/voiceforge

log_info "Directories created ✓"

# ── Step 3: SSL Certificate (Let's Encrypt) ──────────────────────

log_step "Step 3: SSL Certificate"

DOMAIN="${FRONTEND_URL#https://}"
DOMAIN="${DOMAIN#http://}"

if [ ! -f "docker/certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
  log_info "Obtaining SSL certificate for $DOMAIN..."

  # Start nginx temporarily for ACME challenge
  # First, create a temporary nginx config without SSL
  cat > docker/nginx/conf.d/default.conf.tmp << EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'VoiceForge AI - SSL setup in progress';
    }
}
EOF

  # Backup and swap nginx config
  mv docker/nginx/conf.d/default.conf docker/nginx/conf.d/default.conf.bak
  mv docker/nginx/conf.d/default.conf.tmp docker/nginx/conf.d/default.conf

  docker compose -f docker-compose.production.yml up -d nginx

  # Request certificate
  docker compose -f docker-compose.production.yml run --rm certbot \
    certonly --webroot --webroot-path=/var/www/certbot \
    --email "admin@$DOMAIN" --agree-tos --no-eff-email \
    -d "$DOMAIN"

  docker compose -f docker-compose.production.yml down

  # Restore full nginx config
  mv docker/nginx/conf.d/default.conf.bak docker/nginx/conf.d/default.conf

  # Replace YOUR_DOMAIN placeholder in nginx config
  sed -i "s/YOUR_DOMAIN/$DOMAIN/g" docker/nginx/conf.d/default.conf

  log_info "SSL certificate obtained ✓"
else
  log_info "SSL certificate already exists ✓"
fi

# ── Step 4: Build & Deploy ────────────────────────────────────────

log_step "Step 4: Building Docker Images"

docker compose -f docker-compose.production.yml build --no-cache

log_info "Docker images built ✓"

# ── Step 5: Database Migration ────────────────────────────────────

log_step "Step 5: Database Setup"

# Start only postgres first
docker compose -f docker-compose.production.yml up -d postgres redis

log_info "Waiting for database to be ready..."
sleep 10

# Run migrations via the API container
docker compose -f docker-compose.production.yml run --rm api \
  sh -c "cd /app/apps/api && npx drizzle-kit push"

log_info "Database migrations applied ✓"

# ── Step 6: Start All Services ────────────────────────────────────

log_step "Step 6: Starting All Services"

docker compose -f docker-compose.production.yml up -d

log_info "All services started ✓"

# ── Step 7: Health Check ──────────────────────────────────────────

log_step "Step 7: Health Check"

sleep 15

# Check API health
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
  log_info "API server is healthy ✓"
else
  log_warn "API health check failed — checking logs..."
  docker compose -f docker-compose.production.yml logs --tail=20 api
fi

# Check Web health
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  log_info "Web server is healthy ✓"
else
  log_warn "Web health check failed — checking logs..."
  docker compose -f docker-compose.production.yml logs --tail=20 web
fi

# ── Summary ───────────────────────────────────────────────────────

log_step "Deployment Complete! 🚀"

echo ""
log_info "Services running:"
docker compose -f docker-compose.production.yml ps
echo ""
log_info "📊 Dashboard: https://$DOMAIN/dashboard"
log_info "🔧 API:       https://$DOMAIN/health"
log_info "📝 Logs:      docker compose -f docker-compose.production.yml logs -f"
echo ""
log_info "Useful commands:"
log_info "  View logs:    docker compose -f docker-compose.production.yml logs -f api"
log_info "  Restart:      docker compose -f docker-compose.production.yml restart"
log_info "  Stop:         docker compose -f docker-compose.production.yml down"
log_info "  DB Studio:    docker compose -f docker-compose.production.yml exec api npx drizzle-kit studio"
echo ""
