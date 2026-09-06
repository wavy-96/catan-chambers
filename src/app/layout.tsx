import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
const crimson = localFont({
  src: [
    {
      path: "../assets/fonts/CrimsonPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/CrimsonPro-Semibold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-crimson",
  display: "swap",
});
const macondo = localFont({
  src: "../assets/fonts/Macondo-Regular.ttf",
  weight: "400",
  variable: "--font-macondo",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Catan Chambers",
  description: "Catan scores, seasons, and player stats.",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chambers",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcf9f2",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${crimson.variable} ${macondo.variable}`}>
        {children}
      </body>
    </html>
  );
}
