/** Texto plano apto para XML SRI: sin saltos de línea y espacios colapsados. */
export function htmlToPlainSriText(html: string): string {
  if (!html?.trim()) {
    return '';
  }
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blockTags = new Set(['P', 'DIV', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const walk = (node: Node, parts: string[]): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? '';
      if (t.trim()) {
        parts.push(t);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      parts.push(' ');
      return;
    }
    const block = blockTags.has(el.tagName);
    for (const child of Array.from(el.childNodes)) {
      walk(child, parts);
    }
    if (block) {
      parts.push(' ');
    }
  };
  const parts: string[] = [];
  walk(doc.body, parts);
  return parts
    .join('')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function plainTextLengthFromHtml(html: string): number {
  return htmlToPlainSriText(html).length;
}

/** Texto legible para PDF (permite saltos suaves entre bloques). */
export function htmlToPlainPdfText(html: string): string {
  if (!html?.trim()) {
    return '';
  }
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const lines: string[] = [];
  const flush = (buf: string[]): void => {
    const line = buf.join('').replace(/\s+/g, ' ').trim();
    if (line) {
      lines.push(line);
    }
    buf.length = 0;
  };
  const buf: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? '';
      if (t) {
        buf.push(t);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'BR') {
      flush(buf);
      return;
    }
    const block = ['P', 'DIV', 'LI', 'TR'].includes(el.tagName);
    if (el.tagName === 'LI') {
      buf.push('• ');
    }
    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
    if (block) {
      flush(buf);
    }
  };
  walk(doc.body);
  flush(buf);
  return lines.join('\n').trim();
}

export function isRichTextEmpty(html: string): boolean {
  return htmlToPlainSriText(html).length === 0;
}
