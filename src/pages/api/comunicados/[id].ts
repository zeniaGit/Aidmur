import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../lib/auth';
import { getPostById, deletePost } from '../../../lib/posts';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'ID no válido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const post = getPostById(id);
  if (!post) {
    return new Response(JSON.stringify({ error: 'Comunicado no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, post }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'ID no válido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = deletePost(id);
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'No se pudo eliminar el comunicado o no existe en la base personalizada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, message: 'Comunicado eliminado correctamente' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
