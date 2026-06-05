/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pg', 'bcrypt'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  compress: true,
  // Transpile Three.js packages so Next.js handles their ES module imports
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Proxy /api/v1/* → NestJS API container (server-side only).
  // This means NEXT_PUBLIC_API_URL can be the relative path '/api/v1' and
  // the browser never calls NestJS directly — all calls stay same-origin.
  //
  // Proxy /uploads/* → NestJS API container so product images served by NestJS
  // are accessible when all traffic is routed through the web container.
  //
  // Proxy /socket.io/* → NestJS for real-time WebSocket (socket.io) support.
  async rewrites() {
    const nestjsBase =
      process.env.API_INTERNAL_URL || 'http://localhost:3001';
    return [
      // NestJS REST API (no /api/v1 prefix in NestJS — stripped by this rewrite)
      {
        source: '/api/v1/:path*',
        destination: `${nestjsBase}/:path*`,
      },
      // NestJS static file uploads (product images stored by the API container)
      {
        source: '/uploads/:path*',
        destination: `${nestjsBase}/uploads/:path*`,
      },
      // NestJS WebSocket / socket.io transport
      {
        source: '/socket.io/:path*',
        destination: `${nestjsBase}/socket.io/:path*`,
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Allow images from any hostname so product images from external retailers
    // (Amazon, Flipkart, Unsplash, placeholder services, CDNs, etc.) all render.
    // Locked-down per-hostname patterns are kept for the most common sources;
    // the catch-all pattern covers dynamic retailer CDN hostnames.
    remotePatterns: [
      // Placeholder / mock image services
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
      { protocol: 'https', hostname: 'placeholder.com' },
      { protocol: 'https', hostname: 'dummyimage.com' },
      // Random image generators (used by DB migration r57 to populate imageUrl)
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      // Unsplash (used heavily in seed data / mock catalog)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // GitHub user content (avatars, etc.)
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      // Amazon product images
      { protocol: 'https', hostname: '**.amazon.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      // Flipkart product images
      { protocol: 'https', hostname: '**.flixcart.com' },
      { protocol: 'https', hostname: '**.flipkart.com' },
      // Other common CDNs / retailers used in product data
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.imgix.net' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      // Local NestJS API uploads accessible via the /uploads/ rewrite above
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
