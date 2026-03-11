export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    // youtu.be/<id>
    if (/youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && id.length === 11 ? id : null;
    }

    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;

    // youtube.com/embed/<id>
    const embedMatch = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    // youtube.com/shorts/<id>
    const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Fallback regex
    const m = url.match(/(?:embed\/|v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  } catch {
    const m = url.match(/(?:embed\/|v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }
}

export function toYouTubeEmbedBaseUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  // nocookie = fewer restrictions and cleaner embeds
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
