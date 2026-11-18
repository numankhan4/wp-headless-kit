const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
};

/** Decode the HTML entities WordPress commonly emits in titles and excerpts. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Escape text for safe insertion into HTML. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Remove tags and collapse whitespace. */
export function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain-text excerpt from rendered HTML, cut on a word boundary. */
export function toExcerpt(html: string, maxLength = 160): string {
  const text = decodeEntities(stripTags(html)).replace(/\s*\[(?:&hellip;|…|\.\.\.)\]\s*$/, "");
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** Estimated reading time in whole minutes (minimum 1). */
export function readingTime(html: string, wordsPerMinute = 225): number {
  const words = stripTags(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

const DEFAULT_ALLOW_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "code", "dd", "del", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "mark", "ol", "p", "pre", "s", "small", "span",
  "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
];
const DEFAULT_ALLOW_ATTRS = ["href", "src", "alt", "title", "class", "id", "width", "height", "rel", "target", "colspan", "rowspan", "loading"];
const URL_ATTRS = new Set(["href", "src", "cite", "poster", "action", "formaction", "xlink:href"]);
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
/** Tags that are removed together with their content and can never be allowlisted. */
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "textarea", "title", "xmp", "noembed", "noframes"]);
const NEVER_ALLOW_TAGS = new Set([...DROP_WITH_CONTENT, "base", "link", "meta", "form", "input", "button", "frame", "frameset", "applet"]);
const VOID_TAGS = new Set(["br", "hr", "img"]);

export interface SanitizeHtmlOptions {
  /** Tag names to keep (replaces the default list). Dangerous tags such as script are never kept. */
  allowTags?: string[];
  /** Attribute names to keep (replaces the default list). Event handlers (`on*`) and `srcdoc` are never kept. */
  allowAttrs?: string[];
}

// Control chars, whitespace and zero-width chars that browsers ignore inside a URL scheme.
const INVISIBLE = new RegExp("[\\u0000-\\u0020\\u007f-\\u009f\\u200b-\\u200d\\ufeff]", "g");

function isSafeUrl(raw: string): boolean {
  // Browsers ignore control chars/whitespace inside the scheme, so strip them before checking.
  const url = decodeEntities(raw).replace(INVISIBLE, "");
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return m ? SAFE_PROTOCOLS.has(`${m[1]!.toLowerCase()}:`) : !/^[a-z][a-z0-9+.-]*&/i.test(url);
}

function sanitizeAttrs(source: string, allow: Set<string>): string {
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let out = "";
  const seen = new Set<string>();
  for (const m of source.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (!allow.has(name) || name.startsWith("on") || name === "srcdoc" || seen.has(name)) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
    seen.add(name);
    out += ` ${name}="${escapeHtml(decodeEntities(value))}"`;
  }
  return out;
}

/** Allowlist HTML sanitizer: strips scripts, event handlers and unsafe URLs, keeps only allowed tags/attributes. */
export function sanitizeHtml(html: string, options: SanitizeHtmlOptions = {}): string {
  const tags = new Set((options.allowTags ?? DEFAULT_ALLOW_TAGS).map((t) => t.toLowerCase()));
  const attrs = new Set((options.allowAttrs ?? DEFAULT_ALLOW_ATTRS).map((a) => a.toLowerCase()));
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    tagRe.lastIndex = lt;
    const m = tagRe.exec(html);
    if (!m) {
      // Not a well-formed tag (comment-like, doctype, unterminated): drop through next ">" or escape.
      if (/^<[!?]/.test(html.slice(lt, lt + 2))) {
        const end = html.indexOf(">", lt);
        i = end === -1 ? html.length : end + 1;
      } else {
        out += "&lt;";
        i = lt + 1;
      }
      continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === "/";
    const name = m[2]!.toLowerCase();
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing) {
        const close = new RegExp(`</${name}[\\s/>]`, "i").exec(html.slice(i));
        if (!close) {
          i = html.length;
        } else {
          const end = html.indexOf(">", i + close.index);
          i = end === -1 ? html.length : end + 1;
        }
      }
      continue;
    }
    if (!tags.has(name) || NEVER_ALLOW_TAGS.has(name)) continue;
    if (closing) {
      if (!VOID_TAGS.has(name)) out += `</${name}>`;
    } else {
      out += `<${name}${sanitizeAttrs(m[3]!, attrs)}>`;
    }
  }
  return out;
}
