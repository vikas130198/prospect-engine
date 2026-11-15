// Engine 1 helper: official Instagram Graph API "Business Discovery" lookup (optional).
// No scraping, no logins, no cookies. Works only for Business/Creator accounts.
import { loadConfig, readSecrets } from './config.mjs';

export async function instagramLookup(w, username) {
  const s = readSecrets(w);
  if (!s.META_ACCESS_TOKEN || !s.META_IG_USER_ID) {
    return {
      available: false,
      reason: 'Official Instagram API is not configured (optional).',
      fallback: 'Use public search results, the public profile page if it loads, and screenshots the user pastes. Record anything you cannot confirm as "unknown".',
    };
  }
  const version = loadConfig(w).integrations.meta_graph_version || 'v23.0';
  const fields = `business_discovery.username(${username}){username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url,media.limit(12){caption,like_count,comments_count,timestamp,media_type,permalink}}`;
  const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(s.META_IG_USER_ID)}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', s.META_ACCESS_TOKEN);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (e) {
    return { available: false, reason: `Could not reach the Instagram API: ${e.message}` };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = data.error?.message || `HTTP ${res.status}`;
    const personal = /cannot be found|does not exist|business/i.test(msg);
    return {
      available: false,
      reason: personal ? 'This account is not a Business/Creator account (or does not exist), so the official API cannot read it.' : `Instagram API error: ${msg}`,
      expired: /expired|session/i.test(msg),
    };
  }
  const bd = data.business_discovery || {};
  const media = bd.media?.data || [];
  const dates = media.map((m) => new Date(m.timestamp)).sort((a, b) => b - a);
  let postsPerWeek = null;
  if (dates.length >= 2) {
    const days = (dates[0] - dates[dates.length - 1]) / 86400000;
    postsPerWeek = days > 0 ? Math.round((dates.length / days) * 7 * 10) / 10 : null;
  }
  const avg = (k) => (media.length ? Math.round(media.reduce((t, m) => t + (m[k] || 0), 0) / media.length) : null);
  const er = bd.followers_count && media.length ? Math.round(((avg('like_count') + avg('comments_count')) / bd.followers_count) * 10000) / 100 : null;
  return {
    available: true,
    source: 'Instagram Graph API (Business Discovery) — verified',
    username: bd.username,
    name: bd.name,
    biography: bd.biography,
    website: bd.website || null,
    followers: bd.followers_count ?? null,
    following: bd.follows_count ?? null,
    posts: bd.media_count ?? null,
    recent_posts: media.slice(0, 12).map((m) => ({
      date: m.timestamp?.slice(0, 10),
      type: m.media_type,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      caption: (m.caption || '').slice(0, 160),
      url: m.permalink,
    })),
    last_post: dates[0]?.toISOString().slice(0, 10) || null,
    posts_per_week: postsPerWeek,
    avg_likes: avg('like_count'),
    avg_comments: avg('comments_count'),
    engagement_rate_percent: er,
  };
}
