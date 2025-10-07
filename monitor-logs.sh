#!/bin/bash

# Monitor logs for Interpreter Booking application

echo "=== Interpreter Booking - Log Monitor ==="
echo ""
echo "Options:"
echo "1. All logs (press Ctrl+C to stop)"
echo "2. Login API logs only"
echo "3. Error logs only"
echo "4. Last 50 lines"
echo ""
read -p "Choose option (1-4): " option

case $option in
    1)
        echo "Monitoring all logs..."
        docker logs -f interpreter-booking-web
        ;;
    2)
        echo "Monitoring login API logs..."
        docker logs -f interpreter-booking-web 2>&1 | grep --line-buffered "\[/api/login\]"
        ;;
    3)
        echo "Monitoring error logs..."
        docker logs -f interpreter-booking-web 2>&1 | grep --line-buffered -iE "error|fail|exception"
        ;;
    4)
        echo "Last 50 lines:"
        docker logs interpreter-booking-web --tail 50
        ;;
    *)
        echo "Invalid option. Showing last 50 lines:"
        docker logs interpreter-booking-web --tail 50
        ;;
esac
