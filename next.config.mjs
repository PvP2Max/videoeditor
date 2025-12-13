/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    typedRoutes: true,
    serverActions: {
      bodySizeLimit: "50mb"
    }
  }
};

export default nextConfig;
