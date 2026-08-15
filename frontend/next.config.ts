import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root; without it Turbopack walks up and finds an
  // unrelated lockfile outside the repository.
  turbopack: { root: path.resolve(__dirname) },

  images: {
    // Seeded sample listings use deterministic placeholder photography.
    remotePatterns: [
      // Uploaded listing photos.
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
