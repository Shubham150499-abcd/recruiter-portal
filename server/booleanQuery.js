'use strict';
/**
 * Boolean resume query support.
 *
 * Grammar (case-insensitive operators):
 *   query   := orExpr
 *   orExpr  := andExpr ( OR andExpr )*
 *   andExpr := unary ( [AND] unary )*        -- adjacency = implicit AND
 *   unary   := NOT unary | primary
 *   primary := TERM | "PHRASE" | '(' orExpr ')'
 *
 * `a NOT b` therefore parses as `a AND (NOT b)`.
 * Operators are AND / OR / NOT (also && / || / !). To search the literal word
 * "and"/"or"/"not", put it in quotes. A trailing `*` on a term makes it a prefix match.
 */

class QueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueryError';
    this.status = 400;
  }
}

const OPS = { and: 'AND', '&&': 'AND', or: 'OR', '||': 'OR', not: 'NOT', '!': 'NOT' };

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const s = String(input);
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: ch === '(' ? 'LPAREN' : 'RPAREN', pos: i });
      i++;
      continue;
    }
    if (ch === '"' || ch === '“' || ch === '”') {
      const start = i;
      i++;
      let buf = '';
      while (i < s.length && s[i] !== '"' && s[i] !== '”' && s[i] !== '“') buf += s[i++];
      if (i >= s.length) throw new QueryError(`Unterminated quote starting at position ${start + 1}`);
      i++; // closing quote
      const phrase = buf.trim().replace(/\s+/g, ' ');
      if (!phrase) throw new QueryError(`Empty phrase "" at position ${start + 1}`);
      tokens.push({ type: 'TERM', value: phrase.toLowerCase(), phrase: true, pos: start });
      continue;
    }
    const start = i;
    let buf = '';
    while (i < s.length && !/\s/.test(s[i]) && s[i] !== '(' && s[i] !== ')' && s[i] !== '"') buf += s[i++];
    const op = OPS[buf.toLowerCase()];
    if (op) tokens.push({ type: op, pos: start });
    else tokens.push({ type: 'TERM', value: buf.toLowerCase(), phrase: false, pos: start });
  }
  return tokens;
}

function parse(input) {
  if (input == null || String(input).trim() === '') throw new QueryError('Query is empty');
  const tokens = tokenize(input);
  if (!tokens.length) throw new QueryError('Query is empty');
  let p = 0;
  const peek = () => tokens[p];
  const describe = (t) => (t ? (t.type === 'TERM' ? `"${t.value}"` : t.type === 'LPAREN' ? '"("' : t.type === 'RPAREN' ? '")"' : t.type) : 'end of query');

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'OR') {
      const opTok = tokens[p++];
      if (!peek() || peek().type === 'RPAREN' || peek().type === 'OR' || peek().type === 'AND')
        throw new QueryError(`Operator OR at position ${opTok.pos + 1} is missing a right-hand term`);
      left = { type: 'OR', left, right: parseAnd() };
    }
    return left;
  }

  function startsUnary(t) {
    return t && (t.type === 'TERM' || t.type === 'LPAREN' || t.type === 'NOT');
  }

  function parseAnd() {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t && t.type === 'AND') {
        p++;
        if (!startsUnary(peek())) throw new QueryError(`Operator AND at position ${t.pos + 1} is missing a right-hand term`);
        left = { type: 'AND', left, right: parseUnary() };
      } else if (startsUnary(t)) {
        left = { type: 'AND', left, right: parseUnary() };
      } else break;
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (!t) throw new QueryError('Unexpected end of query (dangling operator?)');
    if (t.type === 'NOT') {
      p++;
      if (!startsUnary(peek())) throw new QueryError(`Operator NOT at position ${t.pos + 1} is missing a term`);
      return { type: 'NOT', expr: parseUnary() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new QueryError('Unexpected end of query');
    if (t.type === 'TERM') {
      p++;
      return { type: 'TERM', value: t.value, phrase: t.phrase };
    }
    if (t.type === 'LPAREN') {
      p++;
      if (peek() && peek().type === 'RPAREN') throw new QueryError(`Empty parentheses at position ${t.pos + 1}`);
      const e = parseOr();
      if (!peek() || peek().type !== 'RPAREN') throw new QueryError(`Unbalanced parentheses: "(" at position ${t.pos + 1} is never closed`);
      p++;
      return e;
    }
    if (t.type === 'RPAREN') throw new QueryError(`Unbalanced parentheses: unexpected ")" at position ${t.pos + 1}`);
    throw new QueryError(`Unexpected ${describe(t)} at position ${t.pos + 1}`);
  }

  const ast = parseOr();
  if (p < tokens.length) {
    const t = tokens[p];
    if (t.type === 'RPAREN') throw new QueryError(`Unbalanced parentheses: unexpected ")" at position ${t.pos + 1}`);
    throw new QueryError(`Unexpected ${describe(t)} at position ${t.pos + 1}`);
  }
  return ast;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Regex source for a term/phrase matched on "word" boundaries, where a word char is [a-z0-9].
 * Works for c++, c#, node.js, .net, R, etc. A trailing '*' makes it a prefix match.
 */
function termSource(term) {
  let t = String(term).toLowerCase().trim();
  let prefix = false;
  if (t.length > 1 && t.endsWith('*')) { prefix = true; t = t.replace(/\*+$/, ''); }
  const body = t.split(/\s+/).map(escapeRegex).join('[\\s\\-/]+');
  const startsWord = /^[a-z0-9]/.test(t);
  const endsWord = /[a-z0-9]$/.test(t);
  const lead = startsWord ? '(?<![a-z0-9])' : '';
  const trail = prefix ? '' : endsWord ? '(?![a-z0-9])' : '(?![a-z0-9+#])';
  return lead + body + trail;
}

function termRegex(term, flags = 'i') {
  return new RegExp(termSource(term), flags);
}

/** Collect positive (non-negated) terms, deduplicated, for highlighting. */
function positiveTerms(ast) {
  const out = new Set();
  (function walk(n, neg) {
    if (n.type === 'TERM') { if (!neg) out.add(n.value); return; }
    if (n.type === 'NOT') return walk(n.expr, !neg);
    walk(n.left, neg);
    walk(n.right, neg);
  })(ast, false);
  return [...out];
}

/**
 * Compile a query string.
 * Returns { ast, terms, test(text) -> bool, countHits(text) -> n, snippets(text) -> [html] }.
 * Throws QueryError (status 400) on malformed input.
 */
function compile(query) {
  const ast = parse(query);
  const cache = new Map();
  const re = (term) => {
    if (!cache.has(term)) cache.set(term, termRegex(term, 'i'));
    return cache.get(term);
  };
  function evalNode(n, text) {
    switch (n.type) {
      case 'TERM': return re(n.value).test(text);
      case 'NOT': return !evalNode(n.expr, text);
      case 'AND': return evalNode(n.left, text) && evalNode(n.right, text);
      case 'OR': return evalNode(n.left, text) || evalNode(n.right, text);
      default: return false;
    }
  }
  const terms = positiveTerms(ast);
  const globalRes = terms.map((t) => ({ term: t, re: termRegex(t, 'gi') }));

  function findHits(text) {
    const hits = [];
    for (const { term, re: g } of globalRes) {
      g.lastIndex = 0;
      let m;
      while ((m = g.exec(text))) {
        if (m[0].length === 0) { g.lastIndex++; continue; }
        hits.push({ start: m.index, end: m.index + m[0].length, term });
      }
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    // drop overlaps
    const merged = [];
    for (const h of hits) {
      const last = merged[merged.length - 1];
      if (last && h.start < last.end) continue;
      merged.push(h);
    }
    return merged;
  }

  return {
    ast,
    terms,
    test: (text) => evalNode(ast, String(text || '').toLowerCase()),
    countHits: (text) => findHits(String(text || '')).length,
    findHits,
    snippets: (text, opts) => buildSnippets(String(text || ''), findHits(String(text || '')), opts),
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderWindow(text, start, end, hits) {
  let html = '';
  let cur = start;
  for (const h of hits) {
    if (h.start < start || h.end > end) continue;
    html += escapeHtml(text.slice(cur, h.start)) + '<mark>' + escapeHtml(text.slice(h.start, h.end)) + '</mark>';
    cur = h.end;
  }
  html += escapeHtml(text.slice(cur, end));
  html = html.replace(/\s+/g, ' ').trim();
  return (start > 0 ? '… ' : '') + html + (end < text.length ? ' …' : '');
}

/** Up to `max` excerpts of ~`width` chars around hits; distinct terms are preferred first. */
function buildSnippets(text, hits, { max = 3, width = 160 } = {}) {
  if (!text) return [];
  if (!hits.length) {
    const end = snapEnd(text, Math.min(text.length, width));
    return [renderWindow(text, 0, end, [])];
  }
  // Prefer first occurrence of each distinct term, then remaining hits in order.
  const seen = new Set();
  const ordered = [];
  for (const h of hits) if (!seen.has(h.term)) { seen.add(h.term); ordered.push(h); }
  for (const h of hits) if (!ordered.includes(h)) ordered.push(h);

  const windows = [];
  for (const h of ordered) {
    if (windows.length >= max) break;
    if (windows.some((w) => h.start >= w.start && h.end <= w.end)) continue;
    const half = Math.floor((width - (h.end - h.start)) / 2);
    let start = Math.max(0, h.start - half);
    let end = Math.min(text.length, h.end + half);
    // use any leftover budget on the other side
    if (start === 0) end = Math.min(text.length, width);
    if (end === text.length) start = Math.max(0, text.length - width);
    start = snapStart(text, start, h.start);
    end = snapEnd(text, end, h.end);
    // avoid overlapping existing windows
    if (windows.some((w) => start < w.end && end > w.start)) {
      const w = windows.find((x) => start < x.end && end > x.start);
      if (h.start >= w.end) start = Math.max(start, w.end);
      else if (h.end <= w.start) end = Math.min(end, w.start);
    }
    windows.push({ start, end });
  }
  windows.sort((a, b) => a.start - b.start);
  return windows.map((w) => renderWindow(text, w.start, w.end, hits));
}

function snapStart(text, start, limit) {
  if (start <= 0) return 0;
  const sp = text.indexOf(' ', start);
  return sp !== -1 && sp < limit ? sp + 1 : start;
}

function snapEnd(text, end, limit = 0) {
  if (end >= text.length) return text.length;
  const sp = text.lastIndexOf(' ', end);
  return sp > limit ? sp : end;
}

module.exports = { compile, parse, tokenize, termRegex, termSource, escapeHtml, buildSnippets, QueryError };
