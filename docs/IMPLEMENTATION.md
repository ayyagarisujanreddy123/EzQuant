# EzQuant Frontend — Implementation Reference

## Component Tree

```
AppShell (nav + ⌘K dispatcher)
├── /projects → ProjectsPage
│   ├── Template cards (MOCK_TEMPLATES)
│   ├── Project cards (fetchProjects placeholder)
│   └── CopilotPanel [pageContext: projects]
├── /canvas/[id] → CanvasPage
│   ├── TopBar (run button, project name)
│   ├── BlockPalette (drag sources)
│   ├── Canvas (ReactFlow)
│   │   └── BlockNode (all 14 types)
│   ├── Inspector (Data / Params / Eval tabs)
│   ├── CopilotPanel [pageContext: canvas, onPipelineGenerated]
│   └── BottomDrawer (Registry + Console)
└── /gallery → GalleryPage
    ├── Template grid with mini-node previews
    ├── Generate-with-Copilot card
    └── CopilotPanel [pageContext: gallery]
```

## State Ownership

| State | Owner | Notes |
|---|---|---|
| `nodes, edges` | `canvasStore` (Zustand) | Shared: Canvas, Inspector, BottomDrawer, Copilot callback |
| `selectedNodeId` | `canvasStore` | Inspector reads it to render tabs |
| `messages, mode, attachments, isStreaming` | `useCopilot` hook | Local to each CopilotPanel instance |
| `projects` | Local `useState` | ProjectsPage only |
| `isRunning, projectName` | Local `useState` | CanvasPage top bar |
| `tab` | Local `useState` | Inspector only |
| `collapsed` | Local `useState` | BottomDrawer only |
| `draft, showSlash` | Local `useState` | CopilotPanel composer |

## TODO Locations — Backend Wire-Up Points

All placeholders live in `lib/api/placeholders.ts`:

| Function | Line | Backend wire-up |
|---|---|---|
| `streamCopilotChat` | 12 | `POST /api/agent/chat` SSE endpoint |
| `fetchProjects`     | 61 | Supabase `projects` table, `SELECT *` |
| `fetchProject`      | 67 | Supabase `projects` table, `SELECT * WHERE id = ?` |
| `runPipeline`       | 74 | `POST /api/pipeline/run` with serialized graph |

## Swapping Placeholders for Real Endpoints

### `streamCopilotChat`
Replace the mock async generator with a real SSE reader:
```ts
const res = await fetch('/api/agent/chat', {
  method: 'POST',
  body: JSON.stringify({ message, pageContext, attachments }),
})
const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buf = ''
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buf += decoder.decode(value, { stream: true })
  // parse SSE frames; yield typed CopilotEvent objects
  const frames = buf.split('\n\n')
  buf = frames.pop()!
  for (const f of frames) yield JSON.parse(f.replace(/^data: /, ''))
}
```

### `fetchProjects` / `fetchProject`
Import a Supabase client and query the `projects` table. Return shape MUST match `Project` type in `types/index.ts` — especially `graph` (optional `PipelineGraph`).

### `runPipeline`
POST the serialized `PipelineGraph` to `/api/pipeline/run`. Stream status updates back via SSE or poll, calling `canvasStore.setStatuses()` as each node completes. The Run animation loop in `app/canvas/[id]/page.tsx:36-48` needs to be replaced with a real status subscription.

## ⌘K Flow

1. `AppShell` listens to `keydown` on `window` → dispatches `CustomEvent('focus-composer')`
2. Each mounted `CopilotPanel` listens to `'focus-composer'` on `document` and focuses its textarea
3. Only the visible panel's textarea visibly reacts (others are unmounted or offscreen)

## Run Animation Flow

1. `handleRun()` in CanvasPage calls `setStatuses({all → 'running'})`
2. A `setTimeout` loop iterates nodes, setting each to `'success'` with a 280ms stagger
3. `BlockNode` reads `data.status` and swaps the `STATUS_DOT` utility class
4. When backend wires up: replace the timeout loop with real status events from `runPipeline`

## Canvas Drag-Drop Flow

1. `BlockPalette` sets `dataTransfer.setData('application/block-type', blockType)` on drag start
2. `Canvas.onDrop` reads that key, looks up `CATALOG_BY_TYPE[blockType]`, builds a `CanvasNode` with default params from the schema, and calls `canvasStore.addNodes([newNode])`
3. New user-dragged nodes get `source: 'user'` — no cyan glow. Copilot-generated nodes get `source: 'copilot'` → glow applied by `BlockNode`

## Copilot Pipeline Generation Flow

1. User types a strategy-keyword request in the composer
2. `useCopilot.send()` calls the placeholder async generator
3. When a `suggest_pipeline_template` event arrives, the hook invokes `onPipelineGenerated(graph)`
4. CanvasPage's callback calls `canvasStore.setNodes(graph.nodes) + setEdges(graph.edges)`
5. `applied_banner` event triggers green `AppliedBanner` in the last agent message

## Tailwind v4 Notes

No `tailwind.config.ts` — this project uses Tailwind v4's CSS-first `@theme` block in `app/globals.css`. To add a color, add `--color-<name>: <hex>;` inside `@theme` and it becomes available as `bg-<name>`, `text-<name>`, `border-<name>`, etc.
