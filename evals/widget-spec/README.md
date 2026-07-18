# Studio WidgetSpec corpus evaluation

This evaluation keeps the V1 example library honest as the schema and player
evolve. The manifest combines the canonical package fixtures with polished
examples under `examples/studio/` and states the capabilities each example is
expected to demonstrate.

Run it from the repository root:

```bash
npx tsx evals/widget-spec/run.ts
```

The evaluation checks:

- canonical structural, semantic and safety validation;
- at least three examples in each generated V1 family;
- coverage of science, mathematics, English and humanities at upper-primary
  and secondary levels;
- family-specific components, interactions, variables, assets, hotspots and
  plot series;
- learning objectives, instructions, discoverability tags and locale metadata;
- useful feedback, diagram alternative text and plot descriptions; and
- unique example IDs and titles.

The image-backed examples deliberately describe processed publication assets by
their `WidgetSpec` metadata. The binary classroom artwork is a separate content
asset and is not embedded in this evaluation corpus.
