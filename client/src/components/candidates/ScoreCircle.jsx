import { scoreClass } from './utils.js';
import './candidates.css';

export default function ScoreCircle({ score, size }) {
  const s = Math.round(Number(score) || 0);
  return (
    <span className={`score ${scoreClass(s)} ${size === 'sm' ? 'cd-score-sm' : ''}`} title={`Match score ${s}/100`}>
      {s}
    </span>
  );
}
