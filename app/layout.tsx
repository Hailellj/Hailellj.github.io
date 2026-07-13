import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hailellj.github.io"),
  title: {
    default: "廖丽君 Haile | AI Marketing & GTM",
    template: "%s | 廖丽君 Haile",
  },
  description: "廖丽君 Haile 的 AI Marketing & GTM 个人简历。",
  icons: {
    icon: "/portrait.png",
    apple: "/portrait.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
