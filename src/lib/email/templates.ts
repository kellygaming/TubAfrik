import "server-only";
import { SITE_URL } from "@/lib/format";
import { fcfa } from "@/lib/gifts";
import { LEGAL } from "@/lib/legal";

// ═══════════════════════════════════════════════════════════════
// MODÈLES D'EMAILS
//
// HTML « à l'ancienne » (tableaux, styles en ligne): c'est le seul que
// Gmail, Outlook et Apple Mail affichent tous pareil. Fond noir, or et
// orange kente, comme le site. Images hébergées sur tubafrik.com/email.
// ═══════════════════════════════════════════════════════════════
const IMG = `${SITE_URL}/email`;
const C = { bg: "#0b0b0b", card: "#161616", line: "#262626", text: "#ffffff", muted: "#a1a1aa", gold: "#f4b400", orange: "#ff6b1a" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type Mail = { subject: string; html: string; text: string };

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function kente() {
  const cells = Array.from({ length: 12 }, (_, i) =>
    `<td style="height:6px;background:${i % 2 ? C.orange : C.gold};font-size:0;line-height:0">&nbsp;</td>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

function button(label: string, href: string, primary = true) {
  return `<a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:999px;font:700 15px ${FONT};text-decoration:none;${
    primary ? `background:${C.gold};color:#000` : `background:transparent;color:${C.text};border:1px solid #3f3f46`
  }">${label}</a>`;
}

function layout(o: { preheader: string; hero?: boolean; body: string; unsubscribe: string; reason: string }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>TubAfrik</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border-radius:20px;overflow:hidden;border:1px solid ${C.line}">
  <tr><td style="padding:20px 24px">
    <a href="${SITE_URL}" style="text-decoration:none"><img src="${IMG}/logo.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px;border:0">
    <span style="font:800 20px ${FONT};color:${C.text};vertical-align:middle;margin-left:8px">Tub<span style="color:${C.gold}">Afrik</span></span></a>
  </td></tr>
  ${o.hero ? `<tr><td><a href="${SITE_URL}"><img src="${IMG}/hero.jpg" width="560" alt="TubAfrik — les vidéos et les lives des créateurs africains" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
  <tr><td style="padding:28px 24px 32px;font:400 15px/1.6 ${FONT};color:${C.text}">${o.body}</td></tr>
  <tr><td>${kente()}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:18px 12px;font:400 12px/1.6 ${FONT};color:#71717a;text-align:center">
  ${esc(o.reason)}<br>
  <a href="${o.unsubscribe}" style="color:#a1a1aa">Ne plus recevoir ces emails</a> · <a href="mailto:${LEGAL.email}" style="color:#a1a1aa">${LEGAL.email}</a><br>
  TubAfrik · La plateforme des créateurs africains
</td></tr></table>
</td></tr></table></body></html>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 12px;font:800 24px/1.25 ${FONT};color:${C.text}">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px;color:#d4d4d8">${t}</p>`;

function step(icon: string, title: string, text: string) {
  return `<tr><td width="44" valign="top" style="padding:0 0 18px"><div style="width:36px;height:36px;border-radius:10px;background:#232323;text-align:center;font-size:18px;line-height:36px">${icon}</div></td>
  <td valign="top" style="padding:0 0 18px 8px;font:400 14px/1.5 ${FONT};color:${C.muted}"><b style="color:${C.text};font-size:15px">${title}</b><br>${text}</td></tr>`;
}

// ── 1. Bienvenue ─────────────────────────────────────────────────
export function welcomeEmail(o: { name: string; username: string; unsubscribe: string }): Mail {
  const name = esc(o.name);
  const gifts = ([["rose", "Rose", 600], ["diamant", "Diamant", 1000], ["couronne", "Couronne", 2500], ["lion", "Lion", 5000]] as const)
    .map(([g, label, price]) => `<td align="center" width="25%" style="font:400 11px/1.4 ${FONT};color:${C.muted}">
      <img src="${IMG}/${g}.jpg" width="72" height="72" alt="${label}" style="display:block;margin:0 auto 6px;border-radius:14px;border:0">
      <b style="color:${C.text}">${label}</b><br>${fcfa(price)}</td>`).join("");
  const body = `
    ${h1(`Bienvenue sur TubAfrik, ${name} 👋🏾`)}
    ${p("Tu viens de rejoindre la plateforme vidéo pensée pour les créateurs africains. Ici, ton talent est vu… et récompensé.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px">
      ${step("🎬", "Publie tes vidéos", "Gaming, humour, musique, cuisine, beauté… Format vertical, jusqu'à 3 minutes. Mets l'action dès les premières secondes.")}
      ${step("🎁", "Reçois des cadeaux", `Tes fans t'offrent des Roses, Diamants, Couronnes et Lions. <b style="color:${C.gold}">80 % pour toi</b>, retirables en mobile money.`)}
      ${step("🔴", "Passe en live", "Filme ta caméra ou ton écran de jeu, discute avec ta communauté en direct.")}
      ${step("🌍", "Fais-toi découvrir", "Le fil « Pour toi » montre tes vidéos à ceux qui aiment ton style, partout en Afrique.")}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#0f0f0f;border-radius:16px"><tr><td style="padding:16px 8px 6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${gifts}</tr></table>
      <p style="margin:12px 0 8px;text-align:center;font:400 12px ${FONT};color:${C.muted}">Les cadeaux que tes fans peuvent t'offrir</p>
    </td></tr></table>
    <p style="margin:0 0 14px;text-align:center">${button("Publier ma première vidéo", `${SITE_URL}/publier`)}</p>
    <p style="margin:0 0 22px;text-align:center">${button("Compléter mon profil", `${SITE_URL}/profil/modifier`, false)}</p>
    ${p(`<b style="color:${C.text}">Petit conseil :</b> ajoute une photo, une couverture et une bio. Un profil complet donne envie de s'abonner.`)}
    <p style="margin:0;color:${C.muted}">À très vite sur TubAfrik,<br>L'équipe TubAfrik 🧡</p>`;
  return {
    subject: `Bienvenue sur TubAfrik, ${o.name} 🎉`,
    html: layout({ preheader: "Publie, reçois des cadeaux, passe en live : voici comment bien démarrer.", hero: true, body, unsubscribe: o.unsubscribe, reason: `Tu reçois cet email car tu as créé le compte @${o.username} sur TubAfrik.` }),
    text: `Bienvenue sur TubAfrik, ${o.name} !

Tu viens de rejoindre la plateforme vidéo des créateurs africains.

- Publie tes vidéos (format vertical, 3 min max) : ${SITE_URL}/publier
- Reçois des cadeaux de tes fans : 80 % pour toi, retirables en mobile money
- Passe en live avec ta communauté
- Complète ton profil (photo, couverture, bio) : ${SITE_URL}/profil/modifier

À très vite,
L'équipe TubAfrik

Ne plus recevoir ces emails : ${o.unsubscribe}`,
  };
}

// ── 2. Résumé d'activité ─────────────────────────────────────────
export type ActivityItem = {
  kind: "gift" | "follow" | "comment" | "reply";
  actor: string;
  body: string | null;
  amount: number | null;
  giftName: string | null;
  giftEmoji: string | null;
  videoId: string | null;
};

function describe(i: ActivityItem) {
  const who = `<b style="color:${C.text}">${esc(i.actor)}</b>`;
  const quote = (s: string | null) => (s ? `<br><span style="color:${C.muted}">« ${esc(s.slice(0, 140))} »</span>` : "");
  switch (i.kind) {
    case "gift":
      return { icon: i.giftEmoji ?? "🎁", html: `${who} t'a offert ${esc(i.giftName ?? "un cadeau")}${i.amount ? ` <b style="color:${C.gold}">+${fcfa(i.amount)}</b>` : ""}${quote(i.body)}` };
    case "follow":
      return { icon: "👤", html: `${who} s'est abonné à toi` };
    case "reply":
      return { icon: "↩️", html: `${who} a répondu à ton commentaire${quote(i.body)}` };
    default:
      return { icon: "💬", html: `${who} a commenté ta vidéo${quote(i.body)}` };
  }
}

const plain = (i: ActivityItem) =>
  i.kind === "gift" ? `${i.actor} t'a offert ${i.giftName ?? "un cadeau"}${i.amount ? ` (+${fcfa(i.amount)})` : ""}`
  : i.kind === "follow" ? `${i.actor} s'est abonné à toi`
  : i.kind === "reply" ? `${i.actor} a répondu à ton commentaire`
  : `${i.actor} a commenté ta vidéo`;

export function activityEmail(o: { name: string; username: string; items: ActivityItem[]; total: number; unsubscribe: string }): Mail {
  const gifts = o.items.filter((i) => i.kind === "gift");
  const earned = gifts.reduce((n, i) => n + (i.amount ?? 0), 0);
  const follows = o.items.filter((i) => i.kind === "follow").length;
  const first = o.items[0];
  const subject =
    gifts.length ? `🎁 ${gifts[0].actor} t'a offert ${gifts[0].giftName ?? "un cadeau"}${earned ? ` (+${fcfa(earned)})` : ""}`
    : o.total === 1 ? plain(first)
    : follows >= 2 ? `👤 ${follows} nouveaux abonnés sur TubAfrik`
    : `${o.total} nouvelles activités sur TubAfrik`;

  const rows = o.items.map((i) => {
    const d = describe(i);
    const href = i.kind === "follow" || !i.videoId ? `${SITE_URL}/activite` : `${SITE_URL}/v/${i.videoId}`;
    return `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.line}"><a href="${href}" style="text-decoration:none;color:#d4d4d8;font:400 14px/1.5 ${FONT}">
      <span style="display:inline-block;width:28px;font-size:18px;vertical-align:top">${d.icon}</span><span style="display:inline-block;width:88%">${d.html}</span></a></td></tr>`;
  }).join("");
  const more = o.total - o.items.length;

  const body = `
    ${h1(o.total > 1 ? `Ça bouge sur ton compte, ${esc(o.name)} 🔥` : `Du nouveau pour toi, ${esc(o.name)} 🔥`)}
    ${earned ? p(`Tu as gagné <b style="color:${C.gold}">${fcfa(earned)}</b> en cadeaux. Ils seront retirables 3 jours après réception.`) : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px">${rows}</table>
    ${more > 0 ? p(`Et ${more} autre${more > 1 ? "s" : ""} activité${more > 1 ? "s" : ""}…`) : ""}
    <p style="margin:0;text-align:center">${button("Voir mon activité", `${SITE_URL}/activite`)}</p>`;
  return {
    subject,
    html: layout({ preheader: o.items.slice(0, 3).map(plain).join(" · "), body, unsubscribe: o.unsubscribe, reason: `Tu reçois cet email car tu as un compte @${o.username} sur TubAfrik et que tu as de l'activité non lue.` }),
    text: `${o.items.map(plain).join("\n")}${more > 0 ? `\n…et ${more} autre(s)` : ""}\n\nVoir mon activité : ${SITE_URL}/activite\n\nNe plus recevoir ces emails : ${o.unsubscribe}`,
  };
}

// ── 3. Vidéo publiée ─────────────────────────────────────────────
export function publishedEmail(o: { name: string; username: string; videoId: string; caption: string | null; unsubscribe: string }): Mail {
  const url = `${SITE_URL}/v/${o.videoId}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`Regarde ma nouvelle vidéo sur TubAfrik 🔥 ${url}`)}`;
  const body = `
    ${h1("Ta vidéo est en ligne ! 🔥")}
    ${o.caption ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#0f0f0f;color:#d4d4d8">« ${esc(o.caption.slice(0, 160))} »</p>` : ""}
    ${p(`Bravo ${esc(o.name)} ! Les premières heures comptent : partage-la sur ton statut WhatsApp et dans tes groupes pour lancer tes premières vues.`)}
    <p style="margin:0 0 14px;text-align:center">${button("Partager sur WhatsApp", share)}</p>
    <p style="margin:0 0 22px;text-align:center">${button("Voir ma vidéo", url, false)}</p>
    ${p(`<b style="color:${C.text}">Le bon rythme :</b> les créateurs qui publient plusieurs fois par semaine gagnent leurs abonnés bien plus vite.`)}`;
  return {
    subject: "Ta vidéo est en ligne sur TubAfrik 🔥",
    html: layout({ preheader: "Partage-la maintenant pour lancer tes premières vues.", body, unsubscribe: o.unsubscribe, reason: `Tu reçois cet email car tu as publié une vidéo avec le compte @${o.username}.` }),
    text: `Ta vidéo est en ligne !\n\nVoir : ${url}\nPartager sur WhatsApp : ${share}\n\nNe plus recevoir ces emails : ${o.unsubscribe}`,
  };
}
