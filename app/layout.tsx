import "./globals.css";
import type { Metadata } from "next";
import { SessionProvider } from "./components/SessionProvider";

export const metadata: Metadata = {
  title: "CSRARS - Cyber Security Risk Analysis & Reporting System",
  description: "cybersecurity risk analysis and reporting",
  icons: {
    icon: "/logo2.png",
    shortcut: "/logo2.png",
    apple: "/logo2.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

