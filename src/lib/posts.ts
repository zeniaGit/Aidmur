import fs from 'node:fs';
import path from 'node:path';

export interface PostCategory {
  name: string;
  slug: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  date: string; // YYYY-MM-DD HH:mm:ss
  author?: string;
  excerpt: string;
  content: string; // Formatted HTML content
  categories: PostCategory[];
  tags?: Array<{ name: string; slug: string }>;
  featured_image?: string | null;
  top_image?: string | null;
  top_image_alt?: string | null;
  text_block_1?: string;
  middle_image?: string | null;
  middle_image_caption?: string | null;
  text_block_2?: string;
  is_draft?: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_POSTS_FILE = path.join(process.cwd(), 'src/data/posts.json');
const CUSTOM_POSTS_FILE = path.join(process.cwd(), 'src/data/custom-posts.json');

let cachedDefaultPosts: Post[] | null = null;

function readDefaultPosts(): Post[] {
  if (cachedDefaultPosts) return cachedDefaultPosts;
  try {
    if (fs.existsSync(DEFAULT_POSTS_FILE)) {
      const data = fs.readFileSync(DEFAULT_POSTS_FILE, 'utf-8');
      cachedDefaultPosts = JSON.parse(data) || [];
      return cachedDefaultPosts || [];
    }
  } catch (error) {
    console.error('Error reading posts.json:', error);
  }
  return [];
}

function readCustomPosts(): Post[] {
  try {
    if (fs.existsSync(CUSTOM_POSTS_FILE)) {
      const data = fs.readFileSync(CUSTOM_POSTS_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (error) {
    console.error('Error reading custom-posts.json:', error);
  }
  return [];
}

function writeCustomPosts(posts: Post[]): void {
  try {
    const dir = path.dirname(CUSTOM_POSTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing custom-posts.json:', error);
    throw error;
  }
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics/accents
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildArticleHtml(options: {
  topImage?: string | null;
  topImageAlt?: string | null;
  textBlock1: string;
  middleImage?: string | null;
  middleImageCaption?: string | null;
  textBlock2?: string;
}): string {
  const parts: string[] = [];

  // Top image if provided
  if (options.topImage) {
    const alt = options.topImageAlt ? options.topImageAlt.replace(/"/g, '&quot;') : '';
    parts.push(
      `<div class="article-top-image-wrapper" style="margin: 1.5rem 0 2rem; text-align: center;">\n` +
      `  <img src="${options.topImage}" alt="${alt}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.06);" />\n` +
      `</div>`
    );
  }

  // Text block 1
  if (options.textBlock1) {
    const formattedBlock1 = options.textBlock1
      .split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('\n\n');
    parts.push(formattedBlock1);
  }

  // Intermediate image if provided
  if (options.middleImage) {
    const captionHtml = options.middleImageCaption
      ? `<figcaption style="font-size: 0.88rem; color: #64748b; margin-top: 0.5rem; text-align: center; font-style: italic;">${options.middleImageCaption}</figcaption>`
      : '';
    parts.push(
      `<figure class="article-middle-image-wrapper" style="margin: 2rem 0; text-align: center;">\n` +
      `  <img src="${options.middleImage}" alt="${options.middleImageCaption ? options.middleImageCaption.replace(/"/g, '&quot;') : ''}" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" />\n` +
      `  ${captionHtml}\n` +
      `</figure>`
    );
  }

  // Text block 2
  if (options.textBlock2) {
    const formattedBlock2 = options.textBlock2
      .split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('\n\n');
    parts.push(formattedBlock2);
  }

  return parts.join('\n\n');
}

export function getAllPosts(includeDrafts: boolean = false): Post[] {
  const defaultPosts = readDefaultPosts();
  const custom = readCustomPosts();
  const customSlugs = new Set(custom.map(p => p.slug));
  const customIds = new Set(custom.map(p => p.id));

  // Merge default posts that haven't been overridden
  const basePosts = defaultPosts.filter(p => !customSlugs.has(p.slug) && !customIds.has(p.id));
  const combined = [...custom, ...basePosts];

  const filtered = includeDrafts ? combined : combined.filter(p => !p.is_draft);

  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string, includeDrafts: boolean = false): Post | undefined {
  const all = getAllPosts(includeDrafts);
  return all.find(p => p.slug === slug);
}

export function getPostById(id: number): Post | undefined {
  const all = getAllPosts(true);
  return all.find(p => p.id === id);
}

export function savePost(data: {
  id?: number;
  title: string;
  slug?: string;
  date?: string;
  excerpt?: string;
  categories: PostCategory[];
  topImage?: string | null;
  topImageAlt?: string | null;
  textBlock1: string;
  middleImage?: string | null;
  middleImageCaption?: string | null;
  textBlock2?: string;
  content?: string;
  is_draft?: boolean;
}): Post {
  const custom = readCustomPosts();
  const now = new Date();
  const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const generatedContent = data.content || buildArticleHtml({
    topImage: data.topImage,
    topImageAlt: data.topImageAlt,
    textBlock1: data.textBlock1,
    middleImage: data.middleImage,
    middleImageCaption: data.middleImageCaption,
    textBlock2: data.textBlock2,
  });

  const generatedExcerpt = data.excerpt || (
    data.textBlock1
      ? data.textBlock1.slice(0, 160).trim() + '...'
      : data.title
  );

  let targetId = data.id;
  let targetSlug = data.slug ? slugify(data.slug) : slugify(data.title);

  if (!targetId) {
    const allPosts = getAllPosts(true);
    const maxId = allPosts.reduce((max, p) => (p.id > max ? p.id : max), 2000);
    targetId = maxId + 1;
  }

  // Ensure unique slug if new or modified
  const existingWithSlug = custom.find(p => p.slug === targetSlug && p.id !== targetId);
  if (existingWithSlug) {
    targetSlug = `${targetSlug}-${Date.now().toString().slice(-4)}`;
  }

  const post: Post = {
    id: targetId,
    title: data.title.trim(),
    slug: targetSlug,
    date: data.date || formattedNow,
    excerpt: generatedExcerpt,
    content: generatedContent,
    categories: data.categories && data.categories.length > 0 ? data.categories : [{ name: 'Informaciones', slug: 'informaciones' }],
    tags: [],
    featured_image: data.topImage || null,
    top_image: data.topImage || null,
    top_image_alt: data.topImageAlt || null,
    text_block_1: data.textBlock1,
    middle_image: data.middleImage || null,
    middle_image_caption: data.middleImageCaption || null,
    text_block_2: data.textBlock2,
    is_draft: !!data.is_draft,
    created_at: data.date || formattedNow,
    updated_at: formattedNow,
  };

  const existingIndex = custom.findIndex(p => p.id === targetId);
  if (existingIndex >= 0) {
    custom[existingIndex] = { ...custom[existingIndex], ...post };
  } else {
    custom.unshift(post);
  }

  writeCustomPosts(custom);
  return post;
}

export function deletePost(id: number): boolean {
  const custom = readCustomPosts();
  const filtered = custom.filter(p => p.id !== id);
  if (filtered.length !== custom.length) {
    writeCustomPosts(filtered);
    return true;
  }
  return false;
}
