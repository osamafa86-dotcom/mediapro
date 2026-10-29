import s from './portal.module.css';

/** Loading state (Figma states frame 4): the shapes of what is coming, no spinner. */
export function PortalSkeleton({ kind }: { kind: 'library' | 'project' }) {
  return (
    <div className={s.shell} aria-busy="true">
      <div className={s.header}><span className={`${s.sk} ${s.skMark}`} /><span className={`${s.sk} ${s.skLine}`} style={{ inlineSize: 160 }} /></div>
      <main className={s.main}>
        <span className={`${s.sk} ${s.skLine}`} style={{ inlineSize: 220, blockSize: 28 }} />
        <span className={`${s.sk} ${s.skLine}`} style={{ inlineSize: 140 }} />
        {kind === 'library' ? (
          <div className={s.cards}>{[0, 1, 2].map((i) => <span key={i} className={`${s.sk} ${s.cover}`} />)}</div>
        ) : (
          <div className={s.skGrid}>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} className={s.sk} />)}</div>
        )}
      </main>
    </div>
  );
}
