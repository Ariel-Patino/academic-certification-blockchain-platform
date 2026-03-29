# Manual Tecnico: Flujo de Datos y Operacion

Fecha de actualizacion: 29 de marzo de 2026

## 1. Objetivo

Este documento describe el flujo tecnico de la plataforma de certificacion academica, desde la captura de datos en frontend hasta su registro on-chain y persistencia off-chain. Tambien resume los componentes involucrados, las variables necesarias y los comandos de validacion del sistema.

Complementos recomendados:

- Arquitectura general: ver docs/arquitectura.md
- Flujos funcionales: ver docs/diagramas.md
- Diagramas estructurales del certificado: ver docs/certificate-model-diagrams.md

## 2. Alcance del sistema

El proyecto esta dividido en tres dominios principales:

1. Frontend en Next.js para interfaz de usuario y conexion con billetera.
2. Backend en Express y TypeScript para orquestacion, validaciones, persistencia y autenticacion.
3. Smart contracts en Solidity para emision, verificacion y revocacion on-chain.

Servicios externos relevantes:

- Polygon Amoy como red blockchain de pruebas.
- MongoDB para persistencia operativa.
- IPFS, mediante Pinata, para almacenar el documento JSON del certificado.
- MetaMask para firma de sesion y transacciones desde el cliente.

## 3. Componentes y responsabilidades

### 3.1 Frontend

Responsabilidades principales:

- Capturar datos de emision individual y por lote.
- Gestionar conexion de billetera y sesion del emisor.
- Solicitar verificacion por codigo o por documento.
- Iniciar revocaciones desde la interfaz.
- Consultar historial de certificados emitidos.

Rutas principales:

- /issue
- /batch
- /verify
- /revoke
- /certificates

### 3.2 Backend

Responsabilidades principales:

- Validar reglas de negocio.
- Construir el documento de certificado compatible con Open Badges v2.
- Canonicalizar, hashear y firmar la prueba criptografica.
- Publicar metadata en IPFS.
- Ejecutar operaciones on-chain contra AcademicCertification.
- Persistir evidencias y metadatos en MongoDB.
- Verificar estado, emisor, firma, integridad y vigencia.
- Ejecutar procesos de fondo, como listener de revocaciones y cron de expiracion.

Modulos relevantes:

- config
- controllers
- services
- models
- routes
- middlewares

### 3.3 Contratos

Contrato principal:

- AcademicCertification

Capacidades principales:

- Emision individual de certificados.
- Emision por lote.
- Revocacion de certificados.
- Consulta por hash.
- Consulta por ID.
- Verificacion de autorizacion de emisor.

## 4. Flujo tecnico general

El flujo tecnico base del sistema es el siguiente:

1. El frontend captura informacion del certificado o del lote.
2. El backend recibe la solicitud y normaliza el payload.
3. Se valida la estructura y obligatoriedad de datos.
4. Se construye un documento hash-anchor compatible con Open Badges v2.
5. El backend calcula el certificateHash sobre el documento canonico.
6. El backend firma criptograficamente ese hash.
7. Se genera el documento provisional y se publica en IPFS.
8. El backend registra el certificado en el smart contract.
9. Se persisten referencias operativas en MongoDB.
10. El frontend recibe el resultado y presenta codigo, estado, txHash y enlaces de verificacion.

## 5. Flujo de emision individual

La emision individual se soporta principalmente desde el servicio de certificados del backend.

Resumen tecnico:

1. Se recibe un IssueCertificateInput.
2. Se construye un CertificatePayload normalizado.
3. Se valida `studentName`, `studentId`, `programName` e `institutionName`.
4. Se genera un salt aleatorio para proteger la identidad del destinatario.
5. Se deriva `recipient.identity` mediante SHA-256 sobre `email:salt`.
6. Se construye el bloque `badge`, `recipient`, `verification` y `status`.
7. Se valida el documento provisional con reglas Open Badges v2.
8. Se calcula `certificateHash` y se firma con EIP-191.
9. Se sube el JSON a IPFS.
10. Se llama a `issueCertificate` en el contrato.
11. Se persiste el registro operativo en MongoDB.
12. Se retorna el documento final con `metadataURI`, `transactionHash` y `certificateId`.

Detalles relevantes:

- El hash del email no se almacena como email plano.
- El salt del destinatario queda embebido en el documento entregado al titular.
- En reemisiones, el sistema puede invalidar automaticamente el certificado previo si la operacion secundaria finaliza correctamente.

## 6. Flujo de emision por lote

La emision por lote sigue la misma logica base que la emision individual, pero aplicada a multiples registros cargados desde CSV.

Consideraciones tecnicas:

- El frontend valida y parsea el archivo CSV antes del envio.
- La interfaz muestra una vista previa parcial del contenido.
- Durante el proceso se informa progreso de carga y anclaje.
- Los resultados pueden incluir exitos y errores por registro.

Este flujo comparte reglas de negocio con la emision individual, pero con control de progreso y consolidacion de resultados.

## 7. Flujo de verificacion

El sistema soporta dos variantes tecnicas de verificacion.

### 7.1 Verificacion por codigo

1. El frontend envia el `certificateHash`.
2. El backend valida el formato del hash.
3. Se consulta el estado on-chain con `verifyCertificate`.
4. Si existe, se amplian datos con `getCertificateByHash` y perfil del emisor.
5. Se consulta persistencia en MongoDB para informacion adicional, por ejemplo reemplazos.
6. Se devuelve estado final al cliente.

Posibles estados:

- Valid
- Revoked
- Expired
- Not found

### 7.2 Verificacion por documento

La verificacion por documento combina comprobaciones estructurales, criptograficas y on-chain.

Secuencia tecnica:

1. Se valida que el JSON cumpla Open Badges v2.
2. Se recalcula el hash a partir del payload normalizado.
3. Se verifica la firma del `proof.signatureValue`.
4. Se recupera el signer y se compara con el emisor esperado.
5. Se consulta blockchain para confirmar existencia, estado, issuer y fechas.
6. Se verifica si el emisor sigue autorizado.
7. Se comprueba consistencia temporal entre `issuedOn` y la fecha on-chain.
8. Opcionalmente, se compara el email del usuario con la identidad hasheada del documento.
9. Se devuelve un resultado agregado con `overallValid` y codigos de error semanticos si aplica.

Errores semanticos relevantes:

- SCHEMA_VALIDATION_FAILED
- INTEGRITY_MISMATCH
- AUTHENTICITY_ERROR
- ISSUER_NOT_AUTHORIZED
- TIMESTAMP_MISMATCH
- RECIPIENT_IDENTITY_MISMATCH
- REVOKED
- EXPIRED
- NOT_FOUND

## 8. Flujo de revocacion

La revocacion involucra cliente, contrato y persistencia.

Secuencia tecnica:

1. El frontend exige MetaMask, sesion de emisor y red correcta.
2. El usuario indica `certificateId` y motivo.
3. Se ejecuta la transaccion de revocacion.
4. El contrato emite el evento `CertificateRevoked`.
5. El backend puede consultar o refrescar el estado resultante.
6. El listener de revocaciones sincroniza MongoDB y genera trazabilidad de auditoria.

El backend incluye un listener que:

- realiza back-fill de eventos historicos,
- escucha eventos `CertificateRevoked`,
- actualiza el estado del certificado en base de datos,
- registra eventos de auditoria con bloque y transaccion.

## 9. Persistencia off-chain

MongoDB se utiliza para persistencia operativa y consultas auxiliares.

Datos persistidos de forma habitual:

- `certificateHash`
- `issuerAddress`
- `recipientEmailHash`
- `status`
- `ipfsCID`
- `metadataURI`
- `certificateId`
- `txHash`
- informacion de reemplazo o reemision

La base de datos no sustituye a la blockchain como fuente de verdad final para vigencia o revocacion. Su objetivo es mejorar consulta, trazabilidad y consistencia operativa.

## 10. Modelo de documento emitido

El documento final emitido sigue una estructura Open Badges v2 con bloques como:

- `@context`
- `id`
- `type`
- `issuedOn`
- `badge`
- `verification`
- `recipient`
- `proof`
- `blockchain`
- `status`

Para ver el modelo visual y las relaciones entre prueba, blockchain e IPFS, consulte docs/certificate-model-diagrams.md.

## 11. Variables de entorno relevantes

### 11.1 Backend

Variables obligatorias o de uso principal:

```env
PORT=3001
RPC_URL=https://...
PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
CHAIN_ID=80002
FRONTEND_BASE_URL=http://localhost:3000
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DATABASE_NAME=tfm_certificacion_blockchain
PINATA_JWT=
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_BASE_URL=https://api.pinata.cloud
JWT_SECRET=...
JWT_ISSUER=tfm-certificacion-backend
JWT_AUDIENCE=tfm-certificacion-frontend
JWT_EXPIRES_IN=2h
SIWE_NONCE_TTL_SECONDS=300
```

Notas:

- Los nombres correctos son `MONGO_URI` y `MONGO_DATABASE_NAME`.
- No se deben publicar claves privadas, JWT reales ni credenciales de Pinata en documentacion compartida.

### 11.2 Frontend

Variables tipicas:

```env
NEXT_PUBLIC_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

### 11.3 Contracts

Variables habituales para despliegue o migracion:

```env
RPC_URL=https://...
PRIVATE_KEY=0x...
MNEMONIC=
POLYGONSCAN_API_KEY=
```

## 12. Ejecucion local recomendada

### 12.1 Base de datos MongoDB

Para entorno local, MongoDB puede iniciarse con Docker:

```bash
docker run -d --name tfm-mongo -p 27017:27017 mongo:7
```

### 12.2 Contratos

```bash
cd contracts
npm install
npm run compile
```

### 12.3 Backend

```bash
cd backend
npm install
npm run build
npm run dev
```

### 12.4 Frontend

```bash
cd frontend
npm install
npm run build
npm run dev
```

## 13. Comandos de validacion tecnica

### Build

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

Contracts:

```bash
cd contracts
npm run compile
```

### Tests

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

Contracts:

```bash
cd contracts
npm run test
```

### Cobertura

Backend:

```bash
cd backend
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm run test:coverage
```

Contracts:

```bash
cd contracts
npm run hh:coverage
```

## 14. Riesgos y observaciones operativas

- El listener de revocaciones depende del proveedor RPC y puede verse afectado por limites del plan usado.
- La fuente de verdad del estado del certificado es la blockchain, no MongoDB.
- La emision por lote exige control de errores por registro para evitar inconsistencias masivas.
- La sesion del emisor y la red activa en MetaMask son precondiciones funcionales, no solo de interfaz.
- Las reemisiones pueden requerir revocacion posterior del certificado antiguo si la revocacion automatica no se completa.

## 15. Resumen

La plataforma implementa un modelo hibrido:

- blockchain para estado y evidencia verificable,
- IPFS para distribucion del documento,
- MongoDB para persistencia operativa,
- backend para orquestacion y validacion,
- frontend para captura, verificacion y experiencia de usuario.

Este reparto de responsabilidades permite emitir certificados verificables de forma independiente, mantener trazabilidad operativa y ofrecer una interfaz util para emision, consulta e invalidacion.
