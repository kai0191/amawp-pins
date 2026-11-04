import { HttpError, json, readJson } from '../lib/http.js';
import { requireUser, isAdmin } from '../lib/auth.js';

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (!isAdmin(env, user)) throw new HttpError(403, 'Owner only.', 'FORBIDDEN');
  return user;
}

export async function overview(request, env) {
  await requireAdmin(request, env);
  const weekAgo = Date.now() - 7 * 86400000;
  const totals = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE created_at > ?1) AS users_7d,
      (SELECT COUNT(*) FROM pinterest_accounts) AS accounts,
      (SELECT COUNT(*) FROM pins WHERE status='posted') AS posted,
      (SELECT COUNT(*) FROM pins WHERE status='posted' AND posted_at > ?1) AS posted_7d,
      (SELECT COUNT(*) FROM pins WHERE status='scheduled') AS scheduled,
      (SELECT COUNT(*) FROM pins WHERE status='failed') AS failed,
      (SELECT COUNT(*) FROM waitlist) AS waitlist`,
  ).bind(weekAgo).first();
  const demand = await env.DB.prepare('SELECT feature, COUNT(*) AS n FROM waitlist GROUP BY feature ORDER BY n DESC').all();
  const users = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan_id, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM pinterest_accounts a WHERE a.user_id = u.id) AS accounts,
      (SELECT COUNT(*) FROM pins p WHERE p.user_id = u.id AND p.status = 'posted') AS posted,
      (SELECT COUNT(*) FROM pins p WHERE p.user_id = u.id AND p.status = 'scheduled') AS scheduled
     FROM users u ORDER BY u.created_at DESC LIMIT 200`,
  ).all();
  const waitlist = await env.DB.prepare('SELECT email, feature, note, created_at FROM waitlist ORDER BY created_at DESC LIMIT 300').all();
  const failures = await env.DB.prepare(
    `SELECT l.at, l.message, u.email FROM post_log l JOIN users u ON u.id = l.user_id WHERE l.ok = 0 ORDER BY l.at DESC LIMIT 50`,
  ).all();
  const plans = await env.DB.prepare('SELECT * FROM plans').all();
  return json({ totals, demand: demand.results, users: users.results, waitlist: waitlist.results, failures: failures.results, plans: plans.results });
}

export async function setUserPlan(request, env, { id }) {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const plan = await env.DB.prepare('SELECT id FROM plans WHERE id = ?').bind(String(body.planId || '')).first();
  if (!plan) throw new HttpError(400, 'Unknown plan.', 'BAD_PLAN');
  await env.DB.prepare('UPDATE users SET plan_id = ? WHERE id = ?').bind(plan.id, id).run();
  return json({ ok: true });
}
