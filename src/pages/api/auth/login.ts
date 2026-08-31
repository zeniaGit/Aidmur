import type { APIRoute } from 'astro';
import { validateCredentials, createSessionToken, getSessionCookieHeader } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Usuario y contraseña requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isValid = validateCredentials(username, password);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Usuario o contraseña incorrectos' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = await createSessionToken(username);
    const cookieHeader = getSessionCookieHeader(token);

    return new Response(JSON.stringify({ success: true, message: 'Sesión iniciada con éxito' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Error al procesar la solicitud: ' + (err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
