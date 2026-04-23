# Certificate Schema

## Overview

This schema defines the standard certificate payload used by the platform services.

## JSON Schema (Conceptual)

```json
{
  "type": "object",
  "required": [
    "studentName",
    "studentId",
    "program",
    "issueDate",
    "issuer",
    "verificationCode"
  ],
  "properties": {
    "studentName": { "type": "string", "minLength": 1 },
    "studentId": { "type": "string", "minLength": 1 },
    "program": { "type": "string", "minLength": 1 },
    "issueDate": { "type": "string", "format": "date" },
    "issuer": { "type": "string", "minLength": 1 },
    "verificationCode": { "type": "string", "minLength": 1 }
  }
}
```

## Validation Rules

- All required fields must be present.
- Date fields must use ISO format where applicable.
- Verification code must be unique for each issued certificate.
