import Link from 'next/link'
import {
  Sparkles,
  Workflow,
  Bot,
  LineChart,
  LayoutTemplate,
  ArrowRight,
  Zap,
  Database,
  Play,
} from 'lucide-react'

export function Landing() {
  return (
    <div className="min-h-screen bg-bg-0 text-eq-t1 flex flex-col overflow-x-hidden">
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-eq-accent focus:text-white focus:rounded"
      >
        Skip to content
      </a>

      <LandingNav />

      <main className="flex-1">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <CanvasPreview />
      </main>

      <Footer />
    </div>
  )
}

// ─── Nav ────────────────────────────────────────────────────────────────────
function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 flex items-center px-6 py-3 bg-bg-1/80 border-b border-eq-border backdrop-blur-lg">
      <Link
        href="/"
        className="text-[14px] font-semibold tracking-tight text-eq-t1"
      >
        Signal<span className="text-gemini">Tracer</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/enter"
          className="px-3.5 py-1.5 rounded-md text-[12px] font-medium text-eq-t2 hover:text-eq-t1 hover:bg-bg-3 border border-transparent hover:border-eq-border-2 transition-colors"
        >
          Login
        </Link>
        <Link
          href="/enter"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12px] font-medium bg-eq-accent text-white hover:bg-eq-accent-2 transition-colors"
        >
          Sign up
          <ArrowRight size={12} />
        </Link>
      </div>
    </nav>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28 sm:pb-32"
    >
      {/* Animated blobs */}
      <div
        aria-hidden
        className="absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-eq-accent/20 blur-3xl"
        style={{ animation: 'var(--animate-blob-a)' }}
      />
      <div
        aria-hidden
        className="absolute top-10 right-0 w-[380px] h-[380px] rounded-full bg-eq-cyan/15 blur-3xl"
        style={{ animation: 'var(--animate-blob-b)' }}
      />
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,125,255,0.12),transparent_60%)]" />
      </div>

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 rounded-full border border-eq-cyan/30 bg-eq-cyan-dim text-[11px] font-mono text-eq-cyan">
          <Sparkles size={11} />
          Powered by Gemini 2.0
        </div>

        <h1 className="text-[44px] sm:text-[60px] font-light leading-[1.05] tracking-tight mb-5">
          Build quant strategies{' '}
          <span className="text-gemini font-normal">visually</span>.
          <br />
          Let AI do the plumbing.
        </h1>

        <p className="max-w-2xl mx-auto text-[15px] sm:text-[17px] text-eq-t2 leading-relaxed mb-9">
          Drag blocks onto a canvas. Wire signals. Backtest on real market data.
          Ask Bloom to generate templates, explain your Sharpe, and debug
          lookahead bias — all without writing a line of pandas.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/enter"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gemini text-white text-[14px] font-medium hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-eq-accent/30"
          >
            <Sparkles size={14} />
            Create free account
          </Link>
          <Link
            href="/enter"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-bg-2 text-eq-t1 text-[14px] font-medium border border-eq-border-2 hover:bg-bg-3 hover:border-eq-accent/50 transition-colors"
          >
            Sign in
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-mono text-eq-t3">
          <span>No credit card</span>
          <span className="w-1 h-1 rounded-full bg-eq-t3" />
          <span>14 blocks</span>
          <span className="w-1 h-1 rounded-full bg-eq-t3" />
          <span>Live market data</span>
        </div>
      </div>
    </section>
  )
}

// ─── Feature Grid ───────────────────────────────────────────────────────────
function FeatureGrid() {
  const features = [
    {
      icon: Workflow,
      title: 'Visual canvas',
      desc:
        'Drag 14 block types — Ticker Source, EMA, Momentum, Threshold, Backtest. React Flow under the hood.',
      accent: 'text-eq-accent',
      border: 'border-eq-accent/30',
    },
    {
      icon: Bot,
      title: 'Bloom (Gemini-powered)',
      desc:
        'Ask for a strategy, get a pipeline. Explain results, debug lookahead, cite sources. Slash commands, file attachments.',
      accent: 'text-eq-cyan',
      border: 'border-eq-cyan/30',
    },
    {
      icon: Database,
      title: 'Real market data',
      desc:
        'OHLCV via yfinance through a FastAPI backend. Click Evaluate, pipe 1,000 bars into your canvas. Export CSV.',
      accent: 'text-eq-green',
      border: 'border-eq-green/30',
    },
    {
      icon: LayoutTemplate,
      title: 'Templates',
      desc:
        'Momentum, Pairs, Vol Breakout — pre-wired and benchmarked. Clone one, tweak params, run. Fork-and-tune workflow.',
      accent: 'text-eq-amber',
      border: 'border-eq-amber/30',
    },
  ]

  return (
    <section className="px-6 py-16 sm:py-24 border-t border-eq-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-eq-t3 mb-2">
            What's inside
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-light text-eq-t1">
            Everything a quant researcher needs.
            <br />
            <span className="text-eq-t2">Minus the yak-shaving.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, desc, accent, border }) => (
            <div
              key={title}
              className={`group relative bg-bg-1 border border-eq-border hover:${border} rounded-xl p-5 transition-all hover:-translate-y-0.5`}
            >
              <div
                className={`w-9 h-9 rounded-lg bg-bg-3 ${accent} flex items-center justify-center mb-4 border border-eq-border-2`}
              >
                <Icon size={16} />
              </div>
              <h3 className="text-[14px] font-medium text-eq-t1 mb-1.5">{title}</h3>
              <p className="text-[12px] text-eq-t2 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ───────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      icon: Sparkles,
      title: 'Sign up, open a canvas',
      desc:
        "Start from a blank canvas or clone a template. Your projects sync to the cloud — pick up anywhere.",
    },
    {
      icon: Zap,
      title: 'Drag blocks, wire signals',
      desc:
        'Ticker → Log Returns → EMA → Threshold → Backtest. Edit params live. Bloom suggests the next block.',
    },
    {
      icon: Play,
      title: 'Evaluate, iterate, export',
      desc:
        'Fetch real OHLCV, run the pipeline, read Sharpe/drawdown. Download data as CSV for deeper analysis.',
    },
  ]

  return (
    <section className="px-6 py-16 sm:py-24 bg-bg-1 border-y border-eq-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-eq-t3 mb-2">
            How it works
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-light text-eq-t1">
            Three steps. No Python required.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gemini flex items-center justify-center text-white shadow-lg shadow-eq-accent/30">
                  <s.icon size={14} />
                </div>
                <div className="text-[11px] font-mono text-eq-t3">
                  STEP {String(i + 1).padStart(2, '0')}
                </div>
              </div>
              <h3 className="text-[16px] font-medium text-eq-t1 mb-1.5">{s.title}</h3>
              <p className="text-[13px] text-eq-t2 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Canvas Preview (inline SVG mock) ───────────────────────────────────────
function CanvasPreview() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-eq-t3 mb-2">
            Sneak peek
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-light text-eq-t1">
            Your canvas will look like this
          </h2>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-eq-border-2 bg-bg-1 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-eq-border bg-bg-2">
            <div className="w-2.5 h-2.5 rounded-full bg-eq-red/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-eq-amber/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-eq-green/60" />
            <span className="ml-3 text-[11px] font-mono text-eq-t3">
              NVDA Momentum · 5 blocks · gemini-suggested
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-eq-green font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-eq-green animate-pulse" /> live
            </span>
          </div>

          <div
            className="relative h-[300px] sm:h-[360px] bg-bg-0"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
              <defs>
                <marker id="arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
                  <polygon points="0 0, 7 2.5, 0 5" fill="rgba(34,211,238,0.5)" />
                </marker>
              </defs>
              <path
                d="M 130 80 C 190 80, 190 125, 250 125"
                fill="none"
                stroke="rgba(34,211,238,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arr)"
                style={{ animation: 'var(--animate-edge-dash)' }}
              />
              <path
                d="M 130 80 C 190 80, 190 195, 250 195"
                fill="none"
                stroke="rgba(34,211,238,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arr)"
                style={{ animation: 'var(--animate-edge-dash)' }}
              />
              <path
                d="M 380 125 C 440 125, 440 160, 500 160"
                fill="none"
                stroke="rgba(34,211,238,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arr)"
                style={{ animation: 'var(--animate-edge-dash)' }}
              />
              <path
                d="M 380 195 C 440 195, 440 160, 500 160"
                fill="none"
                stroke="rgba(34,211,238,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arr)"
                style={{ animation: 'var(--animate-edge-dash)' }}
              />
              <path
                d="M 630 160 C 690 160, 690 220, 750 220"
                fill="none"
                stroke="rgba(34,211,238,0.5)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arr)"
                style={{ animation: 'var(--animate-edge-dash)' }}
              />
            </svg>

            <PreviewNode x={0} y={55} category="DATA" name="Ticker Source" param="NVDA · 2020–24" dot="bg-eq-blue" />
            <PreviewNode x={250} y={100} category="CLEAN" name="Log Returns" param="col: Close" dot="bg-eq-amber" />
            <PreviewNode x={250} y={170} category="SIGNAL" name="EMA" param="span: 20" dot="bg-eq-accent" />
            <PreviewNode x={500} y={135} category="MODEL" name="Threshold Sig" param="thresh: 0.0" dot="bg-eq-green" />
            <PreviewNode x={750} y={195} category="EVAL" name="Backtest" param="cost: 1bps" dot="bg-eq-red" />

            <div className="absolute top-3 left-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-eq-cyan-dim border border-eq-cyan/30 text-[10px] font-mono text-eq-cyan">
              <Sparkles size={10} />
              Generated by Bloom
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/enter"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gemini text-white text-[14px] font-medium hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-eq-accent/30"
          >
            Try it free
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function PreviewNode({
  x,
  y,
  category,
  name,
  param,
  dot,
}: {
  x: number
  y: number
  category: string
  name: string
  param: string
  dot: string
}) {
  return (
    <div
      className="absolute w-[130px] bg-bg-2 border border-eq-border-2 rounded-lg text-[10px] shadow-lg"
      style={{ left: x + 'px', top: y + 'px', animation: 'var(--animate-float)' }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-eq-border">
        <div className={`w-1.5 h-1.5 rounded-sm ${dot}`} />
        <span className="text-[8px] text-eq-t3 font-mono uppercase tracking-wider">
          {category}
        </span>
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium text-eq-t1 truncate">{name}</div>
        <div className="text-[9px] text-eq-t3 font-mono truncate">{param}</div>
      </div>
    </div>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-eq-border bg-bg-1 px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div>
          <div className="text-[13px] font-semibold text-eq-t1 tracking-tight">
            Signal<span className="text-gemini">Tracer</span>
          </div>
          <div className="text-[11px] text-eq-t3 mt-1 font-mono">
            Visual quant research · powered by Gemini
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-4 text-[11px] text-eq-t3">
          <a
            href="https://github.com/ayyagarisujanreddy123/EzQuant"
            target="_blank"
            rel="noopener"
            className="hover:text-eq-t1 transition-colors"
          >
            GitHub
          </a>
          <Link href="/enter" className="hover:text-eq-t1 transition-colors">
            Sign in
          </Link>
          <Link href="/enter" className="hover:text-eq-t1 transition-colors">
            Sign up
          </Link>
          <span className="text-eq-t3">© 2026</span>
        </div>
      </div>
    </footer>
  )
}
