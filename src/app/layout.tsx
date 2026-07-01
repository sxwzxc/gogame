import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "台球大师 · Pool Master",
  description: "一个基于 HTML5 Canvas 的 8 球台球小游戏，支持双人对战、真实物理碰撞与完整 8 球规则。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <head>
        <link rel="icon" href="/go-favicon.svg" />
      </head>
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
