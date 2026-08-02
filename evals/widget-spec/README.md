# Studio HTML artifact corpus evaluation

This compatibility entry point now validates the clean-rewrite corpus under
`examples/studio-html/`. It checks manifest completeness and uniqueness,
source-file parity, the 200 KB limit, complete inline HTML/CSS/JavaScript,
locale/title agreement, no external imports or network use, and core subject
and level coverage.

Run it from the repository root:

```bash
npx tsx evals/widget-spec/run.ts
```

The historical `corpus.json` is retained temporarily for integrations that
still inspect the old WidgetSpec corpus. It is not the source of truth for the
HTML rewrite.
