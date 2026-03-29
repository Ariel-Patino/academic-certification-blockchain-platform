const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "TFM Certificacion Blockchain API",
      version: "1.0.0",
      description:
        "API para emision, verificacion y trazabilidad de certificados academicos sobre Polygon Amoy e IPFS."
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Local development"
      }
    ],
    tags: [
      { name: "Health", description: "Endpoints de disponibilidad de API y arquitectura" },
      { name: "Auth", description: "Autenticacion SIWE (Sign-In with Ethereum)" },
      { name: "Issuer", description: "Consulta de estado de emisor" },
      {
        name: "Certificates",
        description:
          "Emision de certificados individuales y por lote. Nota: la revocacion es non-custodial y se ejecuta desde frontend contra el contrato."
      },
      { name: "Verification", description: "Verificacion por hash o por documento JSON" },
      { name: "Audit", description: "Consulta de logs de auditoria de eventos" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ApiSuccessEnvelope: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation completed." },
            data: { type: "object" }
          }
        },
        CertificateIssueRequest: {
          type: "object",
          required: ["studentName", "studentId", "recipientEmail", "programName", "institutionName"],
          properties: {
            studentName: { type: "string", example: "Ada Lovelace" },
            studentId: { type: "string", example: "A2026-001" },
            recipientEmail: { type: "string", format: "email", example: "ada@example.com" },
            programName: { type: "string", example: "Blockchain Engineering" },
            institutionName: { type: "string", example: "Universidad TFM" },
            grade: { type: "string", example: "Sobresaliente" },
            expiryDate: { type: "string", format: "date", example: "2028-12-31" },
            replacesCertificateHash: {
              type: "string",
              description: "Hash del certificado previo que esta siendo reemplazado",
              example: "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd"
            }
          }
        },
        BatchCertificateItem: {
          type: "object",
          required: ["studentName", "studentId", "recipientEmail", "programName", "institutionName"],
          properties: {
            studentName: { type: "string", example: "Grace Hopper" },
            studentId: { type: "string", example: "A2026-002" },
            recipientEmail: { type: "string", format: "email", example: "grace@example.com" },
            programName: { type: "string", example: "Computer Science" },
            institutionName: { type: "string", example: "Universidad TFM" },
            grade: { type: "string", example: "Notable" },
            expiryDate: { type: "string", format: "date", example: "2028-12-31" }
          }
        },
        BatchIssueRequest: {
          type: "object",
          required: ["certificates"],
          properties: {
            certificates: {
              type: "array",
              minItems: 1,
              items: { $ref: "#/components/schemas/BatchCertificateItem" }
            }
          }
        },
        VerifyByHashRequest: {
          type: "object",
          required: ["certificateHash"],
          properties: {
            certificateHash: {
              type: "string",
              example: "0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd"
            }
          }
        },
        SiweNonceRequest: {
          type: "object",
          required: ["address"],
          properties: {
            address: { type: "string", example: "0x1234567890abcdef1234567890abcdef12345678" }
          }
        },
        SiweVerifyRequest: {
          type: "object",
          required: ["address", "nonce", "signature"],
          properties: {
            address: { type: "string", example: "0x1234567890abcdef1234567890abcdef12345678" },
            nonce: { type: "string", example: "3f4e5a..." },
            signature: { type: "string", example: "0xdeadbeef..." }
          }
        }
      }
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check basico del backend",
          responses: {
            "200": {
              description: "Backend operativo",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/architecture": {
        get: {
          tags: ["Health"],
          summary: "Estado de arquitectura (Polygon, IPFS, DB)",
          responses: {
            "200": {
              description: "Reporte de salud de integraciones",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/auth/nonce": {
        post: {
          tags: ["Auth"],
          summary: "Solicita nonce SIWE",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SiweNonceRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Nonce generado",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/auth/verify": {
        post: {
          tags: ["Auth"],
          summary: "Verifica firma SIWE y emite JWT",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SiweVerifyRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Login SIWE exitoso",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/issuer/status": {
        get: {
          tags: ["Issuer"],
          summary: "Consulta estado del emisor en contrato",
          responses: {
            "200": {
              description: "Estado de emisor obtenido",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/certificates": {
        get: {
          tags: ["Certificates"],
          summary: "Lista certificados de un emisor",
          parameters: [
            {
              name: "issuer",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Direccion Ethereum del emisor"
            }
          ],
          responses: {
            "200": {
              description: "Listado de certificados",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        },
        post: {
          tags: ["Certificates"],
          summary: "Emite un certificado individual",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CertificateIssueRequest" }
              }
            }
          },
          responses: {
            "201": {
              description: "Certificado emitido",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            },
            "403": {
              description: "Issuer no autorizado"
            }
          }
        }
      },
      "/api/certificates/batch": {
        post: {
          tags: ["Certificates"],
          summary: "Emision masiva por lote",
          description: "Procesa multiples certificados (CSV en frontend) y ancla hashes en una sola transaccion.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BatchIssueRequest" }
              }
            }
          },
          responses: {
            "201": {
              description: "Lote emitido",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/verify": {
        get: {
          tags: ["Verification"],
          summary: "Verifica certificado por hash (query)",
          parameters: [
            {
              name: "certificateHash",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Hash del certificado"
            }
          ],
          responses: {
            "200": {
              description: "Resultado de verificacion",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        },
        post: {
          tags: ["Verification"],
          summary: "Verifica certificado por hash (body)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyByHashRequest" }
              }
            }
          },
          responses: {
            "200": {
              description: "Resultado de verificacion",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/verify/document": {
        post: {
          tags: ["Verification"],
          summary: "Verifica certificado por documento JSON",
          description: "Valida payload normalizado, firma y hash contra blockchain + consistencia documental.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Documento verificado",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      },
      "/api/audit-logs": {
        get: {
          tags: ["Audit"],
          summary: "Consulta logs de auditoria",
          parameters: [
            { name: "certificateHash", in: "query", schema: { type: "string" } },
            { name: "revokedBy", in: "query", schema: { type: "string" } },
            { name: "eventType", in: "query", schema: { type: "string" } },
            { name: "fromBlock", in: "query", schema: { type: "integer" } },
            { name: "toBlock", in: "query", schema: { type: "integer" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
            { name: "offset", in: "query", schema: { type: "integer" } }
          ],
          responses: {
            "200": {
              description: "Listado de eventos",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
};

export const swaggerSpec = swaggerJsdoc(options);
