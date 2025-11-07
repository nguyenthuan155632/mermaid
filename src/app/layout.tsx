import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProviderWrapper } from "@/components/ThemeProvider";
import { SessionProviderWrapper } from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mermaid Diagram Editor",
  description: "Create and edit Mermaid diagrams",
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

