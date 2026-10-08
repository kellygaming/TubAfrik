import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { SITE_URL } from "@/lib/format";

// ═══════════════════════════════════════════════════════════════
// ENVOI DES EMAILS — boîte pro Zoho, par SMTP
//
// Variables (Vercel):
//   SMTP_USER   l'adresse Zoho, ex. hello@tubafrik.com
//   SMTP_PASS   le mot de passe d'application Zoho (jamais le vrai mot de passe)
//   SMTP_HOST   smtp.zoho.com par défaut (smtppro.zoho.com pour un domaine
//               payant, smtp.zoho.eu si le compte est sur le centre européen)
//   MAIL_FROM   facultatif, « TubAfrik <hello@tubafrik.com> » par défaut
// ═══════════════════════════════════════════════════════════════
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;

export const emailConfigured = () => Boolean(USER && PASS);

let transport: Transporter | null = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: USER, pass: PASS },
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

export async function sendEmail(o: { to: string; subject: string; html: string; text: string; userId: string }) {
  const unsubscribe = unsubscribeUrl(o.userId);
  await mailer().sendMail({
    from: process.env.MAIL_FROM || `TubAfrik <${USER}>`,
    to: o.to,
    subject: o.subject,
    html: o.html,
    text: o.text,
    // Désinscription en un clic depuis Gmail / Apple Mail (et meilleure délivrabilité).
    list: { unsubscribe: { url: unsubscribe, comment: "Se désabonner" } },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

// ── Lien de désinscription signé: impossible de désabonner quelqu'un d'autre.
function secret() {
  return process.env.EMAIL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function unsubscribeToken(userId: string) {
  return createHmac("sha256", secret()).update(`unsub:${userId}`).digest("base64url").slice(0, 32);
}

export function checkUnsubscribeToken(userId: string, token: string) {
  const a = Buffer.from(unsubscribeToken(userId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(userId: string) {
  return `${SITE_URL}/api/email/desabonner?u=${userId}&t=${unsubscribeToken(userId)}`;
}
