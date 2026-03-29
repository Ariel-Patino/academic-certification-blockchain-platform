# Certificación Académica Digital con Blockchain — TFM

## Descripción

Sistema web para la emisión, verificación, revocación y trazabilidad de títulos académicos sobre blockchain. El proyecto integra un smart contract en Polygon Amoy con una API REST y una interfaz web institucional, permitiendo a emisores autorizados emitir certificados académicos con respaldo criptográfico verificable.

Cada certificado queda representado como un NFT (ERC-721), con su código de verificación anclado en la red, y puede ser validado de forma pública por cualquier persona sin necesidad de intermediarios. La revocación también se realiza directamente sobre el contrato, dejando trazabilidad permanente del motivo.

El sistema está diseñado para demostrar que la tecnología blockchain puede resolver de manera práctica los problemas de autenticidad y fraude documental en el sector educativo.

## Problema que Resuelve

Los títulos académicos en papel o en formato digital tradicional son susceptibles a falsificación, alteración y pérdida. Las instituciones educativas carecen de mecanismos públicos, descentralizados y automáticamente verificables para acreditar la autenticidad de sus emisiones.

Este proyecto aborda ese problema mediante el registro inmutable de credenciales académicas en blockchain. Cualquier institución que opere como emisor autorizado puede emitir un título que quede anclado en la red, asignando un código de verificación único. Cualquier persona con ese código puede validar la autenticidad del título, su estado de vigencia y el emisor responsable, sin depender de la institución ni de ningún intermediario centralizado.

## Tecnologías Utilizadas

- Blockchain: Polygon Amoy Testnet (chainId 80002)
- Smart Contracts: Solidity + OpenZeppelin ERC-721
- Herramientas de contrato: Truffle, Hardhat
- Backend: Node.js, Express, TypeScript
- Frontend: Next.js 15, React 19, TypeScript
- Base de datos: MongoDB
- Autenticación: Sign-In with Ethereum (EIP-4361) + JWT
- Librerías: ethers.js, Mongoose, Lucide React, jsPDF

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND                           │
│  Next.js 15 · React 19 · TypeScript                 │
│  /issue · /batch · /verify · /revoke · /certificates│
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / REST
┌──────────────────────▼──────────────────────────────┐
│                   BACKEND API                        │
│  Express · TypeScript · JWT + SIWE                  │
│  POST /api/certificates  GET /api/verify            │
│  POST /api/verify/document  POST /api/auth/*        │
└──────┬────────────────────────┬───────────────────── ┘
       │ ethers.js              │ Mongoose
┌──────▼──────────┐    ┌────────▼────────┐
│ Smart Contract  │    │    MongoDB       │
│ AcademicCert.   │    │ Certificados +  │
│ ERC-721 (Amoy)  │    │ Metadatos       │
└─────────────────┘    └──────────────────┘
```

Ver diagrama completo: [docs/diagramas.md](docs/diagramas.md) · [docs/diagramas-ilustrados.md](docs/diagramas-ilustrados.md)

## Instalación y Configuración

### Quick Start

```bash
# 1) Instalar dependencias
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install

# 2) Configurar variables de entorno
cd ../contracts && cp .env.example .env
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local

# 3) Compilar contratos
cd ../contracts && npm run compile

# 4) Levantar MongoDB
docker run -d --name tfm-mongo -p 27017:27017 mongo:7

# 5) Levantar backend y frontend
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

### Requisitos Previos

- Node.js v18+
- npm
- MetaMask instalado en el navegador
- Docker (para levantar MongoDB local, opcional)
- Acceso a un nodo RPC de Polygon Amoy (Alchemy, Infura o similar)

### Instalación de Dependencias

```bash
# Smart contracts
cd contracts
npm install

# Backend
cd ../backend
npm install

# Frontend
cd ../frontend
npm install
```

### Compilar Smart Contracts

```bash
cd contracts
npx truffle compile
```

### Configuración

1. Copiar archivos de entorno de ejemplo:

```bash
cd contracts && cp .env.example .env
cd ../backend && cp .env.example .env
cd ../frontend && cp .env.local.example .env.local
```

2. Configurar variables principales en `backend/.env`:

```env
PORT=3001
RPC_URL=<amoy-rpc-url>
PRIVATE_KEY=<issuer-private-key>
CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
CHAIN_ID=80002
JWT_SECRET=<secreto-seguro>
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
FRONTEND_BASE_URL=http://localhost:3000
```

3. Configurar `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2
```

4. Levantar MongoDB en local con Docker:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7
```

> Nota de seguridad: los valores anteriores son de ejemplo. No publicar claves privadas, tokens ni credenciales reales en el repositorio.

### Ejecución

Modo desarrollo:

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Modo build local:

Backend:

```bash
cd backend
npm run build
npm start
```

Frontend:

```bash
cd frontend
npm run build
npm start
```

URLs de acceso:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

### Problemas Comunes

Si encuentras errores de puerto ocupado, red de MetaMask incorrecta, variables faltantes o conexion RPC/MongoDB, revisa la guia de troubleshooting:

- [Troubleshooting y operación local](docs/troubleshooting-operacion-local.md)

## Smart Contracts Desplegados

- Red: Polygon Amoy Testnet
- Contrato Principal: `0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2`
- Explorador: [PolygonScan Amoy](https://amoy.polygonscan.com/address/0x481f2CA6a085abaE778450fC2fAF0e78b0a29CB2)

Esta dirección corresponde al contrato vigente para demos del TFM en Polygon Amoy.

## Casos de Uso

1. Registro de emisor autorizado por el administrador del contrato.
2. Emisión de título académico individual con código de verificación único.
3. Emisión de lote de títulos mediante carga de CSV.
4. Verificación pública de autenticidad y estado por código o por archivo.
5. Revocación de certificado por emisor autorizado directo sobre el contrato.
6. Consulta del historial de emisiones con paginación configurable.

## Capturas de Pantalla

[Ver carpeta /screenshots](./screenshots)

## Documentación

- [Arquitectura del sistema](docs/arquitectura.md)
- [Manual de usuario](docs/manual-usuario.md)
- [Manual técnico](docs/manual-tecnico-flujo-datos-amoy.md)
- [API REST](docs/api-rest.md)
- [Troubleshooting y operación local](docs/troubleshooting-operacion-local.md)
- [Diagramas funcionales](docs/diagramas.md)
- [Diagramas ilustrados](docs/diagramas-ilustrados.md)
- [Diagramas estructurales del certificado](docs/certificate-model-diagrams.md)

## Diagramas Técnicos

- [Diagrama de flujos funcionales](docs/diagramas.md)
- [Diagramas ilustrados con actores y entidades](docs/diagramas-ilustrados.md)

## Video Demostración

[Ver video de demostración](https://www.loom.com/share/c1e399762132497cafc34e2972f0aad1)

## Innovaciones Implementadas

- Representación de certificados como NFT (ERC-721) sobre Polygon Amoy.
- Verificación pública sin intermediarios por código o por archivo de credencial.
- Revocación no-custodia: el emisor firma directamente sobre el contrato sin intermediario backend.
- Emisión individual y por lote vía CSV con procesamiento registro a registro.
- Historial de certificados con paginación configurable (10, 25, 50, 100 elementos).
- Autenticación con Sign-In with Ethereum (EIP-4361) + JWT.
- Interfaz institucional con lenguaje adaptado para entorno universitario.

## Pruebas y Cobertura

```bash
# Unit tests backend
cd backend && npm test

# Unit tests frontend
cd frontend && npm test

# Cobertura backend
cd backend && npm run test:coverage

# Cobertura frontend
cd frontend && npm run test:coverage

# Cobertura contratos
cd contracts && npm run hh:coverage
```

## Autor

- **Nombre:** Ariel Patiño Flores
- **Email:** ariel.patino.f@gmail.com
- **LinkedIn:** [LinkedIn](https://www.linkedin.com/in/ariel-patino/)

## Licencia

MIT License. Ver [LICENSE](LICENSE).
