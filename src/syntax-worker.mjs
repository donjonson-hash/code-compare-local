import { checkSyntax } from './syntax.mjs';
self.postMessage({ ready: true });
self.onmessage = event => {
  const { id, language, a, b } = event.data;
  try {
    self.postMessage({ id, a: checkSyntax(a, language), b: checkSyntax(b, language) });
  } catch {
    self.postMessage({ id, failed: true });
  }
};
