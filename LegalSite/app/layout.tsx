import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://docvia-privacidade.pages.dev";
  return {
    metadataBase: new URL(origin),
    title: { default: "DocVia | Privacidade e suporte", template: "%s | DocVia" },
    description: "Central pública de privacidade, termos e exclusão de conta do DocVia.",
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: { title: "DocVia | Privacidade e transparência", description: "Seus documentos. Suas escolhas.", url: origin, siteName: "DocVia", locale: "pt_BR", type: "website", images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "DocVia — Privacidade e transparência" }] },
    twitter: { card: "summary_large_image", title: "DocVia | Privacidade e transparência", description: "Seus documentos. Suas escolhas.", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
