# Verification Guide - Backend Authentication

Quick guide to verify all authentication features are working correctly.

---

## Prerequisites

1. **Database is running**
   ```bash
   # Check PostgreSQL is running
   psql -U postgres -c "SELECT version();"
   ```

2. **Environment variables are set**
   ```bash
   # Check JWT_SECRET exists
   cd /Users/tomzohar/projects/stocks-researcher/backend
   grep JWT_SECRET .env
   ```

   If not set, add:
   ```env
   JWT_SECRET=$(openssl rand -base64 32)
   JWT_EXPIRATION=7d
   ```

---

## Quick Verification (Automated)

### Run All Tests
```bash
cd /Users/tomzohar/projects/stocks-researcher/backend

# Run unit tests
npm test

# Run E2E tests (requires database)
npm run test:e2e
```

**Expected Result**: All tests pass ✅

---

## Manual Verification (with running server)

### Step 1: Start the Server
```bash
cd /Users/tomzohar/projects/stocks-researcher/backend
npm run start:dev
```

Server should start on `http://localhost:3000`

---

### Step 2: Test Signup (Returns JWT)

```bash
# Create a new user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify@example.com",
    "password": "TestPass123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "verify@example.com"
  }
}
```

✅ **Verify**: Token is present and user object returned

**Save the token for next steps:**
```bash
export TOKEN="paste-token-here"
```

---

### Step 3: Test Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify@example.com",
    "password": "TestPass123"
  }'
```

**Expected**: Same response format as signup

✅ **Verify**: Can login with created credentials

---

### Step 4: Test Wrong Password

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verify@example.com",
    "password": "WrongPassword"
  }'
```

**Expected Response:**
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

✅ **Verify**: Returns 401 for wrong password

---

### Step 5: Test Token Verification

```bash
curl -X POST http://localhost:3000/auth/verify \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}"
```

**Expected**: Returns user data and token

✅ **Verify**: Token is valid and returns user

---

### Step 6: Test Protected Endpoint (GET /auth/me)

```bash
# Without token (should fail)
curl -X GET http://localhost:3000/auth/me

# Expected: 401 Unauthorized

# With valid token (should succeed)
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "email": "verify@example.com"
}
```

✅ **Verify**: 
- Without token: 401
- With token: Returns user data

---

### Step 7: Test Portfolio Creation (Protected)

```bash
# Without token (should fail)
curl -X POST http://localhost:3000/portfolios \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Portfolio"}'

# Expected: 401 Unauthorized

# With valid token (should succeed)
curl -X POST http://localhost:3000/portfolios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Portfolio"}'
```

**Expected Response:**
```json
{
  "id": "portfolio-uuid",
  "name": "Test Portfolio",
  "assets": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

✅ **Verify**:
- Without token: 401
- With token: Portfolio created

**Save portfolio ID:**
```bash
export PORTFOLIO_ID="paste-portfolio-id-here"
```

---

### Step 8: Test Get User's Portfolios

```bash
curl -X GET http://localhost:3000/portfolios \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": "portfolio-uuid",
    "name": "Test Portfolio",
    "assets": []
  }
]
```

✅ **Verify**: Returns only user's portfolios

---

### Step 9: Test Add Asset to Portfolio

```bash
curl -X POST "http://localhost:3000/portfolios/$PORTFOLIO_ID/assets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ticker": "AAPL",
    "quantity": 10,
    "avgPrice": 150.50
  }'
```

**Expected Response:**
```json
{
  "id": "asset-uuid",
  "ticker": "AAPL",
  "quantity": 10,
  "avgPrice": 150.5
}
```

✅ **Verify**: Asset added to portfolio

---

### Step 10: Test Ownership Verification

```bash
# Create a second user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@example.com",
    "password": "TestPass123"
  }'

# Save the second user's token
export TOKEN2="paste-second-user-token-here"

# Try to access first user's portfolio with second user's token
curl -X GET "http://localhost:3000/portfolios/$PORTFOLIO_ID" \
  -H "Authorization: Bearer $TOKEN2"
```

**Expected Response:**
```json
{
  "statusCode": 403,
  "message": "Access denied to this portfolio",
  "error": "Forbidden"
}
```

✅ **Verify**: Returns 403 (Forbidden) - users can't access each other's data

---

### Step 11: Test Rate Limiting (Login)

```bash
# Try to login 6 times rapidly
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "verify@example.com",
      "password": "WrongPassword"
    }' \
    -w "\nStatus: %{http_code}\n\n"
done
```

**Expected**: 
- First 5 attempts: 401 (Unauthorized - wrong password)
- 6th attempt: 429 (Too Many Requests - rate limited)

✅ **Verify**: Rate limiting is working

---

### Step 12: Test Rate Limiting (Signup)

```bash
# Try to signup 4 times rapidly
for i in {1..4}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3000/users \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"ratelimit$i@example.com\",
      \"password\": \"TestPass123\"
    }" \
    -w "\nStatus: %{http_code}\n\n"
done
```

**Expected**:
- First 3 attempts: 201 (Created)
- 4th attempt: 429 (Too Many Requests)

✅ **Verify**: Signup rate limiting is working

---

## Verification Checklist

Use this checklist to verify all features:

### Authentication
- [ ] User can signup and receive JWT
- [ ] User can login with correct credentials
- [ ] Login fails with wrong password
- [ ] Login fails with non-existent email
- [ ] Token can be verified
- [ ] Invalid tokens are rejected

### Protected Routes
- [ ] `/auth/me` requires authentication
- [ ] `/portfolios` requires authentication
- [ ] Portfolio creation requires authentication
- [ ] Invalid tokens return 401

### Authorization (Ownership)
- [ ] User can see only their own portfolios
- [ ] User cannot access another user's portfolio
- [ ] Attempting to access others' data returns 403
- [ ] User can add assets to their own portfolio
- [ ] User cannot add assets to others' portfolios

### Rate Limiting
- [ ] Login is limited to 5 attempts per minute
- [ ] Signup is limited to 3 attempts per minute
- [ ] 6th login attempt returns 429
- [ ] 4th signup attempt returns 429
- [ ] Rate limits reset after 60 seconds

### Data Integrity
- [ ] Passwords are never returned in responses
- [ ] User IDs come from JWT, not request body
- [ ] Portfolio filtering happens at database level
- [ ] JWT payload includes user ID and email only

---

## Troubleshooting

### Issue: "JWT_SECRET is not defined"
**Solution**: Add JWT_SECRET to `.env` file
```bash
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
```

### Issue: Tests fail with database connection error
**Solution**: Ensure PostgreSQL is running and credentials in `.env` are correct

### Issue: Rate limit persists after waiting
**Solution**: Restart the server to reset rate limits (or wait full 60 seconds)

### Issue: 401 on protected routes with valid token
**Solution**: Check token format in Authorization header: `Bearer <token>`

### Issue: Can't access portfolio with valid token
**Solution**: Verify the portfolio belongs to the authenticated user

---

## Success Criteria

All features working if:
✅ All automated tests pass  
✅ All manual verification steps succeed  
✅ All checklist items are checked  
✅ No security vulnerabilities found  

---

## Next Steps After Verification

1. **Configure for production**
   - Set strong JWT_SECRET
   - Configure CORS
   - Set up HTTPS
   - Enable production logging

2. **Integrate with frontend**
   - Update frontend API service
   - Test complete user flows
   - Verify token storage and refresh

3. **Monitor in production**
   - Track 429 responses (rate limiting)
   - Monitor 403 responses (authorization failures)
   - Track login failures
   - Set up security alerts

---

**Last Updated**: December 2, 2024  
**Status**: Ready for Verification ✅

