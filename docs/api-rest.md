# REST API Reference

## Base URL

`/api`

Typical local backend URL:

- `http://localhost:3001/api`

## Authentication

The platform uses SIWE (Sign-In with Ethereum) plus JWT.
Protected endpoints require a valid bearer token.

Authorization header format:

`Authorization: Bearer <jwt-token>`

## Health Endpoints

### GET /health

Returns service status and basic availability metadata.

## Authentication Endpoints

### POST /auth/nonce

Generates a nonce to build the SIWE message.

Expected body (example):

```json
{
  "address": "0x..."
}
```

### POST /auth/verify

Validates signed SIWE message and returns JWT.

Expected body (example):

```json
{
  "message": "<siwe-message>",
  "signature": "0x..."
}
```

### POST /auth/logout

Invalidates session/token according to backend policy.

## Certificate Endpoints

### POST /certificates

Issues a single certificate.

Example payload:

```json
{
  "studentName": "Jane Doe",
  "studentId": "STU-001",
  "program": "Computer Science",
  "issueDate": "2026-04-01",
  "issuer": "University Example"
}
```

### POST /certificates/batch

Processes CSV-based batch issuance.

Typical behavior:

- Validates each row
- Emits records one by one
- Reports per-row result

### GET /certificates

Returns paginated issuance history.

Query params (common):

- `page`
- `limit` (10, 25, 50, 100)

### POST /certificates/:id/revoke

Revokes a certificate with a reason.

## Verification Endpoints

### GET /verify

Public verification by code/hash/token reference.

Typical query params:

- `code` or equivalent verification reference

### POST /verify/document

Verification by uploaded file/hash extraction.

## Architecture Monitoring Endpoints

### GET /architecture/status

Returns current aggregated architecture health.

### GET /architecture/stream

SSE endpoint with real-time architecture updates.

## Error Format

Typical error responses use HTTP status codes and JSON payloads:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common statuses:

- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error

## Notes

- Exact payload contracts may evolve; check backend source for latest validation rules.
- Do not expose private keys or sensitive environment variables in requests/logs.
