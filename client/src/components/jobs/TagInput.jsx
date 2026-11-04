import { useId, useMemo, useRef, useState } from 'react';
import './jobs.css';

/**
 * Reusable tag/chip input with optional autocomplete.
 * Props: value (string[]), onChange(string[]), suggestions (string[]), placeholder,
 * invalid (bool), max (number), id, allowCustom (default true).
 * Enter or comma adds the typed value; Backspace on empty input removes the last tag.
 */
export default function TagInput({ value = [], onChange, suggestions = [], placeholder = 'Type and press Enter', invalid, max, id, allowCustom = true }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [hl, setHl] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const lower = value.map((v) => v.toLowerCase());
  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    const starts = [];
    const contains = [];
    for (const s of suggestions) {
      const l = s.toLowerCase();
      if (lower.includes(l)) continue;
      if (l.startsWith(t)) starts.push(s);
      else if (l.includes(t)) contains.push(s);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [text, suggestions, value]); // eslint-disable-line react-hooks/exhaustive-deps

  const atMax = max && value.length >= max;

  function add(raw) {
    const v = raw.trim().replace(/,+$/, '').trim();
    if (!v || atMax) return;
    // Prefer the canonical casing from suggestions
    const canonical = suggestions.find((s) => s.toLowerCase() === v.toLowerCase());
    if (!canonical && !allowCustom) return;
    const finalV = canonical || v;
    if (!lower.includes(finalV.toLowerCase())) onChange([...value, finalV]);
    setText('');
    setHl(0);
  }

  function remove(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e) {
    const open = focused && matches.length > 0;
    if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && text.trim())) {
      if (!text.trim()) { if (e.key === ',') e.preventDefault(); return; }
      e.preventDefault();
      add(open && matches[hl] && e.key !== ',' ? matches[hl] : text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
    } else if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setHl((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setHl((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Escape') {
      setText('');
    }
  }

  function onInput(e) {
    const v = e.target.value;
    if (v.includes(',')) {
      v.split(',').slice(0, -1).forEach(add);
      setText(v.split(',').pop());
    } else {
      setText(v);
    }
    setHl(0);
  }

  return (
    <div className="tag-input">
      <div
        className={`tag-input-box${focused ? ' focused' : ''}${invalid ? ' invalid' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t, i) => (
          <span className="chip" key={t + i}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.stopPropagation(); remove(i); }}>×</button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={text}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); if (text.trim() && allowCustom) add(text); }}
          placeholder={atMax ? `Max ${max} reached` : value.length ? '' : placeholder}
          disabled={!!atMax}
          role="combobox"
          aria-expanded={focused && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>
      {focused && matches.length > 0 && (
        <ul className="tag-suggest" id={listId} role="listbox">
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === hl}
              className={i === hl ? 'hl' : ''}
              onMouseDown={(e) => { e.preventDefault(); add(m); }}
              onMouseEnter={() => setHl(i)}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
