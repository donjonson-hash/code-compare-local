import assert from 'node:assert/strict';

// Inspect actual rendered tokens after the JavaScript demo, not generated
// class names or the source palette. This also catches stale/light bundles.
export async function checkStudioContrast(page) {
  for (const side of ['A', 'B']) {
    const samples = await page.getByRole('textbox', { name: `Code ${side}`, exact: true }).evaluate(editor => {
      const rgb = color => {
        const parts = color.match(/[\d.]+/g);
        if (!/^rgba?\(/.test(color) || !parts || parts.length < 3)
          throw new Error(`Unexpected computed color: ${color}`);
        if (parts.length === 4 && Number(parts[3]) !== 1)
          throw new Error(`Expected an opaque code pane/token: ${color}`);
        return parts.slice(0, 3).map(Number);
      };
      const luminance = color => rgb(color).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
      const background = getComputedStyle(editor.closest('.cm-editor')).backgroundColor;
      const backgroundLuminance = luminance(background);
      const leaves = [...editor.querySelectorAll('span')].filter(node => !node.children.length);
      return [
        ['keyword', /^(function|const|return)$/],
        ['string', /Notebook/],
        ['number', /^(0\.20|0\.18|12)$/],
      ].map(([kind, pattern]) => ({
        kind,
        tokens: leaves.filter(node => pattern.test(node.textContent)).map(node => {
          const color = getComputedStyle(node).color;
          const foregroundLuminance = luminance(color);
          const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
            (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
          return { text: node.textContent, color, background, ratio };
        }),
      }));
    });
    for (const sample of samples) {
      assert.ok(sample.tokens.length, `Code ${side}: ${sample.kind} tokens must be rendered`);
      for (const token of sample.tokens)
        assert.ok(token.ratio >= 4.5,
          `Code ${side} ${sample.kind} ${JSON.stringify(token.text)}: ${token.color} on ${token.background} has ${token.ratio.toFixed(2)}:1 contrast; expected at least 4.5:1`);
    }
  }
}
