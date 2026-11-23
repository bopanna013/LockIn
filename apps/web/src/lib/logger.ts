import pino from "pino";
import { serverEnv } from "@/env";

/**
 * Structured JSON logger for server code. Sensitive fields are redacted so
 * passwords, tokens and OTPs never reach log files.
 */
export const logger = pino({
  level: serverEnv().LOG_LEVEL,
  base: { service: "lockin-web" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "otp",
      "*.otp",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
});
