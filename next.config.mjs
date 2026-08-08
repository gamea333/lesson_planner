/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "tesseract.js",
      "@napi-rs/canvas",
      "@netlify/blobs",
    ],
  },
};

export default nextConfig;
