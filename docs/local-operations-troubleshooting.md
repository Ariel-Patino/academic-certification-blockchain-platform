# Troubleshooting and Local Operations

Last updated: March 29, 2026

This document summarizes frequent operational issues when working locally with contracts, backend, and frontend.

## 1. Recommended startup sequence

Suggested order:

1. Start MongoDB.
2. Compile contracts.
3. Start backend.
4. Start frontend.

Common commands:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7

cd contracts && npm install && npm run compile
cd ../backend && npm install && npm run dev
cd ../frontend && npm install && npm run dev
```

## 2. Backend does not start due to port in use

Typical symptom:

```text
Error: listen EADDRINUSE: address already in use :::3001
```

Cause:

- another Node process is already listening on port 3001

Diagnosis:

```bash
lsof -i :3001 -P -n
```

Solution:

```bash
kill -TERM <PID>
```

Alternative:

- change `PORT` in `backend/.env`

## 3. Frontend cannot find the API

Common symptoms:

- fetch errors
- screens without data
- empty history despite backend running

Check:

- `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
- backend actually running at `http://localhost:3001/health`

Expected local value:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 4. MetaMask connected but wrong network

Typical symptom:

- does not allow revocation
- does not allow issuer operations
- banner indicating wrong network

Expected network:

- Polygon Amoy
- chainId `80002`

Check in frontend:

- `NEXT_PUBLIC_AMOY_RPC_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`

## 5. Contract compilation error due to solc version

Typical symptom:

```text
Truffle is currently using solc 0.8.20, but one or more of your contracts specify pragma solidity ^0.8.21
```

Solution:

- align the `solc` version in `contracts/truffle-config.js` with contract pragmas

Expected current state:

- Truffle compiling with `0.8.21`

## 6. Blockchain listener shows back-fill errors

Typical symptom:

```text
Back-fill failed (non-fatal): eth_getLogs requests with up to a 10 block range
```

Cause:

- limit of the RPC provider free plan when querying many blocks with `eth_getLogs`

Impact:

- usually does not bring down the backend
- server can remain operational even if historical back-fill fails

Options:

- use a provider with broader limits
- implement chunked queries to harden the listener

## 7. Client verification fails due to missing contract address

Typical symptom:

- errors in file or hash verification on client side
- revocation blocked from frontend

Common cause:

- missing `NEXT_PUBLIC_CONTRACT_ADDRESS`

Expected value:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

## 8. MongoDB does not respond

Common symptoms:

- backend does not finish starting
- persistence, history, or off-chain synchronization fail

Verify:

```bash
docker ps
```

Correct backend variables:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
ALERT_WEBHOOK_URL=
```

Note:

- valid names are `MONGO_URI` and `MONGO_DATABASE_NAME`

## 9. Build or coverage was deleted and something stopped working

This is normal if artifacts have not yet been regenerated.

Regeneration by module:

```bash
cd contracts && npm run compile
cd backend && npm run build
cd frontend && npm run build
```

Notes:

- `npm install` only installs dependencies
- it does not regenerate `build`, `dist`, or coverage reports by itself

## 10. Backend in development and production do not start the same way

Important difference:

- development: `npm run dev`
- local production: `npm run build && npm start`

If you run `npm start` without a previous `build`, `dist/server.js` will be missing.

## 11. Recommended quick validations

Backend:

```bash
cd backend
npm run build
npm test
```

Frontend:

```bash
cd frontend
npm run build
npm test
```

Contratos:

```bash
cd contracts
npm run compile
npm run test
```

Backend health:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/architecture
```

## 12. Minimum checklist before demo

- MongoDB running.
- Contracts compiled.
- Backend with correct variables.
- Frontend with correct `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CONTRACT_ADDRESS`.
- MetaMask connected to Polygon Amoy.
- Issuer authorized on-chain.
- `/health` endpoint responding.
- `/api/architecture` endpoint without critical failures.