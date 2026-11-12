import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import nodemailer from "nodemailer";
import { db } from "@/server/db";
import { decryptToken, encryptToken } from "@/server/crypto/tokens";
import { systemEmailIdentity, validatedMailbox } from "@/server/email-config";

export type EmailKind = "EMAIL_VERIFY" | "PASSWORD_RESET" | "WORKSPACE_INVITATION" | "BOOKING_RECOVERY" | "BOOKING_CONFIRMED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED" | "BOOKING_REMINDER";
export type EmailDelivery = { workspaceId: string; outboxId: string; idempotencyKey: string; recipientEmail: string; subject: string; text: string; replyTo?: string };
export interface EmailProvider { send(message: EmailDelivery, signal?: AbortSignal): Promise<void> }
export const EMAIL_LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

function tokenSecret() {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (secret && Buffer.byteLength(secret) >= 32) return secret;
  if (process.env.NODE_ENV === "test") return "tempocove-test-only-email-token-secret-2026";
  if (process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production") return "tempocove-explicit-demo-email-token-secret-2026";
  throw new Error("EMAIL_TOKEN_SECRET with at least 32 bytes is required outside explicit demo mode.");
}

function mac(value: string) { return createHmac("sha256", tokenSecret()).update(value).digest("base64url"); }
export function createActionToken(purpose: string, binding: string, id = randomBytes(18).toString("base64url")) {
  const signature = mac(`token:v1\0${purpose}\0${id}\0${binding}`); const token = `v1.${id}.${signature}`;
  return { id, token, tokenHash: `hmac:v1:${mac(`digest:v1\0${purpose}\0${token}\0${binding}`)}` };
}
export function materializeActionToken(id: string, purpose: string, binding: string) { return createActionToken(purpose, binding, id).token; }
export function actionTokenHash(token: string, purpose: string, binding: string) { return `hmac:v1:${mac(`digest:v1\0${purpose}\0${token}\0${binding}`)}`; }
export function actionTokenId(token: string) {
  if (token.length > 500) return null; const [version, id, supplied] = token.split(".");
  return version === "v1" && id && supplied ? id : null;
}
export function tokenHashMatches(supplied: string, expected: string) {
  const left = Buffer.from(supplied); const right = Buffer.from(expected); return left.length === right.length && timingSafeEqual(left, right);
}

export function accountTokenBinding(workspaceId: string, userId: string, email: string) { return `${workspaceId}\0${userId}\0${email}`; }
export function bookingTokenBinding(workspaceId: string, bookingId: string, email: string) { return `${workspaceId}\0${bookingId}\0${email}`; }
export function invitationTokenBinding(workspaceId: string, email: string, role: string, version: number) { return `${workspaceId}\0${email}\0${role}\0${version}`; }

type Transaction = Prisma.TransactionClient;
type EnqueueEmail = { workspaceId: string; bookingId?: string; kind: EmailKind; recipientEmail: string; subject: string; payload: Record<string, unknown>; idempotencyKey: string; bookingMutationVersion?: number; sendAt?: Date };
export async function enqueueEmail(tx: Transaction, input: EnqueueEmail) {
  return tx.emailOutbox.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: {}, create: {
    workspaceId: input.workspaceId, bookingId: input.bookingId, kind: input.kind, recipientEmail: input.recipientEmail.toLowerCase(),
    subjectSnapshot: input.subject, payloadJson: JSON.stringify(input.payload), idempotencyKey: input.idempotencyKey,
    bookingMutationVersion: input.bookingMutationVersion, ...(input.sendAt ? { nextAttemptAt: input.sendAt } : {}),
  } });
}

type BookingEmailSnapshot = { id: string; workspaceId: string; hostId: string; inviteeName: string; inviteeEmail: string; inviteeTimeZone: string; eventTitleSnapshot: string; startAt: Date; endAt: Date; priceCents: number; currency: string; stripePaymentStatus: string | null; refundStatus?: string; mutationVersion: number };
function paymentTruth(booking: BookingEmailSnapshot) {
  if (booking.priceCents === 0) return "No payment required";
  if (booking.refundStatus === "REFUNDED") return "Refunded";
  if (booking.refundStatus === "REFUND_PENDING") return "Paid; refund pending";
  if (booking.refundStatus === "REFUND_FAILED") return "Paid; refund needs attention";
  return booking.stripePaymentStatus === "paid" ? "Paid" : booking.stripePaymentStatus === "paid_after_cancel" ? "Paid; refund pending" : "Payment pending";
}
export async function enqueueBookingEmail(tx: Transaction, booking: BookingEmailSnapshot, kind: "BOOKING_CONFIRMED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED", now = new Date()) {
  await tx.bookingRecoveryToken.updateMany({ where: { bookingId: booking.id, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
  const expiresAt = new Date(Math.max(now.getTime() + 7 * 24 * 60 * 60_000, booking.endAt.getTime() + 30 * 24 * 60 * 60_000));
  const id = randomBytes(18).toString("base64url"); const binding = bookingTokenBinding(booking.workspaceId, booking.id, booking.inviteeEmail.toLowerCase());
  const authority = createActionToken("BOOKING_RECOVERY", binding, id);
  await tx.bookingRecoveryToken.create({ data: { id, workspaceId: booking.workspaceId, bookingId: booking.id, email: booking.inviteeEmail.toLowerCase(), tokenHash: authority.tokenHash, expiresAt } });
  const branding = await tx.workspaceBranding.findFirst({ where: { workspaceId: booking.workspaceId }, select: { workspaceName: true } });
  const inviteePayload = { recoveryTokenId: id, workspaceName: branding?.workspaceName, eventTitle: booking.eventTitleSnapshot, startAt: booking.startAt.toISOString(), timeZone: booking.inviteeTimeZone, priceCents: booking.priceCents, currency: booking.currency, paymentTruth: paymentTruth(booking) };
  await enqueueEmail(tx, { workspaceId: booking.workspaceId, bookingId: booking.id, kind, recipientEmail: booking.inviteeEmail, subject: subjectFor(kind, booking.eventTitleSnapshot),
    payload: inviteePayload, idempotencyKey: `email:booking:${kind}:${booking.id}:${booking.mutationVersion}`, bookingMutationVersion: booking.mutationVersion });
  // Reminder 24 hours before the appointment. It is bound to the booking's mutation version, so a
  // later reschedule or cancellation supersedes it before delivery (see processEmailOutbox).
  const remindAt = new Date(booking.startAt.getTime() - REMINDER_LEAD_MS);
  if (kind !== "BOOKING_CANCELLED" && remindAt.getTime() > now.getTime() + 60 * 60_000) {
    await enqueueEmail(tx, { workspaceId: booking.workspaceId, bookingId: booking.id, kind: "BOOKING_REMINDER", recipientEmail: booking.inviteeEmail, subject: subjectFor("BOOKING_REMINDER", booking.eventTitleSnapshot),
      payload: inviteePayload, idempotencyKey: `email:booking:BOOKING_REMINDER:${booking.id}:${booking.mutationVersion}`, bookingMutationVersion: booking.mutationVersion, sendAt: remindAt });
  }
  const host = await tx.user.findUnique({ where: { id: booking.hostId }, select: { email: true, timeZone: true } });
  if (host) {
    await enqueueEmail(tx, { workspaceId: booking.workspaceId, bookingId: booking.id, kind, recipientEmail: host.email, subject: organizerSubjectFor(kind, booking.eventTitleSnapshot),
      payload: { audience: "organizer", hostId: booking.hostId, inviteeName: booking.inviteeName, inviteeEmail: booking.inviteeEmail, eventTitle: booking.eventTitleSnapshot, startAt: booking.startAt.toISOString(), timeZone: host.timeZone, priceCents: booking.priceCents, currency: booking.currency, paymentTruth: paymentTruth(booking) },
      idempotencyKey: `email:booking:organizer:${kind}:${booking.id}:${booking.mutationVersion}`, bookingMutationVersion: booking.mutationVersion });
  }
}

export const REMINDER_LEAD_MS = 24 * 60 * 60_000;
function subjectFor(kind: string, eventTitle: string) {
  if (kind === "BOOKING_CANCELLED") return `Rezervace zrušena: ${eventTitle}`;
  if (kind === "BOOKING_RESCHEDULED") return `Rezervace přesunuta: ${eventTitle}`;
  if (kind === "BOOKING_REMINDER") return `Připomínka: zítra máte ${eventTitle}`;
  return `Rezervace potvrzena: ${eventTitle}`;
}
function organizerSubjectFor(kind: string, eventTitle: string) {
  if (kind === "BOOKING_CANCELLED") return `Zrušená rezervace: ${eventTitle}`;
  if (kind === "BOOKING_RESCHEDULED") return `Přesunutá rezervace: ${eventTitle}`;
  return `Nová rezervace: ${eventTitle}`;
}
const paymentLabels: Record<string, string> = { "No payment required": "Bez platby", Refunded: "Vráceno", "Paid; refund pending": "Zaplaceno, vrácení peněz se zpracovává", "Paid; refund needs attention": "Zaplaceno, vrácení peněz vyžaduje kontrolu", Paid: "Zaplaceno", "Payment pending": "Čeká na platbu" };
const signature = "\n\n--\nTento e-mail byl odeslán automaticky rezervačním systémem.";

function appBaseUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  const url = new URL(value); if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production email links require canonical HTTPS NEXT_PUBLIC_APP_URL.");
  return url.origin;
}
function money(cents: number, currency: string) { return cents === 0 ? "Zdarma" : new Intl.NumberFormat("cs-CZ", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100); }
function bookingTime(startAt: string, timeZone: string) {
  const value = DateTime.fromISO(startAt).setZone(timeZone).setLocale("cs");
  return `${value.toLocaleString({ weekday: "long", day: "numeric", month: "long", year: "numeric" })} v ${value.toFormat("H:mm")} (${timeZone})`;
}
function bookingDetails(payload: Record<string, unknown>) {
  const lines = [`Služba: ${String(payload.eventTitle)}`, `Termín: ${bookingTime(String(payload.startAt), String(payload.timeZone))}`];
  if (payload.workspaceName) lines.unshift(`Provozovna: ${String(payload.workspaceName)}`);
  lines.push(`Cena: ${money(Number(payload.priceCents), String(payload.currency))}`);
  if (Number(payload.priceCents) > 0) lines.push(`Platba: ${paymentLabels[String(payload.paymentTruth)] ?? String(payload.paymentTruth)}`);
  return lines.join("\n");
}

async function render(row: { kind: string; workspaceId: string; bookingId: string | null; recipientEmail: string; subjectSnapshot: string; payloadJson: string }, at = new Date()) {
  const payload = JSON.parse(row.payloadJson) as Record<string, unknown>; const base = appBaseUrl();
  if (row.kind === "EMAIL_VERIFY" || row.kind === "PASSWORD_RESET") {
    const record = await db.accountActionToken.findUnique({ where: { id: String(payload.tokenId) } });
    if (!record || record.workspaceId !== row.workspaceId || record.email !== row.recipientEmail || record.consumedAt || record.revokedAt || record.expiresAt <= at) return null;
    const binding = accountTokenBinding(record.workspaceId, record.userId, record.email); const token = materializeActionToken(record.id, record.purpose, binding);
    if (!tokenHashMatches(actionTokenHash(token, record.purpose, binding), record.tokenHash)) return null;
    const path = row.kind === "EMAIL_VERIFY" ? "/verify-email" : "/reset-password";
    const link = `${base}${path}#token=${encodeURIComponent(token)}`;
    return row.kind === "EMAIL_VERIFY"
      ? { subject: "Ověřte svůj e-mail", text: `Dobrý den,\n\ndokončete prosím registraci ověřením e-mailové adresy:\n${link}\n\nOdkaz platí 24 hodin. Pokud jste se neregistrovali, e-mail ignorujte.${signature}` }
      : { subject: "Obnovení hesla", text: `Dobrý den,\n\nnové heslo si nastavíte na tomto odkazu:\n${link}\n\nPokud jste o změnu hesla nežádali, e-mail ignorujte. Heslo zůstane beze změny.${signature}` };
  }
  if (row.kind === "WORKSPACE_INVITATION") {
    const invitation = await db.workspaceInvitation.findUnique({ where: { id: String(payload.invitationId) } });
    if (!invitation || invitation.workspaceId !== row.workspaceId || invitation.email !== row.recipientEmail || invitation.status !== "PENDING" || invitation.expiresAt <= at || invitation.tokenVersion !== Number(payload.tokenVersion) || !invitation.tokenHash) return null;
    const binding = invitationTokenBinding(invitation.workspaceId, invitation.email, invitation.role, invitation.tokenVersion); const token = materializeActionToken(invitation.id, "WORKSPACE_INVITATION", binding);
    if (!tokenHashMatches(actionTokenHash(token, "WORKSPACE_INVITATION", binding), invitation.tokenHash)) return null;
    const role = invitation.role === "OWNER" ? "správce" : "člen týmu";
    return { subject: `Pozvánka do provozovny ${String(payload.workspaceName)}`, text: `Dobrý den,\n\nbyli jste pozváni do provozovny ${String(payload.workspaceName)} jako ${role}.\nPozvánku přijmete zde:\n${base}/invite/accept#token=${encodeURIComponent(token)}${signature}` };
  }
  if (payload.audience === "organizer") {
    if (!row.bookingId) return null;
    const booking = await db.booking.findFirst({ where: { id: row.bookingId, workspaceId: row.workspaceId, hostId: String(payload.hostId) }, select: { host: { select: { email: true } } } });
    if (!booking || booking.host.email.toLowerCase() !== row.recipientEmail.toLowerCase()) return null;
    const action = row.kind === "BOOKING_CANCELLED" ? "zrušil(a) rezervaci" : row.kind === "BOOKING_RESCHEDULED" ? "přesunul(a) rezervaci" : "si rezervoval(a) termín";
    return { subject: organizerSubjectFor(row.kind, String(payload.eventTitle)), text: `${String(payload.inviteeName)} (${String(payload.inviteeEmail)}) ${action}.\n\n${bookingDetails(payload)}\n\nDetail rezervace: ${base}/bookings?selected=${encodeURIComponent(row.bookingId)}${signature}`, replyTo: String(payload.inviteeEmail) };
  }
  if (row.kind === "BOOKING_REMINDER") {
    if (!row.bookingId) return null;
    const booking = await db.booking.findFirst({ where: { id: row.bookingId, workspaceId: row.workspaceId }, select: { status: true, inviteeEmail: true } });
    if (!booking || booking.status !== "CONFIRMED" || booking.inviteeEmail.toLowerCase() !== row.recipientEmail.toLowerCase()) return null;
    const manage = await recoveryLink(row, payload, at, base);
    return { subject: subjectFor(row.kind, String(payload.eventTitle)), text: `Dobrý den,\n\npřipomínáme vaši rezervaci.\n\n${bookingDetails(payload)}${manage ? `\n\nPokud nemůžete přijít, termín prosím přesuňte nebo zrušte:\n${manage}` : ""}${signature}` };
  }
  const recovery = await db.bookingRecoveryToken.findUnique({ where: { id: String(payload.recoveryTokenId) } });
  if (!recovery || recovery.workspaceId !== row.workspaceId || recovery.bookingId !== row.bookingId || recovery.email !== row.recipientEmail || recovery.consumedAt || recovery.revokedAt || recovery.expiresAt <= at) return null;
  const binding = bookingTokenBinding(recovery.workspaceId, recovery.bookingId, recovery.email); const token = materializeActionToken(recovery.id, "BOOKING_RECOVERY", binding);
  if (!tokenHashMatches(actionTokenHash(token, "BOOKING_RECOVERY", binding), recovery.tokenHash)) return null;
  const manage = `${base}/manage/${recovery.bookingId}/reschedule#recovery=${encodeURIComponent(token)}`;
  if (row.kind === "BOOKING_RECOVERY") return { subject: "Správa vaší rezervace", text: `Dobrý den,\n\nsvou rezervaci přesunete nebo zrušíte na tomto odkazu:\n${manage}${signature}` };
  const intro = row.kind === "BOOKING_CANCELLED" ? "vaše rezervace byla zrušena." : row.kind === "BOOKING_RESCHEDULED" ? "vaše rezervace byla přesunuta na nový termín." : "děkujeme, vaše rezervace je potvrzená.";
  const footer = row.kind === "BOOKING_CANCELLED" ? `Detail rezervace:\n${manage}` : `Potřebujete termín změnit? Přesunete nebo zrušíte ho zde:\n${manage}`;
  return { subject: subjectFor(row.kind, String(payload.eventTitle)), text: `Dobrý den,\n\n${intro}\n\n${bookingDetails(payload)}\n\n${footer}${signature}` };
}

async function recoveryLink(row: { workspaceId: string; bookingId: string | null; recipientEmail: string }, payload: Record<string, unknown>, at: Date, base: string) {
  const recovery = await db.bookingRecoveryToken.findUnique({ where: { id: String(payload.recoveryTokenId) } });
  if (!recovery || recovery.workspaceId !== row.workspaceId || recovery.bookingId !== row.bookingId || recovery.email !== row.recipientEmail || recovery.consumedAt || recovery.revokedAt || recovery.expiresAt <= at) return null;
  const binding = bookingTokenBinding(recovery.workspaceId, recovery.bookingId, recovery.email); const token = materializeActionToken(recovery.id, "BOOKING_RECOVERY", binding);
  return tokenHashMatches(actionTokenHash(token, "BOOKING_RECOVERY", binding), recovery.tokenHash) ? `${base}/manage/${recovery.bookingId}/reschedule#recovery=${encodeURIComponent(token)}` : null;
}

export class LocalInboxEmailProvider implements EmailProvider {
  async send(message: EmailDelivery) {
    if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true" || process.env.EMAIL_PROVIDER !== "local") throw new Error("LOCAL_EMAIL_PROVIDER_DISABLED");
    const encryptedText = encryptToken(message.text); if (!encryptedText) throw new Error("LOCAL_EMAIL_ENCRYPTION_REQUIRED");
    await db.localInboxMessage.upsert({ where: { outboxId: message.outboxId }, update: {}, create: { workspaceId: message.workspaceId, outboxId: message.outboxId, recipientEmail: message.recipientEmail, subject: message.subject, encryptedText } });
  }
}
export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>;
  private readonly from: string;
  private readonly systemReplyTo: string;
  constructor() {
    const required = ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","EMAIL_FROM","EMAIL_REPLY_TO","EMAIL_SENDER_DOMAIN","SMTP_TLS_MODE"];
    if (required.some((name) => !process.env[name])) throw new Error("SMTP_CONFIGURATION_INCOMPLETE");
    const port = Number(process.env.SMTP_PORT); const timeout = Number(process.env.SMTP_TIMEOUT_MS || 8_000);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65_535 || !Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 10_000) throw new Error("SMTP_CONFIGURATION_INVALID");
    const mode = process.env.SMTP_TLS_MODE; if (mode !== "implicit" && mode !== "starttls") throw new Error("SMTP_CONFIGURATION_INVALID");
    const allowSelfSigned = process.env.NODE_ENV === "test" && process.env.SMTP_ALLOW_SELF_SIGNED === "true";
    const identity = systemEmailIdentity(); this.systemReplyTo = identity.replyTo; this.from = identity.from;
    this.transport = nodemailer.createTransport({ host: process.env.SMTP_HOST!, port, secure: mode === "implicit", requireTLS: mode === "starttls", auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! }, connectionTimeout: timeout, greetingTimeout: timeout, socketTimeout: timeout, tls: { rejectUnauthorized: !allowSelfSigned } });
  }
  async send(message: EmailDelivery, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error("SMTP_DELIVERY_ABORTED");
    const identity = createHash("sha256").update(`tempocove-email-v1\0${message.idempotencyKey}`).digest("hex");
    await this.transport.sendMail({ from: this.from, to: validatedMailbox(message.recipientEmail), replyTo: validatedMailbox(message.replyTo || this.systemReplyTo), subject: message.subject, text: message.text, messageId: `<${identity}@snagtime.invalid>`, headers: { "X-SnagTime-Dedupe": identity } });
    // Once SMTP acknowledges the deterministic message id, commit SENT even if shutdown starts.
    // Retrying after an accepted response would create a duplicate external delivery.
  }
}
export function getEmailProvider(): EmailProvider { return process.env.EMAIL_PROVIDER === "smtp" ? new SmtpEmailProvider() : new LocalInboxEmailProvider(); }

async function tokenStillCurrent(row: { kind: string; workspaceId: string; bookingId: string | null; recipientEmail: string; payloadJson: string }, at: Date) { return Boolean(await render({ ...row, subjectSnapshot: "" }, at)); }
export async function processEmailOutbox(workspaceId?: string, now = new Date(), provider: EmailProvider = getEmailProvider(), signal?: AbortSignal) {
  const due = await db.emailOutbox.findMany({ where: { workspaceId, OR: [{ status: { in: ["PENDING","RETRY"] }, nextAttemptAt: { lte: now } }, { status: "PROCESSING", leaseExpiresAt: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: 50 });
  let attempted = 0;
  for (const candidate of due) {
    if (signal?.aborted) break;
    const leaseToken = randomBytes(18).toString("base64url");
    const claimed = await db.emailOutbox.updateMany({ where: { id: candidate.id, OR: [{ status: { in: ["PENDING","RETRY"] }, nextAttemptAt: { lte: now } }, { status: "PROCESSING", leaseExpiresAt: { lte: now } }] }, data: { status: "PROCESSING", leaseToken, leaseExpiresAt: new Date(now.getTime() + EMAIL_LEASE_MS), attemptCount: { increment: 1 } } });
    if (claimed.count !== 1) continue; attempted += 1;
    if (signal?.aborted) { await db.emailOutbox.updateMany({ where: { id: candidate.id, leaseToken, status: "PROCESSING" }, data: { status: "RETRY", attemptCount: { decrement: 1 }, nextAttemptAt: now, leaseToken: null, leaseExpiresAt: null, lastErrorCode: "WORKER_STOPPED" } }); break; }
    const row = await db.emailOutbox.findFirstOrThrow({ where: { id: candidate.id, leaseToken, status: "PROCESSING" } });
    try {
      if (row.bookingId && row.bookingMutationVersion != null) {
        const booking = await db.booking.findFirst({ where: { id: row.bookingId, workspaceId: row.workspaceId }, select: { mutationVersion: true } });
        if (!booking || booking.mutationVersion !== row.bookingMutationVersion) { await db.emailOutbox.updateMany({ where: { id: row.id, leaseToken, status: "PROCESSING" }, data: { status: "SUPERSEDED", leaseToken: null, leaseExpiresAt: null, completedAt: now, lastErrorCode: "STALE_BOOKING_VERSION" } }); continue; }
      }
      if (!await tokenStillCurrent(row, now)) { await db.emailOutbox.updateMany({ where: { id: row.id, leaseToken, status: "PROCESSING" }, data: { status: "SUPERSEDED", leaseToken: null, leaseExpiresAt: null, completedAt: now, lastErrorCode: "AUTHORITY_NOT_CURRENT" } }); continue; }
      const rendered = await render(row, now); if (!rendered) throw new Error("EMAIL_AUTHORITY_NOT_CURRENT");
      if (signal?.aborted) throw new Error("EMAIL_WORKER_STOPPING");
      const replyTo = rendered.replyTo || (process.env.EMAIL_REPLY_TO ? validatedMailbox(process.env.EMAIL_REPLY_TO) : undefined);
      await provider.send({ workspaceId: row.workspaceId, outboxId: row.id, idempotencyKey: row.idempotencyKey, recipientEmail: row.recipientEmail, ...rendered, replyTo }, signal);
      await db.emailOutbox.updateMany({ where: { id: row.id, leaseToken, status: "PROCESSING" }, data: { status: "COMPLETED", completedAt: now, leaseToken: null, leaseExpiresAt: null, lastErrorCode: null } });
    } catch {
      if (signal?.aborted) await db.emailOutbox.updateMany({ where: { id: row.id, leaseToken, status: "PROCESSING" }, data: { status: "RETRY", attemptCount: { decrement: 1 }, nextAttemptAt: now, leaseToken: null, leaseExpiresAt: null, lastErrorCode: "WORKER_STOPPED" } });
      else { const attempt = row.attemptCount; await db.emailOutbox.updateMany({ where: { id: row.id, leaseToken, status: "PROCESSING" }, data: { status: attempt >= MAX_ATTEMPTS ? "DEAD" : "RETRY", nextAttemptAt: new Date(now.getTime() + Math.min(60 * 60_000, 2 ** Math.min(attempt, 10) * 1_000)), leaseToken: null, leaseExpiresAt: null, lastErrorCode: "DELIVERY_FAILED" } }); }
    }
  }
  return { attempted, pending: await db.emailOutbox.count({ where: { workspaceId, status: { in: ["PENDING","RETRY","PROCESSING"] } } }) };
}

export async function listLocalInbox(workspaceId: string) {
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true" || process.env.EMAIL_PROVIDER !== "local") throw new Error("LOCAL_INBOX_DISABLED");
  const rows = await db.localInboxMessage.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((row) => ({ id: row.id, recipientEmail: row.recipientEmail, subject: row.subject, text: decryptToken(row.encryptedText) || "", createdAt: row.createdAt.toISOString() }));
}
