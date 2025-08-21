feat: implement secure server-side session management with automatic timeout

BREAKING CHANGE: Replaces client-side localStorage TTL with server-enforced HttpOnly cookies

## Security Improvements
- Replace vulnerable client-side TTL with secure server-side sessions
- Add middleware protection for all routes and APIs
- Implement signed HttpOnly cookies with 30-minute idle timeout
- Add automatic session refresh for active users

## New Files Added
- lib/auth/session.ts: Cookie signing/verification utilities
- middleware.ts: Route protection middleware
- app/api/session/status/route.ts: Session validation and refresh endpoint

## Files Modified
- app/api/login/route.ts: Set HttpOnly session cookie on successful login
- app/api/logout/route.ts: Clear session cookie on logout
- components/ClientShell.tsx: Replace localStorage TTL with server session check
- components/LoginForm/login-form.tsx: Remove client-side TTL logic
- components/slidebar/app-sidebar.tsx: Update logout to call API endpoint
- components/BookingForm/booking-form.tsx: Remove TTL expiration check
- README.md: Add setup notes for SESSION_SECRET

## Technical Details
- Session cookie: booking.session (HttpOnly, Secure, SameSite: lax)
- Cookie format: empCode|expiryTimestamp|HMAC-SHA256-signature
- Idle timeout: 30 minutes (sliding, resets on activity)
- Automatic protection: All non-public routes require valid session
- Public routes: /login, /LoginPage, /api/login, /api/session/status, /api/logout

## Environment Variables Required
- SESSION_SECRET: Secret key for cookie signing (fallback to NEXTAUTH_SECRET)

## Migration Notes
- Existing localStorage user data preserved for display purposes
- No changes required to existing API business logic
- All routes automatically protected by middleware
- Session validation happens before page/API execution

## Testing
- Login flow creates secure session cookie
- Navigation triggers automatic session refresh
- Idle timeout redirects to login after 30 minutes
- Logout properly clears session
- Postman/curl requests blocked without valid session

This change significantly improves security by moving authentication control
from client to server, preventing session manipulation and unauthorized access.
