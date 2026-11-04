import { useId, useState } from 'react';
import './candidates.css';

// Tag input: Enter/comma adds a tag, Backspace on empty removes last. Optional suggestions (autocomplete).
export default function TagInput({ value = [], onChange, suggestions = [], placeholder, id }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = useId();

  const lower = value.map((v) => v.toLowerCase());
  const matches = text.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(text.trim().toLowerCase()) && !lower.includes(s.toLowerCase())).slice(0, 8)
    : [];

  const add = (t) => {
    const v = t.trim().replace(/,$/, '').trim();
    if (v && !lower.includes(v.toLowerCase())) onChange([...value, v]);
    setText('');
    setHi(0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % matches.length); }
    else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (!text.trim()) return;
      if (e.key !== 'Tab' || matches.length) e.preventDefault();
      add(open && matches[hi] ? matches[hi] : text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="cd-taginput">
      <div className="cd-taginput-box">
        {value.map((t) => (
          <span key={t} className="chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          placeholder={value.length ? '' : placeholder}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) { v.split(',').slice(0, -1).forEach(add); setText(v.split(',').pop()); }
            else { setText(v); setOpen(true); setHi(0); }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => { setTimeout(() => setOpen(false), 150); if (text.trim()) add(text); }}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="cd-suggest" id={listId} role="listbox">
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === hi} className={i === hi ? 'active' : ''} onMouseDown={(e) => { e.preventDefault(); add(m); }}>
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
