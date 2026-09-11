/**
 * Everything behind the glass: three drifting colour fields, a turbulence filter
 * that gives them a liquid edge, and a grain layer so the gradients do not band.
 */
export function Backdrop({ playing }: { playing: boolean }) {
  return (
    <div className="backdrop" data-playing={playing} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="liquid-warp" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={2} seed={7} result="noise">
            <animate
              attributeName="baseFrequency"
              dur="34s"
              values="0.006 0.011;0.012 0.006;0.006 0.011"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="120" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div className="backdrop__field">
        <div className="backdrop__blob backdrop__blob--1" />
        <div className="backdrop__blob backdrop__blob--2" />
        <div className="backdrop__blob backdrop__blob--3" />
      </div>
      <div className="backdrop__grain" />
    </div>
  );
}
