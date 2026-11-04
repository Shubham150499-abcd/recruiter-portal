import './candidates.css';

// Weights per CONTRACT.md: skills 50 / experience 20 / location 15 / salary 10 / notice 5
export const BREAKDOWN_PARTS = [
  { key: 'skills', label: 'Skills', weight: 50 },
  { key: 'experience', label: 'Experience', weight: 20 },
  { key: 'location', label: 'Location', weight: 15 },
  { key: 'salary', label: 'Salary', weight: 10 },
  { key: 'notice', label: 'Notice', weight: 5 },
];

const level = (v) => (v >= 75 ? 'high' : v >= 50 ? 'mid' : 'low');

export default function Breakdown({ breakdown = {} }) {
  return (
    <div className="cd-breakdown">
      {BREAKDOWN_PARTS.map((p) => {
        const v = Math.max(0, Math.min(100, Math.round(Number(breakdown[p.key]) || 0)));
        return (
          <div key={p.key}>
            <div className="cd-bar-label">
              <span>{p.label} <span className="small">({p.weight}%)</span></span>
              <b>{v}</b>
            </div>
            <div className="cd-bar" role="progressbar" aria-label={`${p.label} score`} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
              <span className={level(v)} style={{ width: `${v}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
