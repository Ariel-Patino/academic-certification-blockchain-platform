# Academic Certification Blockchain Platform

## Description

This project is a web platform for issuing, verifying, revoking, and tracking academic certificates on blockchain.
It combines an ERC-721 smart contract on Polygon Amoy, a REST API, and a web interface focused on institutional use.

Each certificate is represented as an NFT with a unique verification code anchored on-chain.
Anyone with that code can validate certificate authenticity and status publicly, without intermediaries.

## Problem Statement

Traditional academic credentials (paper or regular digital files) are vulnerable to fraud, tampering, and loss.
Institutions often lack a public, decentralized, and automatically verifiable mechanism to prove authenticity.

This platform addresses that gap by anchoring credentials on blockchain and exposing a verification workflow for third parties.

## Technology Stack

- Blockchain: Polygon Amoy Testnet (chainId 80002)
- Smart Contracts: Solidity + OpenZeppelin ERC-721
- Contract Tooling: Truffle, Hardhat
- Backend: Node.js, Express, TypeScript
- Frontend: Next.js 15, React 19, TypeScript
- Database: MongoDB
- Authentication: Sign-In with Ethereum (EIP-4361) + JWT
- Libraries: ethers.js, Mongoose, Lucide React, jsPDF

## High-Level Architecture

```text
Frontend (Next.js) -> Backend API (Express) -> Smart Contract (Polygon Amoy)
                                 \-> MongoDB (metadata, history, cache)
```

See detailed diagrams in:
- [docs/functional-diagrams.md](docs/functional-diagrams.md)
- [docs/illustrated-diagrams.md](docs/illustrated-diagrams.md)

## Installation and Setup

### Quick Start

```bash
# 1) Install dependencies
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install

# 2) Create environment files
cd ../contracts && cp .env.example .env
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local

# 3) Compile contracts
cd ../contracts && npm run compile

# 4) Start MongoDB locally
docker run -d --name tfm-mongo -p 27017:27017 mongo:7

# 5) Run backend and frontend
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

### Requirements

- Node.js v18+
- npm
- MetaMask browser extension
- Docker (optional, for local MongoDB)
- Access to a Polygon Amoy RPC provider (Alchemy, Infura, or equivalent)

### Main Environment Variables

Backend `.env`:

```env
PORT=3001
RPC_URL=<amoy-rpc-url>
PRIVATE_KEY=<issuer-private-key>
CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
CHAIN_ID=80002
JWT_SECRET=<secure-secret>
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
FRONTEND_BASE_URL=http://localhost:3000
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
```

## Run Modes

Development:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Production build:

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm start
```

Access URLs:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

## Deployed Contract

- Network: Polygon Amoy Testnet
- Main Contract: 0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
- Explorer: https://amoy.polygonscan.com/address/0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2

## Main Use Cases

1. Register authorized issuers.
2. Issue individual certificates.
3. Issue certificate batches via CSV.
4. Verify certificate authenticity and status (code or file).
5. Revoke certificates from authorized issuers.
6. Review issuance history with pagination.

## Documentation

- [System architecture](docs/system-architecture.md)
- [User manual](docs/user-manual.md)
- [Technical manual](docs/amoy-data-flow-technical-manual.md)
- [REST API](docs/api-rest.md)
- [Troubleshooting](docs/local-operations-troubleshooting.md)
- [Functional diagrams](docs/functional-diagrams.md)
- [Illustrated diagrams](docs/illustrated-diagrams.md)
- [Certificate model diagrams](docs/certificate-model-diagrams.md)

## Demo Video

https://www.loom.com/share/c1e399762132497cafc34e2972f0aad1

## Testing and Coverage

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Backend coverage
cd backend && npm run test:coverage

# Frontend coverage
cd frontend && npm run test:coverage

# Contract coverage
cd contracts && npm run hh:coverage
```

## Author

- Name: Ariel Patino Flores
- Email: ariel.patino.f@gmail.com
- LinkedIn: https://www.linkedin.com/in/ariel-patino/

## License

MIT License. See [LICENSE](LICENSE).
