'use client'

interface Props {
  size?: number
  active?: boolean
  className?: string
}

/**
 * Animated face for the Bloom copilot.
 *
 * - Eyes blink roughly every 4s.
 * - Pupils glance toward the upper-right corner periodically, suggesting
 *   Bloom is thinking about the canvas to the user's left.
 * - When `active` (Bloom streaming), pulse the outer halo.
 *
 * All animation happens via inline <style> keyframes so no global CSS change
 * is needed and the component can be dropped anywhere.
 */
export function BloomAvatar({ size = 22, active = false, className = '' }: Props) {
  return (
    <span
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bloomFace" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#c4b5ff" />
            <stop offset="40%" stopColor="#8b7dff" />
            <stop offset="100%" stopColor="#5646d6" />
          </radialGradient>
          <radialGradient id="bloomHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(139,125,255,0.55)" />
            <stop offset="100%" stopColor="rgba(139,125,255,0)" />
          </radialGradient>
          <linearGradient id="bloomShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <clipPath id="bloomClip">
            <circle cx="24" cy="24" r="20" />
          </clipPath>
        </defs>

        {active && (
          <circle
            cx="24"
            cy="24"
            r="23"
            fill="url(#bloomHalo)"
            style={{ animation: 'bloomPulse 1.6s ease-in-out infinite' }}
          />
        )}

        <circle cx="24" cy="24" r="20" fill="url(#bloomFace)" />
        <ellipse
          cx="20"
          cy="14"
          rx="10"
          ry="5"
          fill="url(#bloomShine)"
          opacity="0.5"
        />

        <g clipPath="url(#bloomClip)">
          {/* Left eye */}
          <g transform="translate(17.5 22)">
            <ellipse
              rx="3.4"
              ry="4.1"
              fill="white"
              style={{ animation: 'bloomBlink 4.2s ease-in-out infinite', transformOrigin: 'center' }}
            />
            <g style={{ animation: 'bloomGlance 5.8s ease-in-out infinite' }}>
              <circle r="1.8" fill="#1a1530" />
              <circle cx="-0.55" cy="-0.7" r="0.5" fill="white" />
            </g>
          </g>
          {/* Right eye */}
          <g transform="translate(30.5 22)">
            <ellipse
              rx="3.4"
              ry="4.1"
              fill="white"
              style={{ animation: 'bloomBlink 4.2s ease-in-out infinite', transformOrigin: 'center' }}
            />
            <g style={{ animation: 'bloomGlance 5.8s ease-in-out infinite' }}>
              <circle r="1.8" fill="#1a1530" />
              <circle cx="-0.55" cy="-0.7" r="0.5" fill="white" />
            </g>
          </g>

          {/* Expression cycle — smile → grin → smirk → surprised → loop */}
          <g stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" fill="none">
            <path
              d="M 18.5 30 Q 24 35.5 29.5 30"
              style={{ animation: 'bloomExpr1 10s ease-in-out infinite' }}
            />
            <path
              d="M 17 29 Q 24 37.5 31 29"
              style={{ animation: 'bloomExpr2 10s ease-in-out infinite', opacity: 0 }}
            />
            <path
              d="M 26 30 Q 28 33 31 29.5"
              style={{ animation: 'bloomExpr2 10s ease-in-out infinite', opacity: 0 }}
            />
            <path
              d="M 19 32 Q 24 33.5 29 30.5"
              style={{ animation: 'bloomExpr3 10s ease-in-out infinite', opacity: 0 }}
            />
          </g>
          <ellipse
            cx="24"
            cy="32"
            rx="1.6"
            ry="2"
            fill="#1a1530"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.5"
            style={{ animation: 'bloomExpr4 10s ease-in-out infinite', opacity: 0 }}
          />
          {/* Cheek blush */}
          <circle cx="14" cy="30" r="1.8" fill="#ff8fb8" opacity="0.35" />
          <circle cx="34" cy="30" r="1.8" fill="#ff8fb8" opacity="0.35" />

          {/* Tie knot */}
          <path d="M 22 40 L 26 40 L 27 43 L 21 43 Z" fill="#22d3ee" />
          <path d="M 22 40 L 26 40 L 25 41.5 L 23 41.5 Z" fill="rgba(255,255,255,0.25)" />
          {/* Tie body */}
          <path d="M 21 43 L 27 43 L 28.5 50 L 19.5 50 Z" fill="#0ea5b7" />
          <path d="M 24 43 L 24 50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        </g>

        {/* Sparkle top-right — the direction Bloom glances toward */}
        <g
          transform="translate(38 10)"
          style={{ animation: 'bloomTwinkle 2.4s ease-in-out infinite' }}
        >
          <path
            d="M0 -3 L0.7 -0.7 L3 0 L0.7 0.7 L0 3 L-0.7 0.7 L-3 0 L-0.7 -0.7 Z"
            fill="#ffffff"
            opacity="0.9"
          />
        </g>
      </svg>
      <style>{`
        @keyframes bloomBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.08); }
          97% { transform: scaleY(1); }
        }
        @keyframes bloomGlance {
          0%, 55% { transform: translate(0, 0); }
          62%, 78% { transform: translate(1.3px, -0.9px); }
          85%, 100% { transform: translate(0, 0); }
        }
        @keyframes bloomTwinkle {
          0%, 100% { opacity: 0.3; transform: translate(38px, 10px) scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: translate(38px, 10px) scale(1.15) rotate(45deg); }
        }
        @keyframes bloomPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); transform-origin: 24px 24px; }
          50% { opacity: 0.9; transform: scale(1.08); transform-origin: 24px 24px; }
        }
        /* Expression cycle — 4 phases @ 2.5s each, 10s total */
        @keyframes bloomExpr1 {
          0%, 22% { opacity: 1; }
          25%, 97% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bloomExpr2 {
          0%, 22%, 50%, 100% { opacity: 0; }
          27%, 47% { opacity: 1; }
        }
        @keyframes bloomExpr3 {
          0%, 47%, 75%, 100% { opacity: 0; }
          52%, 72% { opacity: 1; }
        }
        @keyframes bloomExpr4 {
          0%, 72%, 100% { opacity: 0; }
          77%, 95% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="bloomBlink"], [style*="bloomGlance"],
          [style*="bloomTwinkle"], [style*="bloomPulse"],
          [style*="bloomExpr"] {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  )
}
