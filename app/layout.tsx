import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generator Harmonogramu Pracy",
  description: "Generuj optymalny harmonogram pracy dla grupy osób podczas wielodobowej wycieczki",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
