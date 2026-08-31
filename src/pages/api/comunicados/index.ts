import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../lib/auth';
import { savePost, getAllPosts } from '../../../lib/posts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const posts = getAllPosts(true);
  return new Response(JSON.stringify({ success: true, posts }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await request.json();

    if (!data.title || !data.title.trim()) {
      return new Response(JSON.stringify({ error: 'El título del comunicado es obligatorio' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!data.textBlock1 || !data.textBlock1.trim()) {
      return new Response(JSON.stringify({ error: 'El primer bloque de texto es obligatorio' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const savedPost = savePost({
      id: data.id ? Number(data.id) : undefined,
      title: data.title,
      slug: data.slug,
      date: data.date,
      excerpt: data.excerpt,
      categories: data.categories || [{ name: 'Informaciones', slug: 'informaciones' }],
      topImage: data.topImage || null,
      topImageAlt: data.topImageAlt || null,
      textBlock1: data.textBlock1,
      middleImage: data.middleImage || null,
      middleImageCaption: data.middleImageCaption || null,
      textBlock2: data.textBlock2 || '',
      is_draft: !!data.isDraft,
    });

    return new Response(JSON.stringify({ success: true, post: savedPost }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Error al guardar comunicado: ' + (err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
