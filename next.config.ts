import type { NextConfig } from "next";

const requiredEnvs = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SHADOWFAX_API_TOKEN'
];

if (process.env.NODE_ENV === 'production') {
  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      throw new Error(`Build failed: Missing required environment variable ${env}`);
    }
  }
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'goowpzynxlohbbrfqqng.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
