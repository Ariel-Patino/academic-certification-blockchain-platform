# API REST

Fecha de actualizacion: 29 de marzo de 2026

Este documento resume la superficie principal de la API del backend, los requisitos de autenticacion y los endpoints que consume el frontend.

Base URL local:

```text
http://localhost:3001
```

Documentacion interactiva:

```text
http://localhost:3001/api-docs
```

## 1. Convenciones generales

- Formato de intercambio: JSON.
- Health check publico: `GET /health`.
- Los endpoints protegidos usan `Authorization: Bearer <jwt>`.
- El JWT se obtiene mediante autenticacion SIWE.
- La revocacion del certificado es non-custodial desde frontend contra el contrato; el backend sincroniza estado y auditoria.

## 2. Autenticacion

### POST /api/auth/nonce

Solicita un nonce y el mensaje SIWE para que el emisor firme con su billetera.

Ejemplo de request:

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

Respuesta esperada:

- nonce
- mensaje SIWE
- fecha de expiracion del nonce

### POST /api/auth/verify

Verifica la firma SIWE y devuelve el JWT del emisor.

Ejemplo de request:

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "nonce": "3f4e5a...",
  "signature": "0xdeadbeef..."
}
```

Respuesta esperada:

- token JWT
- rol
- direccion del emisor
- tiempo de expiracion

## 3. Salud y arquitectura

### GET /health

Verifica si el backend esta operativo.

### GET /api/architecture

Devuelve un estado agregado de salud para:

- Polygon Amoy
- IPFS
- MongoDB

Uso recomendado:

- diagnostico de entorno local
- validacion previa a demo
- comprobacion de integraciones externas

### GET /api/architecture/stream

Canal de Server-Sent Events (SSE) para paneles y monitoreo en tiempo real.

Comportamiento:

- emite snapshots periódicos del estado global
- publica eventos `architecture`
- incluye `overallStatus` y estado por servicio

Uso recomendado:

- dashboards operativos
- alertas visuales de degradación en frontend

## 4. Emisor

### GET /api/issuer/status

Consulta el estado on-chain del emisor conectado o consultado por la aplicacion.

Devuelve datos como:

- si esta activo o no
- direccion del emisor
- chainId
- direccion del contrato

## 5. Certificados

### GET /api/certificates?issuer=0x...

Lista los certificados emitidos por una direccion de emisor.

Uso principal:

- vista de historial en frontend
- refresco de registros por billetera

### POST /api/certificates

Endpoint protegido para emision individual.

Requiere:

- Bearer token valido
- emisor autorizado on-chain

Payload minimo:

```json
{
  "studentName": "Ada Lovelace",
  "studentId": "A2026-001",
  "recipientEmail": "ada@example.com",
  "programName": "Blockchain Engineering",
  "institutionName": "Universidad TFM"
}
```

Campos opcionales relevantes:

- `badgeDescription`
- `issuerUrl`
- `issuedAt`
- `recipient`
- `certType`
- `expiryDate`
- `certificateId`
- `replacesCertificateHash`

Respuesta tipica:

- documento final emitido
- `certificateHash`
- `verificationUrl`
- `metadataURI`
- datos blockchain como `txHash`, `certificateId`, `chainId` y `contractAddress`

### POST /api/certificates/batch

Endpoint protegido para emision por lote.

Requiere:

- Bearer token valido
- lista de certificados en el body

Payload base:

```json
{
  "certificates": [
    {
      "studentName": "Grace Hopper",
      "studentId": "A2026-002",
      "recipientEmail": "grace@example.com",
      "programName": "Computer Science",
      "institutionName": "Universidad TFM"
    }
  ]
}
```

La respuesta incluye progreso consolidado y resultados por registro.

## 6. Verificacion

### GET /api/verify?certificateHash=0x...

Consulta el estado de un certificado por hash usando query string.

### POST /api/verify

Permite la misma consulta por hash usando body JSON.

Ejemplo:

```json
{
  "certificateHash": "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd"
}
```

El resultado puede incluir:

- existencia on-chain
- vigencia
- estado
- emisor
- destinatario
- fecha de emision
- nombre del emisor
- informacion de reemplazo si existe

### POST /api/verify/document

Verifica un documento JSON completo.

Validaciones combinadas:

- estructura Open Badges v2
- integridad del payload
- firma criptografica
- coincidencia del signer
- estado on-chain
- autorizacion del emisor
- consistencia temporal
- coincidencia opcional de identidad hasheada

Este endpoint es el mas rico semantica y tecnicamente para validacion integral.

## 7. Auditoria

### GET /api/audit-logs

Consulta eventos de auditoria, especialmente utiles para revocaciones y trazabilidad.

Parametros soportados:

- `certificateHash`
- `revokedBy`
- `eventType`
- `fromBlock`
- `toBlock`
- `limit`
- `offset`

Uso recomendado:

- inspeccion historica de revocaciones
- analisis de eventos procesados
- soporte tecnico y auditoria academica

## 8. Autenticacion y permisos

Endpoints protegidos con JWT:

- `POST /api/certificates`
- `POST /api/certificates/batch`

Notas importantes:

- El backend valida que el Bearer token sea valido.
- El backend valida que el emisor siga autorizado on-chain.
- La revocacion no pasa por un endpoint REST de backend.

## 9. Errores habituales de API

## 10. Optimizaciones backend aplicadas

- Verificación por hash con cache TTL en memoria para evitar llamadas redundantes.
- Stream de estado de arquitectura por SSE para notificaciones en tiempo real.
- Alertas automáticas opcionales por webhook mediante `ALERT_WEBHOOK_URL`.

Errores frecuentes:

- `401 UNAUTHORIZED`: falta token o token invalido.
- `403 FORBIDDEN`: emisor no autorizado o certificado emitido por otro emisor.
- `409 REVOKED`: el certificado consultado fue revocado.
- `400`: payload invalido, hash mal formado o documento inconsistente.

Para una descripcion operativa de fallos comunes de entorno, ver `docs/troubleshooting-operacion-local.md`.