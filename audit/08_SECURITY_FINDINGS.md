# SECURITY FINDINGS - Authentication & Authorization

## Auth System (js/auth.js)
**Location:** js/auth.js

### Findings:

**SEC-001 - Default Credentials in Code (CRITICAL)**
- Default users with hardcoded passwords are created in initDefaultUser()
- Credentials visible in source: admin/admin123, inspector/inspector123, etc.
- Anyone with access to the source can see credentials
- File: auth.js:73-140

**SEC-002 - Client-Side Only Authentication (CRITICAL)**
- All auth logic is client-side JavaScript
- Session stored in localStorage as plain JSON: {"username":"...", "name":"...", "role":"..."}
- No server-side validation
- Can be bypassed by directly manipulating localStorage
- Anyone can set ht_session to gain any role

**SEC-003 - Plaintext Passwords (HIGH)**
- Passwords stored in plaintext in localStorage (ht_users)
- No hashing/encryption
- Visible in browser dev tools

**SEC-004 - No Session Expiration (MEDIUM)**
- Session has no expiry time
- Persists until explicitly logged out or localStorage cleared
- No token refresh mechanism

**SEC-005 - Role Check is Client-Side Only (CRITICAL)**
- hasRole() only checks localStorage
- equireRole() just calls hasRole()
- No server enforcement
- Pages can be accessed by directly navigating even if role check exists (or if missing)

## SECURITY FINDINGS CONTINUED

**SEC-006 - No Page-Level Authentication Guards (CRITICAL)**
- Most pages do not check if user is logged in
- Users can directly navigate to any .html page without authentication
- Only login.html redirects if already logged in, but other pages don't redirect if NOT logged in
- Example: index.html loads without auth check
- This means the app is completely open if someone knows the URL

**SEC-007 - XSS Vulnerabilities via innerHTML (HIGH)**
- Many pages use innerHTML to render dynamic content
- User input from forms could potentially be injected
- Need to check specific instances

**SEC-008 - localStorage Manipulation (CRITICAL)**
- All data in localStorage can be read/modified via browser dev tools
- Session can be forged: localStorage.setItem('ht_session', JSON.stringify({username:'hacker', role:'Administrator'}))
- Users data can be modified
- No integrity checks

**SEC-009 - Use of innerHTML with Dynamic Data (MEDIUM-HIGH)**
- 39 occurrences of innerHTML across JS files
- Some may use unsanitized data from localStorage/forms
- Potential XSS if malicious data is injected
- Depends on data source - if all data comes from trusted forms, risk is lower but still exists

