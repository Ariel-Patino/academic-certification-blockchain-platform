# Arquitectura del Sistema

Fecha de actualización: 29 de marzo de 2026

## Visión general

El proyecto está organizado en tres capas principales:

1. Contratos inteligentes (Solidity).
2. Backend API (Node.js/Express/TypeScript).
3. Frontend web (Next.js/React/TypeScript).

## Capa de contratos

- Contrato principal: AcademicCertification.
- Base NFT: ERC-721 mediante OpenZeppelin.
- Funciones clave: gestión de emisor, emisión, verificación y revocación.

## Capa backend

Responsabilidades:

- Exponer endpoints REST.
- Aplicar validaciones de dominio.
- Integrar persistencia MongoDB.
- Orquestar llamadas al contrato vía ethers.
- Gestionar autenticación del emisor.

Módulos relevantes:

- controllers
- services
- models
- routes
- middlewares

## Capa frontend

Responsabilidades:

- Capturar datos de emisión.
- Mostrar resultados de verificación.
- Gestionar revocación por interfaz.
- Mostrar historial de certificados con paginación.

Rutas principales:

- /
- /issue
- /batch
- /verify
- /revoke
- /certificates

## Flujo resumido

1. Emisor autentica su sesión.
2. Emite certificado.
3. Backend registra y persiste evidencia.
4. Contrato refleja estado on-chain.
5. Usuario verifica por código o documento.
6. En caso requerido, emisor revoca.
