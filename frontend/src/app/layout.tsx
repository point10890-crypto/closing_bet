import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Korean Market - AI Stock Analysis",
  description: "VCP Pattern & Institutional Flow Tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
