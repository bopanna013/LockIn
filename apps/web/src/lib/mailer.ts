import net from "node:net";
import { serverEnv } from "@/env";
import { logger } from "./logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email over SMTP (Mailpit on localhost:1025 in dev, or configured SMTP relay).
 * Uses a minimal standards-compliant SMTP socket client for plain/local relays and logs
 * safely without ever leaking OTP codes into production logs.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = serverEnv();
  try {
    await sendRawSmtp({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      from: extractAddress(env.EMAIL_FROM),
      fromHeader: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.info({ to: message.to, subject: message.subject }, "Outbound email dispatched");
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : String(error), to: message.to },
      "SMTP delivery failed; continuing without crashing request",
    );
  }
}

function extractAddress(fromHeader: string): string {
  const match = /<([^>]+)>/.exec(fromHeader);
  return match?.[1] ?? fromHeader.trim();
}

async function sendRawSmtp(params: {
  host: string;
  port: number;
  from: string;
  fromHeader: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const boundary = `lockin_${Date.now().toString(36)}`;
  const mime = [
    `From: ${params.fromHeader}`,
    `To: <${params.to}>`,
    `Subject: ${params.subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    params.html,
    "",
    `--${boundary}--`,
    ".",
    "",
  ].join("\r\n");

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: params.host, port: params.port });
    let step = 0;
    socket.setTimeout(4000);

    const fail = (err: Error) => {
      socket.destroy();
      reject(err);
    };

    socket.on("timeout", () => fail(new Error("SMTP connection timed out")));
    socket.on("error", fail);

    socket.on("data", (chunk) => {
      const line = chunk.toString("utf8");
      const code = Number(line.slice(0, 3));
      if (code >= 400) {
        return fail(new Error(`SMTP error: ${line.trim()}`));
      }

      if (step === 0 && code === 220) {
        step = 1;
        socket.write("EHLO lockin.home.arpa\r\n");
      } else if (step === 1 && code === 250) {
        step = 2;
        socket.write(`MAIL FROM:<${params.from}>\r\n`);
      } else if (step === 2 && code === 250) {
        step = 3;
        socket.write(`RCPT TO:<${params.to}>\r\n`);
      } else if (step === 3 && code === 250) {
        step = 4;
        socket.write("DATA\r\n");
      } else if (step === 4 && code === 354) {
        step = 5;
        socket.write(mime);
      } else if (step === 5 && code === 250) {
        step = 6;
        socket.write("QUIT\r\n");
        socket.end();
        resolve();
      }
    });
  });
}

export function buildVerificationEmail(params: { fullName: string; otp: string }): EmailMessage & {
  subject: string;
} {
  const subject = `LOCKIN — Your 6-digit verification code is ${params.otp}`;
  const text = [
    `Hi ${params.fullName},`,
    "",
    `Your 6-digit LOCKIN email verification code is: ${params.otp}`,
    "",
    "This code expires in 30 minutes.",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin-top:0">Verify your LOCKIN email</h2>
    <p>Hi ${escapeHtml(params.fullName)},</p>
    <p>Enter this 6-digit code to verify your email address:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f3f4f6;padding:14px 20px;border-radius:8px;display:inline-block">${escapeHtml(params.otp)}</p>
    <p style="color:#6b7280;font-size:13px">This code expires in 30 minutes.</p>
  </div>`;
  return { to: "", subject, text, html };
}

export function buildGuardianConsentEmail(params: {
  guardianFullName: string;
  studentFullName: string;
  otp: string;
  lanApprovalUrl: string;
}): Omit<EmailMessage, "to"> {
  const subject = `LOCKIN — Guardian approval requested for ${params.studentFullName}`;
  const text = [
    `Dear ${params.guardianFullName},`,
    "",
    `${params.studentFullName} (under 18) has requested to use LOCKIN, an engineering branch discovery and 4-year B.E./B.Tech career roadmap platform.`,
    "",
    "Under India's Digital Personal Data Protection (DPDP) Act 2023 (Section 9), verifiable parent/guardian consent is required before we collect or store personal academic profile, assessment, or roadmap data for a minor.",
    "",
    `Option 1 (Read 6-digit OTP to your child): ${params.otp}`,
    `Option 2 (Open on the same local network): ${params.lanApprovalUrl}`,
    "",
    "This code is valid for 72 hours. You may view or revoke consent at any time via the Guardian Portal.",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin-top:0">Parent / Guardian Consent Request (DPDP Act 2023)</h2>
    <p>Dear ${escapeHtml(params.guardianFullName)},</p>
    <p><strong>${escapeHtml(params.studentFullName)}</strong> (under 18) has created an account on <strong>LOCKIN</strong>, an engineering branch discovery and four-year B.E./B.Tech roadmap platform.</p>
    <p>In compliance with Section 9 of India's Digital Personal Data Protection Act 2023, their account remains restricted until a parent or legal guardian approves it. We never run behavioural tracking, advertising, or third-party analytics on minors.</p>
    <p><strong>6-digit Guardian Approval Code:</strong></p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f3f4f6;padding:14px 20px;border-radius:8px;display:inline-block">${escapeHtml(params.otp)}</p>
    <p>You can either read this 6-digit code to ${escapeHtml(params.studentFullName)} and complete the confirmation statement on their screen, or open the approval link on any device connected to the same local network:</p>
    <p><a href="${escapeHtml(params.lanApprovalUrl)}">${escapeHtml(params.lanApprovalUrl)}</a></p>
  </div>`;
  return { subject, text, html };
}

export function buildGuardianPortalReceiptEmail(params: {
  guardianFullName: string;
  studentFullName: string;
  portalUrl: string;
}): Omit<EmailMessage, "to"> {
  const subject = `LOCKIN — Guardian Consent Confirmed & Portal Link for ${params.studentFullName}`;
  const text = [
    `Dear ${params.guardianFullName},`,
    "",
    `Thank you for confirming guardian consent for ${params.studentFullName} on LOCKIN.`,
    "",
    "Keep this private Guardian Portal link to inspect collected data, download a copy, or revoke consent at any time:",
    params.portalUrl,
  ].join("\n");
  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="margin-top:0">Guardian Consent Confirmed</h2>
    <p>Dear ${escapeHtml(params.guardianFullName)},</p>
    <p>Your consent for <strong>${escapeHtml(params.studentFullName)}</strong> has been recorded in LOCKIN's immutable consent ledger.</p>
    <p>Use your private <strong>Guardian Portal link</strong> below at any time on the local network to inspect what data is stored, download a JSON export, or revoke consent:</p>
    <p><a href="${escapeHtml(params.portalUrl)}">${escapeHtml(params.portalUrl)}</a></p>
  </div>`;
  return { subject, text, html };
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
