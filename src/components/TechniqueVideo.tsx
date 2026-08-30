'use dom';

type Props = {
  url: string;
  dom: import('expo/dom').DOMProps;
};

function youtubeId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host.endsWith('youtube.com')) {
      const direct = parsed.searchParams.get('v');
      if (direct) return direct;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((part) => part === 'shorts' || part === 'embed');
      if (marker >= 0) return parts[marker + 1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export default function TechniqueVideo({ url }: Props) {
  const id = youtubeId(url);

  if (!id) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#121510', color: '#8A9082', fontFamily: 'system-ui, sans-serif', fontWeight: 700 }}>
        Video link unavailable
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0B0D0A' }}>
      <iframe
        title="Exercise technique video"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&modestbranding=1`}
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
