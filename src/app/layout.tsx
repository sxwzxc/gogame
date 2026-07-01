import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Go + EdgeOne Pages",
  description: "Go Functions allow you to run Go code on EdgeOne Pages using file-based routing. Each .go file in cloud-functions/ maps to an HTTP endpoint automatically.",
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
