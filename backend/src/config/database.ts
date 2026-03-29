import mongoose from "mongoose";

import { env } from "./env";

let isConnecting = false;

export const connectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (isConnecting) {
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return;
  }

  isConnecting = true;

  try {
    await mongoose.connect(env.mongoUri, {
      dbName: env.mongoDatabaseName,
      serverSelectionTimeoutMS: 5000
    });
  } finally {
    isConnecting = false;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};
