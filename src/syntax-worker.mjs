import { checkSyntax } from './syntax.mjs';
import { attachSyntaxFixes } from './syntax-fixes.mjs';
self.postMessage({ ready: true });
self.onmessage = event => {
  const { id, language, a, b } = event.data;
  try {
    const check = source => attachSyntaxFixes(source, language, checkSyntax(source, language), checkSyntax);
    self.postMessage({ id, a: check(a), b: check(b) });
  } catch {
    self.postMessage({ id, failed: true });
  }
};
