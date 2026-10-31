import type { MetadataRoute } from 'next';
import { APP_URL } from './layout';

// The application surface owns its own sitemap entry. The marketing page at
// the domain root (rhsaisolutions.com) is a separate deploy-time surface and
// will carry its own sitemap once the old site is merged.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
