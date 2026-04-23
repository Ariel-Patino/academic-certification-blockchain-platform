# Troubleshooting and Local Operations

## 1. Ports Already in Use

### Symptoms

- Backend or frontend fails to start.
- Error includes `EADDRINUSE`.

### Actions

1. Check running process for the conflicting port.
2. Stop conflicting process or change configured port.
3. Restart service.

## 2. MongoDB Connection Issues

### Symptoms

- Backend cannot connect to database.
- Connection timeout or authentication errors.

### Actions

1. Ensure MongoDB container/service is running.
2. Validate `MONGO_URI` and `MONGO_DATABASE_NAME`.
3. Check Docker port mapping (`27017:27017`).

## 3. RPC Provider Errors

### Symptoms

- Contract calls fail.
- Timeouts or invalid response from RPC.

### Actions

1. Validate `RPC_URL` value.
2. Check provider quota/limits.
3. Retry with alternative provider endpoint.

## 4. Wrong Wallet Network

### Symptoms

- Transactions fail or are rejected.
- Frontend shows network mismatch.

### Actions

1. Switch MetaMask network to Polygon Amoy.
2. Reconnect wallet session.
3. Retry operation.

## 5. Invalid Signature / Auth Failures

### Symptoms

- SIWE login fails.
- JWT is missing or invalid.

### Actions

1. Request new nonce.
2. Re-sign SIWE payload.
3. Verify backend clock/time drift and JWT secret configuration.

## 6. Smart Contract Address Mismatch

### Symptoms

- Calls return not found/reverted unexpectedly.

### Actions

1. Check `CONTRACT_ADDRESS` in backend/frontend env files.
2. Confirm address corresponds to deployed network.
3. Restart backend/frontend after environment updates.

## 7. Build or Dependency Errors

### Symptoms

- `npm install` or build scripts fail.

### Actions

1. Verify Node.js version (v18+).
2. Remove lockfile/node_modules only if needed.
3. Reinstall dependencies in each subproject (`contracts`, `backend`, `frontend`).

## 8. Local Startup Checklist

1. Install dependencies in all modules.
2. Configure `.env` files.
3. Compile contracts.
4. Start MongoDB.
5. Start backend.
6. Start frontend.

## 9. Useful Commands

```bash
# Contracts
cd contracts && npm run compile

# Backend dev
cd backend && npm run dev

# Frontend dev
cd frontend && npm run dev

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```
