import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { getAdminSession } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No se ha proporcionado ninguna imagen' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate mime type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validMimes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato de imagen no compatible (use JPG, PNG, WEBP o GIF)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'El tamaño de la imagen no puede superar 5 MB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = path.extname(file.name) || (file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg');
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const fileName = `${Date.now()}-${cleanBase}${ext}`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, buffer);

      return new Response(JSON.stringify({
        success: true,
        url: `/uploads/${fileName}`,
        fileName: fileName,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (writeErr) {
      // In serverless / read-only filesystem environments, fallback to Data URL
      console.warn('Filesystem write failed, falling back to data URL:', writeErr);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;
      return new Response(JSON.stringify({
        success: true,
        url: dataUrl,
        fileName: fileName,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Error al subir la imagen: ' + (err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
