import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════
// LIAISON SITE ↔ APP ANDROID (Digital Asset Links)
//
// Prouve à Android que l'app du Play Store appartient bien au site:
// sans ce fichier, l'app (TWA) s'ouvrirait avec une barre d'adresse.
// Les empreintes SHA-256 du certificat de signature se trouvent dans
// la Play Console (Intégrité de l'app → Signature de l'app); plusieurs
// empreintes séparées par des virgules (clé Google + clé d'envoi).
// ═══════════════════════════════════════════════════════════════
export const dynamic = "force-dynamic";

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME ?? "com.tubafrik.app";
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",").map((f) => f.trim().toUpperCase()).filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  return NextResponse.json(
    fingerprints.length
      ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
      : [],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
