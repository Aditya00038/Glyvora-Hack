import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Glyvora',
    short_name: 'Glyvora',
    description: 'AI-powered glucose predictions and meal guidance for Type-2 diabetics.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f3f0',
    theme_color: '#10b981',
    categories: ['health', 'lifestyle', 'productivity'],
    icons: [
      {
        src: '/Glyvora-icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/Glyvora-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
