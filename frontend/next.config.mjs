import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  async redirects() {
    const hall = 'https://sulyap-lasalyano.vercel.app'
    return [
      { source: '/', destination: `${hall}/`, permanent: false },
      { source: '/scan', destination: `${hall}/scan`, permanent: false },
      { source: '/browse', destination: `${hall}/`, permanent: false },
      { source: '/browse/:path*', destination: `${hall}/`, permanent: false },
      { source: '/knowledge-graph', destination: `${hall}/knowledge-graph`, permanent: false },
      { source: '/onboarding', destination: `${hall}/`, permanent: false },
      { source: '/related', destination: `${hall}/`, permanent: false },
      { source: '/artifacts/:path*', destination: `${hall}/`, permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  // onnxruntime-web / MediaPipe pull large assets; keep warnings quiet in CI.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
