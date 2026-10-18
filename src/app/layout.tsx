import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloom.fit",
  ),
  title: "Bloom – Training und Ernährung, die sich an dich anpassen",
  description:
    "Bloom ist die Trainings- und Ernährungs-App für Frauen, die ernsthaft Krafttraining machen. Sie passt sich an deine eigenen Daten an – über den ganzen Zyklus.",
  openGraph: { locale: "de_DE", type: "website", siteName: "Bloom" },
};

export const viewport: Viewport = { themeColor: "#e11d48" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        {plausible && (
          <Script
            defer
            data-domain={plausible}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
