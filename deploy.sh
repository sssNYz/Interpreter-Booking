#!/bin/bash

# Deployment script for Interpreter Booking System

set -e  # Exit on any error

echo "=== Interpreter Booking - Deployment Script ==="
echo ""

# Function to display usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       - Build and start the application"
    echo "  rebuild     - Rebuild from scratch (no cache)"
    echo "  start       - Start the application"
    echo "  stop        - Stop the application"
    echo "  restart     - Restart the application"
    echo "  logs        - Show application logs"
    echo "  status      - Show container status"
    echo ""
    exit 1
}

# Check if command is provided
if [ $# -eq 0 ]; then
    usage
fi

COMMAND=$1

case $COMMAND in
    build)
        echo "Building and starting application..."
        docker-compose -f docker-compose.prod.yml up -d --build
        echo ""
        echo "✅ Application started"
        echo "📊 View logs: docker logs -f interpreter-booking-web"
        echo "🌐 Access at: http://172.31.150.22:3030"
        ;;

    rebuild)
        echo "Rebuilding from scratch (this may take several minutes)..."
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml build --no-cache
        docker-compose -f docker-compose.prod.yml up -d
        echo ""
        echo "✅ Application rebuilt and started"
        echo "📊 View logs: docker logs -f interpreter-booking-web"
        ;;

    start)
        echo "Starting application..."
        docker-compose -f docker-compose.prod.yml up -d
        echo "✅ Application started"
        ;;

    stop)
        echo "Stopping application..."
        docker-compose -f docker-compose.prod.yml down
        echo "✅ Application stopped"
        ;;

    restart)
        echo "Restarting application..."
        docker-compose -f docker-compose.prod.yml restart
        echo "✅ Application restarted"
        ;;

    logs)
        echo "Showing logs (press Ctrl+C to exit)..."
        docker logs -f interpreter-booking-web
        ;;

    status)
        echo "Container status:"
        docker ps -a | grep interpreter-booking || echo "No containers found"
        echo ""
        echo "Latest logs:"
        docker logs interpreter-booking-web --tail 20 2>&1 || echo "Container not running"
        ;;

    *)
        echo "❌ Unknown command: $COMMAND"
        usage
        ;;
esac
