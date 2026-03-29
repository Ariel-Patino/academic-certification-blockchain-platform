# Estado General del Proyecto

Fecha de actualización: 29 de marzo de 2026

## Estado global

- Fase funcional: operativa.
- Emisión, verificación y revocación: implementadas.
- Historial: implementado con paginación configurable.
- Contrato: actualizado con base ERC-721 (NFT).
- Persistencia: MongoDB integrada en backend.

## Componentes

### Frontend

- Next.js 15 + React 19.
- Vistas principales: inicio, emisión individual, emisión por lote, verificación, revocación, historial.
- Historial de certificados con selector de elementos por página: 10, 25, 50, 100.
- Valor por defecto de paginación: 10.

### Backend

- API REST en Express + TypeScript.
- Módulos de autenticación, emisión, verificación, auditoría y revocación.
- Integración blockchain con ethers.

### Contratos

- Contrato AcademicCertification con capacidades de certificado y NFT (ERC-721).
- Soporte de pruebas con Truffle/Hardhat.

## Pruebas y calidad

### Unit tests

Backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm test
```

### Cobertura

Backend (sin E2E):

```bash
cd backend
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm run test:coverage
```

Contratos:

```bash
cd contracts
npm run hh:coverage
```

## Build

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

## Notas operativas

- Para ejecución local con persistencia real, se recomienda levantar MongoDB.
- Para pruebas de contrato en local, usar red de desarrollo y scripts del workspace contracts.
