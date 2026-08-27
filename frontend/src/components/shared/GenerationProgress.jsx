import { useEffect, useState } from 'react';
import './generation-progress.css';

// Client-side phased progress. Backend generate is a single POST — there is no
// mid-flight signal — so this animates through realistic phases on a timer to
// give the user a sense of what's happening. Real durations vary per generation;
// the phases loop the middle "AI schrijft" step until the POST actually resolves.
const PHASES = [
  { key: 'brand', label: 'Merkcontext laden...', duration: 700 },
  { key: 'writing', label: 'AI schrijft je concept', duration: null },
  { key: 'saving', label: 'Concept opslaan...', duration: 400 },
];

export default function GenerationProgress({ active, criticusPending }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!active) {
      setPhaseIndex(0);
      setDots('');
      return undefined;
    }

    let cancelled = false;
    let timeout;

    function next(index) {
      if (cancelled) return;
      setPhaseIndex(index);
      const phase = PHASES[index];
      if (phase?.duration && index < PHASES.length - 1) {
        timeout = setTimeout(() => next(index + 1), phase.duration);
      }
    }

    next(0);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [active]);

  if (!active && !criticusPending) {
    return null;
  }

  const currentPhase = PHASES[phaseIndex] || PHASES[1];
  const shownLabel = active
    ? currentPhase.key === 'writing'
      ? `${currentPhase.label}${dots}`
      : currentPhase.label
    : 'Kwaliteitscontrole loopt...';

  return (
    <div className="generation-progress">
      <div className="generation-progress-bar">
        <div className="generation-progress-fill" />
      </div>
      <p className="generation-progress-label">{shownLabel}</p>
    </div>
  );
}
