import type { Metadata } from "next";


export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" }
    ],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icon.png" }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}