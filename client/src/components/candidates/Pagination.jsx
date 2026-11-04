import './candidates.css';

export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 20)));
  if (pages <= 1) return null;
  const nums = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <nav className="cd-pagination" aria-label="Pagination">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      {from > 1 && <><button className="btn btn-sm" onClick={() => onChange(1)}>1</button>{from > 2 && <span className="muted">…</span>}</>}
      {nums.map((n) => (
        <button key={n} className={`btn btn-sm ${n === page ? 'btn-primary' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
      {to < pages && <>{to < pages - 1 && <span className="muted">…</span>}<button className="btn btn-sm" onClick={() => onChange(pages)}>{pages}</button></>}
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next ›</button>
    </nav>
  );
}
