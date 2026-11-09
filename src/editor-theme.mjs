import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Syntax colors for the Studio's dark code panes. Keep these semantic tags
// independent of generated CSS class names and of document/editing state.
export const studioHighlightStyle = HighlightStyle.define([
  { tag: tags.meta, color: '#ffac9c' },
  { tag: tags.link, color: '#98c6ff', textDecoration: 'underline' },
  { tag: tags.heading, color: '#d6baff', textDecoration: 'underline', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.keyword, color: '#d6baff' },
  { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], color: '#98c6ff' },
  { tag: [tags.literal, tags.inserted], color: '#a7e6cf' },
  { tag: [tags.string, tags.deleted], color: '#e7c991' },
  { tag: [tags.regexp, tags.escape, tags.special(tags.string)], color: '#ffac9c' },
  { tag: tags.definition(tags.variableName), color: '#98c6ff' },
  { tag: tags.local(tags.variableName), color: '#c4d9ff' },
  { tag: [tags.typeName, tags.namespace, tags.className], color: '#a7e6cf' },
  { tag: [tags.special(tags.variableName), tags.macroName], color: '#e7c991' },
  { tag: tags.definition(tags.propertyName), color: '#98c6ff' },
  { tag: tags.comment, color: '#a0a9bd' },
  { tag: tags.invalid, color: '#ffab9b' },
]);
