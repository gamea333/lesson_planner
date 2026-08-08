import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LessonPlanner",
  description: "Turn your question bank into a ready lesson plan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <Providers>
          <Navbar />
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
