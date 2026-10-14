import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mesa · Restaurant OS",
  description: "Servicio, caja y gestión de restaurante",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
