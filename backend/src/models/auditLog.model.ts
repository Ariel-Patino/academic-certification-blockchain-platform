import { Schema, model, InferSchemaType } from "mongoose";

const auditLogSchema = new Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: ["CertificateRevoked"],
      index: true
    },
    certificateId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    certificateHash: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    revokedBy: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    /** Block number on the Amoy/Polygon network where the event was anchored */
    blockNumber: {
      type: Number,
      required: true,
      index: true
    },
    /** Transaction hash on-chain */
    transactionHash: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    /** Timestamp of the block that includes this event (on-chain time) */
    eventTimestamp: {
      type: Date,
      required: true
    },
    /** When the backend processed and stored this log entry */
    processedAt: {
      type: Date,
      required: true,
      default: () => new Date()
    }
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "auditLogs"
  }
);

export type AuditLogRecord = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = model("AuditLog", auditLogSchema);
