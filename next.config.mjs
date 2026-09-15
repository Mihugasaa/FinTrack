/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the dev-only on-screen indicator; it overlaps the mobile bottom nav.
  devIndicators: false,
  // pdf-parse arrastra pdfjs, que rompe si Next lo empaqueta en la función
  // serverless. Se deja como require de Node en runtime para que la ruta de
  // conciliación no crashee al cargar en Vercel.
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
