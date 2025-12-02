# Authentication Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies (Already Done)
```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Edit your `.env` file and add the JWT configuration:

```env
# JWT Authentication (ADD THESE)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_EXPIRATION=7d
```

**Generate a secure secret:**
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start the Backend Server

```bash
npm run start:dev
```

The server will start at `http://localhost:3000`

### 4. Test the Authentication Endpoints

#### Test Login
```bash
# First create a user (if not already done)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Then login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "test@example.com"
  }
}
```

#### Test Token Verification
```bash
curl -X POST http://localhost:3000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE"
  }'
```

#### Test Protected Endpoint
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. View API Documentation

Open your browser and navigate to:
```
http://localhost:3000/api
```

This will show the Swagger UI with all authentication endpoints documented.

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

**Note:** If you encounter Jest issues, try:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🔍 Debugging

### Check if JWT_SECRET is loaded
```typescript
// In any service
console.log('JWT_SECRET exists:', !!this.configService.get('JWT_SECRET'));
```

### Check logs
The authentication service logs all operations:
- User validation attempts
- Login successes/failures
- Token verification
- Authentication guard checks

Look for logs in the console output when running `npm run start:dev`

## 📋 Common Issues

### Issue: "Invalid email or password"
- **Cause:** User doesn't exist or password is incorrect
- **Solution:** Verify user exists in database and password matches

### Issue: "No token provided"
- **Cause:** Missing Authorization header
- **Solution:** Add `Authorization: Bearer <token>` header

### Issue: "Invalid or expired token"
- **Cause:** Token signature invalid or expired
- **Solution:** Login again to get a new token

### Issue: "User not found"
- **Cause:** User was deleted after token was issued
- **Solution:** User needs to login again

## 🔐 Security Checklist

- [x] JWT_SECRET is at least 32 characters
- [x] JWT_SECRET is stored in .env (not hardcoded)
- [x] Passwords are hashed with bcrypt
- [x] Password hashes never returned in API responses
- [x] Token expiration set (7 days)
- [x] User existence verified on every request
- [ ] Rate limiting on auth endpoints (recommended for production)
- [ ] CORS properly configured (update for production)

## 📝 Next Steps

### Phase 2: Token Verification
- Update frontend API service to use real backend endpoints
- Replace mock implementations

### Phase 3: Protected Routes
- Add `@UseGuards(JwtAuthGuard)` to Portfolio controller
- Update PortfolioService to filter by authenticated user
- Test that users can only access their own data

### Phase 4: Signup Integration
- Update UsersController to return JWT after signup
- Test seamless signup → login flow

## 💡 Tips

1. **Token Storage (Frontend)**
   - Store in localStorage: `portfolio_manager_auth_token`
   - Send in Authorization header: `Bearer <token>`

2. **Token Expiration**
   - Default: 7 days
   - Customize via JWT_EXPIRATION env var
   - Format: '7d', '24h', '60m', etc.

3. **Development vs Production**
   - Use different JWT_SECRET for dev/prod
   - Enable HTTPS in production
   - Consider refresh tokens for production

4. **Debugging Authentication Issues**
   - Check server logs for detailed error messages
   - Use jwt.io to decode tokens and verify payload
   - Verify user exists in database
   - Check token hasn't expired

## 📚 Additional Resources

- [NestJS Authentication Docs](https://docs.nestjs.com/security/authentication)
- [JWT.io Token Debugger](https://jwt.io/)
- [bcrypt NPM Package](https://www.npmjs.com/package/bcrypt)

---

**Need Help?**
- Check `PHASE1_IMPLEMENTATION_SUMMARY.md` for detailed implementation docs
- Check `auth_backend.md` for the complete architecture plan

