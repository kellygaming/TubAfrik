import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { SITE_URL } from "@/lib/format";
import { getSession } from "@/lib/session";
import { SessionProvider } from "@/components/session";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TubAfrik — les shorts des gamers africains", template: "%s · TubAfrik" },
  description:
    "Partage tes meilleurs clips Free Fire, eFootball, CODM… La plateforme de vidéos courtes des gamers d'Afrique.",
  applicationName: "TubAfrik",
  appleWebApp: { capable: true, title: "TubAfrik", statusBarStyle: "black-translucent" },
  openGraph: { siteName: "TubAfrik", locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#07070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { user, profile } = await getSession();
  return (
    <html lang="fr" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* La clé remonte le fournisseur quand on se connecte ou crée son profil. */}
        <SessionProvider key={profile?.username ?? user?.id ?? "invite"} initial={{ userId: user?.id ?? null, profile }}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
