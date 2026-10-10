// Временная заглушка: реализацию пишет лейн B (контент).
import type { Plugin } from 'vite';

export default function content(): Plugin {
  const id = 'virtual:content';
  return {
    name: 'content',
    resolveId: (s) => (s === id ? '\0' + id : undefined),
    load: (s) => (s === '\0' + id ? 'export default { title: "", stops: [] };' : undefined),
  };
}
