"use client";

import { z } from "zod";

const hashRegex = /^0x[a-fA-F0-9]{64}$/;
const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const verificationMethodRegex = /^blockchain:\/\/[^/]+\/\d+\/0x[a-fA-F0-9]{40}\/[A-Za-z_][A-Za-z0-9_]*$/;
const signatureRegex = /^0x[a-fA-F0-9]{130}$/;

const payloadSchema = z.object({
  studentName: z.string().trim().min(1, "studentName es obligatorio"),
  studentId: z.string().trim().min(1, "studentId es obligatorio"),
  programName: z.string().trim().min(1, "programName es obligatorio"),
  institutionName: z.string().trim().min(1, "institutionName es obligatorio"),
  issuedAt: z.string().trim().min(1, "issuedAt es obligatorio")
}).strict();

const proofSchema = z.object({
  certificateHash: z.string().regex(hashRegex, "proof.certificateHash debe ser un hash 0x-prefixed SHA-256"),
  hashAlgorithm: z.literal("SHA-256"),
  signatureType: z.literal("EthereumPersonalSign"),
  signatureValue: z.string().regex(signatureRegex, "Firma malformada: proof.signatureValue debe ser una firma Ethereum ECDSA valida"),
  signerAddress: z.string().regex(ethAddressRegex, "proof.signerAddress debe ser una direccion Ethereum valida"),
  verificationMethod: z.string().regex(verificationMethodRegex, "proof.verificationMethod debe ser un URI blockchain:// valido").optional(),
  normalizedPayload: payloadSchema
}).strict();

const badgeSchema = z.object({
  name: z.string().trim().min(1, "badge.name es obligatorio"),
  description: z.string().trim().min(1, "badge.description es obligatorio"),
  issuer: z.object({
    name: z.string().trim().min(1, "badge.issuer.name es obligatorio"),
    url: z.string().trim().url("badge.issuer.url debe ser una URL valida")
  }).strict()
}).strict();

const verificationSchema = z.object({
  type: z.literal("BlockchainSignature"),
  publicKey: z.string().regex(ethAddressRegex, "verification.publicKey debe ser una direccion Ethereum valida"),
  verificationMethod: z.string().regex(verificationMethodRegex, "verification.verificationMethod debe ser un URI blockchain:// valido")
}).strict();

const recipientSchema = z.object({
  type: z.literal("email"),
  identity: z.string().regex(hashRegex, "recipient.identity debe ser un hash 0x-prefixed"),
  salt: z.string().regex(/^[a-f0-9]{32,64}$/, "recipient.salt debe ser hexadecimal de 32 o 64 caracteres"),
  hashed: z.literal(true)
}).strict();

const statusSchema = z.object({
  current: z.enum(["Valid", "Revoked", "Expired"]),
  revocationReason: z.string().nullable(),
  revokedAt: z.string().nullable(),
  revokedBy: z.string().nullable()
}).strict();

const blockchainSchema = z.object({
  network: z.string().trim().min(1),
  chainId: z.number().int().positive(),
  contractAddress: z.string().regex(ethAddressRegex, "blockchain.contractAddress debe ser una direccion Ethereum valida"),
  transactionHash: z.string().trim().min(1),
  certificateId: z.string().trim().min(1),
  metadataURI: z.string().trim().min(1)
}).strict();

export const academicCertificateDocumentSchema = z.object({
  "@context": z.literal("https://w3id.org/openbadges/v2"),
  id: z.string().trim().min(1),
  type: z.literal("Assertion"),
  issuedOn: z.string().trim().min(1),
  verificationUrl: z.string().trim().url().optional(),
  badge: badgeSchema,
  verification: verificationSchema,
  recipient: recipientSchema,
  proof: proofSchema,
  blockchain: blockchainSchema.optional(),
  status: statusSchema,
  replacesCertificateHash: z.string().regex(hashRegex).nullable().optional()
}).strict();

const documentEnvelopeSchema = z.object({
  document: academicCertificateDocumentSchema,
  recipientEmail: z.string().email().optional()
}).strict();

const certificateEnvelopeSchema = z.object({
  certificate: academicCertificateDocumentSchema.omit({ proof: true }),
  proof: proofSchema,
  recipientEmail: z.string().email().optional()
}).strict();

export const verifierUploadSchema = z.union([
  academicCertificateDocumentSchema,
  documentEnvelopeSchema,
  certificateEnvelopeSchema
]);

export const validateVerifierUpload = (input: unknown): void => {
  const result = verifierUploadSchema.safeParse(input);

  if (result.success) {
    return;
  }

  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "documento";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  throw new Error(`Esquema JSON-LD/Open Badges invalido. ${issues}`);
};
