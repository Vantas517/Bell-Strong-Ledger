import "./globals.css";

export const metadata = {
  title: "Vantas Ledger",
  description: "Client tracking for Vantas Group personal training",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
