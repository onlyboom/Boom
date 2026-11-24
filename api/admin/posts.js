import { requireAdmin } from '../_lib/auth.js';
import { formatDbWriteError, getServerDb } from '../_lib/db.js';
import { getQuery, readJsonBody, sendJson, slugifyVi } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const { db, hasServiceRole } = getServerDb();

  try {
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('zaloshop_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (/Could not find the table|relation .* does not exist/i.test(error.message || '')) {
          return sendJson(res, 200, { ok: true, posts: [], tableReady: false });
        }
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, posts: data || [], tableReady: true });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const title = String(body.title || '').trim();
      const content = String(body.content || '').trim();
      if (!title || !content) {
        return sendJson(res, 400, { ok: false, error: 'Tiêu đề và nội dung bài viết không được để trống.' });
      }

      const payload = {
        slug: body.slug ? slugifyVi(body.slug) : slugifyVi(title),
        title,
        category: String(body.category || 'Tin kho hàng').trim(),
        excerpt: String(body.excerpt || '').trim(),
        content,
        cover_url: String(body.cover_url || '').trim() || '/ag-logo.jpg',
        published: body.published !== false
      };

      const { data, error } = await db.from('zaloshop_posts').insert([payload]).select().single();
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, post: data });
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const id = String(body.id || '').trim();
      if (!id) return sendJson(res, 400, { ok: false, error: 'Thiếu ID bài viết.' });

      const patch = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.slug !== undefined) patch.slug = slugifyVi(body.slug);
      if (body.category !== undefined) patch.category = String(body.category).trim();
      if (body.excerpt !== undefined) patch.excerpt = String(body.excerpt).trim();
      if (body.content !== undefined) patch.content = String(body.content).trim();
      if (body.cover_url !== undefined) patch.cover_url = String(body.cover_url).trim() || '/ag-logo.jpg';
      if (body.published !== undefined) patch.published = Boolean(body.published);

      const { data, error } = await db
        .from('zaloshop_posts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, post: data });
    }

    if (req.method === 'DELETE') {
      const { id = '' } = getQuery(req);
      let targetId = String(id || '').trim();
      if (!targetId) {
        const body = await readJsonBody(req).catch(() => ({}));
        targetId = String(body.id || '').trim();
      }
      if (!targetId) return sendJson(res, 400, { ok: false, error: 'Thiếu ID bài viết cần xóa.' });

      const { error } = await db.from('zaloshop_posts').delete().eq('id', targetId);
      if (error) {
        return sendJson(res, 500, { ok: false, error: formatDbWriteError(error, hasServiceRole) });
      }
      return sendJson(res, 200, { ok: true, deletedId: targetId });
    }

    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Lỗi server xử lý bài viết' });
  }
}
