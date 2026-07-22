/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",            // fully static site — deploys to Cloudflare Pages / any static host
  trailingSlash: true,         // /city/delhi/ style URLs
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
