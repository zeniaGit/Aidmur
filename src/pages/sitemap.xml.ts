import { getAllPosts } from '../lib/posts';
import pages from '../data/pages.json';
import categories from '../data/categories.json';

export async function GET() {
  const siteUrl = 'https://aidmur.org';

  const staticUrls = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${siteUrl}/articulos`, priority: '0.9', changefreq: 'daily' },
  ];

  const pageUrls = pages.map((p) => ({
    loc: `${siteUrl}/pagina/${p.slug}`,
    priority: '0.8',
    changefreq: 'monthly',
  }));

  const categoryUrls = categories.map((c) => ({
    loc: `${siteUrl}/categoria/${c.slug}`,
    priority: '0.7',
    changefreq: 'weekly',
  }));

  const posts = getAllPosts(false);
  const postUrls = posts.map((p) => ({
    loc: `${siteUrl}/articulo/${p.slug}`,
    lastmod: p.date ? new Date(p.date).toISOString().split('T')[0] : undefined,
    priority: '0.6',
    changefreq: 'monthly',
  }));

  const allUrls = [...staticUrls, ...pageUrls, ...categoryUrls, ...postUrls];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemapXml.trim(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
