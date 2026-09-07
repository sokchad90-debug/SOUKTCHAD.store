# Sokchad — PHP-FPM + Nginx Docker Image
# Works on any VPS without modification

FROM php:8.2-fpm-alpine

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl

# Create directories
RUN mkdir -p /var/www/html /var/www/uploads /var/log/nginx /run

# Set working directory
WORKDIR /var/www/html

# Copy backend PHP files
COPY backend/ /var/www/html/

# Copy Nginx config
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisor config (run nginx + php-fpm together)
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set permissions
RUN chown -R www-data:www-data /var/www/html /var/www/uploads
RUN chmod -R 755 /var/www/html
RUN chmod -R 775 /var/www/uploads

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost/health.php || exit 1

# Start supervisor (manages nginx + php-fpm)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]