# Technical Manual: Data Flow on Polygon Amoy

## 1. Objective

Provide a technical description of how data moves across frontend, backend, MongoDB, and smart contract components.

## 2. Components

- Frontend: Next.js UI and wallet interactions
- Backend: Express API and business logic
- Blockchain: Polygon Amoy ERC-721 contract
- Database: MongoDB for operational metadata

## 3. Issuance Data Flow

1. Frontend collects certificate payload.
2. Backend validates payload and issuer permissions.
3. Backend signs/sends transaction through configured key/provider.
4. Smart contract mints/records certificate state.
5. Backend stores metadata and transaction references in MongoDB.
6. Frontend receives final response.

## 4. Verification Data Flow

### Verification by code

1. User submits code in frontend.
2. Backend resolves certificate reference.
3. Backend checks chain state (and cache where enabled).
4. Backend returns status (active/revoked), issuer data, and traceability.

### Verification by document

1. User uploads credential/document.
2. Backend extracts verification reference/hash.
3. Backend resolves corresponding certificate and status.
4. Backend returns verification result and evidence.

## 5. Revocation Data Flow

1. Authorized issuer initiates revocation with reason.
2. Backend validates authorization and request format.
3. Backend sends on-chain revocation transaction.
4. Contract persists revocation state.
5. Backend updates metadata and returns response.

## 6. Authentication Flow

1. Backend generates nonce for wallet owner.
2. Frontend requests signature using SIWE message.
3. Backend verifies signature ownership.
4. Backend issues JWT for protected API routes.

## 7. Monitoring and Alerts

- `/health` exposes service availability.
- `/api/architecture/status` provides aggregated status.
- `/api/architecture/stream` streams status updates via SSE.
- Webhook alerts can trigger on degraded/down transitions.

## 8. Environment Dependencies

Backend critical variables:

- `RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `CHAIN_ID`
- `JWT_SECRET`
- `MONGO_URI`
- `MONGO_DATABASE_NAME`

Frontend critical variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AMOY_RPC_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`

## 9. Failure Modes and Recovery

- RPC unavailable: retry with fallback provider, report degraded status.
- MongoDB unavailable: preserve on-chain operations when possible, buffer/retry metadata writes.
- Invalid signatures: reject with clear auth errors.
- Gas/network issues: return transaction failure and retry guidance.

## 10. Operational Recommendations

1. Keep secrets outside repository and rotate when needed.
2. Add CI checks for lint/tests before deployments.
3. Monitor endpoint latency and on-chain confirmation times.
4. Maintain versioned API contracts.
