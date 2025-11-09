import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProviderWrapper } from "@/components/ThemeProvider";
import { SessionProviderWrapper } from "@/components/SessionProvider";
import ErrorSuppressor from "@/components/ErrorSuppressor";

const recursive = localFont({
  src: [
    {
      path: "../../public/fonts/recursive-latin-crsv-normal.woff2",
      style: "normal",
      weight: "400",
    },
  ],
  variable: "--font-recursive",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mermaid Diagram Editor",
  description: "Create and edit Mermaid diagrams",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${recursive.className} ${recursive.variable}`}>
        <ErrorSuppressor />
        <SessionProviderWrapper>
          <ThemeProviderWrapper>
            {children}
          </ThemeProviderWrapper>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
