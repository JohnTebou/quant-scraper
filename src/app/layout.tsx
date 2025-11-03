import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quant Scraper",
  description: "Web scraper for quantguide.io problems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}






