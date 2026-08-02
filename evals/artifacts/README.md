# Studio HTML artifact corpus evaluation

This evaluation validates the canonical corpus under `examples/studio-html/`.
It checks manifest completeness and uniqueness,
source-file parity, the 200 KB limit, complete inline HTML/CSS/JavaScript,
locale/title agreement, no external imports or network use, and core subject
and level coverage.

Run it from the repository root:

```bash
npm run eval:artifacts
```
