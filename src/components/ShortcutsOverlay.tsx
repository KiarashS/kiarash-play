import { CloseIcon } from './Icons';

const GROUPS: { title: string; rows: [string, string[]][] }[] = [
  {
    title: 'Playback',
    rows: [
      ['Play or pause', ['Space']],
      ['Next track', ['⇧', 'N']],
      ['Previous track', ['⇧', 'P']],
      ['Seek 5s back / forward', ['←', '→']],
      ['Seek 30s back / forward', ['⇧', '← →']],
      ['Volume up / down', ['↑', '↓']],
      ['Mute', ['M']],
    ],
  },
  {
    title: 'Navigation',
    rows: [
      ['Search', ['/', 'or', '⌘K']],
      ['Toggle queue', ['Q']],
      ['Toggle lyrics', ['L']],
      ['Full screen player', ['F']],
      ['Like current track', ['H']],
      ['Shuffle', ['S']],
      ['Repeat mode', ['R']],
      ['This help', ['?']],
    ],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="overlay__card glass glass--lit">
        <div className="overlay__input">
          <strong style={{ fontSize: 15 }}>Keyboard shortcuts</strong>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            style={{ marginLeft: 'auto' }}
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="shortcuts">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="panel__group">{group.title}</div>
              {group.rows.map(([label, keys]) => (
                <div key={label} className="shortcuts__row">
                  <span>{label}</span>
                  <span className="shortcuts__keys">
                    {keys.map((key, index) =>
                      key === 'or' ? (
                        <span key={index} style={{ color: 'var(--text-faint)', fontSize: 11 }}>
                          or
                        </span>
                      ) : (
                        <kbd key={index}>{key}</kbd>
                      ),
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
