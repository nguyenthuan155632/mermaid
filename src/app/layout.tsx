import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProviderWrapper } from "@/components/ThemeProvider";
import { SessionProviderWrapper } from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProviderWrapper>
          <ThemeProviderWrapper>
            {children}
          </ThemeProviderWrapper>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

