import { StateField, StateEffect } from '@codemirror/state';
import { invertedEffects } from '@codemirror/commands';
import { makeDocument, applyEdits } from './document.mjs';

export const restoreRaw = StateEffect.define();
export const rawField = StateField.define({
  create: () => makeDocument(),
  update(value, transaction) {
    const overrides = transaction.effects.filter(e => e.is(restoreRaw));
    if (overrides.length) return overrides.at(-1).value;
    if (!transaction.docChanged) return value;
    const edits = [];
    transaction.changes.iterChanges((from, to, _f, _t, inserted) =>
      edits.push({ from, to, insert: inserted.toString() }));
    return applyEdits(value, edits);
  }
});

export const rawHistory = invertedEffects.of(tr =>
  tr.docChanged || tr.effects.some(e => e.is(restoreRaw))
    ? [restoreRaw.of(tr.startState.field(rawField))] : []);
