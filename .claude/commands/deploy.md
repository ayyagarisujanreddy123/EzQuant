# Deploy Command

Run full deploy pipeline.

## Steps
1. Run tests: `npm test`
2. Type check: `npm run typecheck` (if TypeScript)
3. Build: `npm run build`
4. Deploy: depends on target (Vercel / Railway / Fly.io)

## Vercel (fastest for hackathon)
```bash
npx vercel --prod
```

## Railway
```bash
railway up
```

## Fly.io
```bash
fly deploy
```

## Pre-deploy checklist
- [ ] `.env.example` updated with new vars
- [ ] No console.log left in production paths
- [ ] Build passes locally
- [ ] API keys in environment, not hardcoded
