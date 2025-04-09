/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    // Next.js 15.2.5 doesn't support serverActions as a boolean
    // serverActions: true,
  },

  // Configure Static Site Generation with revalidation
  // This allows us to pre-render pages at build time
  // while also updating them periodically
  staticPageGenerationTimeout: 180, // 3 minutes timeout for page generation
  
  // Images configuration
  images: {
    domains: ['localhost'], // Add any other domains where images might be hosted
  },
  
  // Configure for production environment
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
  
  // The global revalidate option is not supported in Next.js 15.2.5
  // We'll set it at the page level instead
};

export default nextConfig; 