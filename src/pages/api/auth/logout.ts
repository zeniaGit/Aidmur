import type { APIRoute } from 'astro';
import { getClearSessionCookieHeader } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': getClearSessionCookieHeader(),
    },
  });
};

export const GET: APIRoute = async ({ redirect }) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': getClearSessionCookieHeader(),
    },
  });
};
