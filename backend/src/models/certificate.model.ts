import { Schema, model, InferSchemaType } from "mongoose";

const certificateStatusValues = ["Valid", "Revoked", "Expired"] as const;

const certificateSchema = new Schema(
  {
    certificateHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },
    issuerAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    recipientEmailHash: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    // GDPR/Privacy: recipientSalt is intentionally NOT persisted in the database.
    // The salt only lives inside the JSON-LD document delivered to the certificate holder.
    // Without the JSON-LD file the salt is unrecoverable, making brute-force
    // reversal of recipientEmailHash computationally infeasible even with full DB access.
    expirationDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: certificateStatusValues,
      default: "Valid",
      index: true
    },
    ipfsCID: {
      type: String,
      required: true,
      trim: true
    },
    metadataURI: {
      type: String,
      required: true,
      trim: true
    },
    certificateId: {
      type: String,
      default: null,
      index: true
    },
    txHash: {
      type: String,
      default: null
    },
    replacesCertificateHash: {
      // Hash of the certificate this one supersedes (re-issuance). Null for original issuances.
      type: String,
      default: null,
      index: true
    },
    replacedByHash: {
      // Set when this certificate is superseded by a re-issuance. Enables reverse lookup.
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export type CertificatePersistenceRecord = InferSchemaType<typeof certificateSchema>;

export const CertificateModel = model("Certificate", certificateSchema);
