import { ViewPlugin } from '@codemirror/view';

// CodeMirror's collapsed context widget expands both panes on click. Make the
// same action available to keyboard and assistive-technology users.
export const accessibleCollapsedContext = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.decorate = () => {
      for (const element of view.dom.querySelectorAll('.cm-collapsedLines')) {
        element.setAttribute('role', 'button');
        element.tabIndex = 0;
        element.setAttribute('aria-label', element.textContent);
      }
    };
    this.keydown = event => {
      const target = event.target.closest?.('.cm-collapsedLines');
      if (!target || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      target.click();
      view.focus();
    };
    this.observer = new MutationObserver(this.decorate);
    this.observer.observe(view.dom, { childList: true, subtree: true });
    view.dom.addEventListener('keydown', this.keydown, true);
    this.decorate();
  }
  destroy() {
    this.observer.disconnect();
    this.view.dom.removeEventListener('keydown', this.keydown, true);
  }
});
