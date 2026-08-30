import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  url: string;
};

function youtubeId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host.endsWith('youtube.com')) {
      const direct = parsed.searchParams.get('v');
      if (direct) return direct;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex(
        (part) => part === 'shorts' || part === 'embed'
      );

      if (marker >= 0) {
        return parts[marker + 1] ?? null;
      }
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
      <View style={styles.unavailable}>
        <Text style={styles.unavailableText}>Video link unavailable</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{
        uri: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
          id
        )}?playsinline=1&rel=0&modestbranding=1`,
      }}
      style={styles.webview}
      javaScriptEnabled
      domStorageEnabled
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#0B0D0A',
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121510',
  },
  unavailableText: {
    color: '#8A9082',
    fontWeight: '700',
  },
});