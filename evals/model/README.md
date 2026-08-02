# Live HTML artifact evaluation

This harness evaluates an OpenAI-compatible provider against classroom briefs
for the Studio HTML rewrite. The canonical output shape is `{html,
designCard?}`. `artifact-eval.mjs` parses plain or fenced JSON, applies the same
checks used by the seed corpus, and heuristically checks requested interaction,
locale and content markers.

Run the focused helper tests without provider credentials:

```sh
node --test evals/model/artifact-eval.test.mjs
```

Run the live generation corpus with:

```sh
DEEPSEEK_API_KEY=... npx tsx evals/model/run.ts
```

Set `EVAL_MODEL` and `EVAL_BASE_URL` for another OpenAI-compatible provider.
Each candidate gets at most two finding-led repairs. Results deliberately omit
the full generated HTML.

Run the separate publication-gate probes with:

```sh
DEEPSEEK_API_KEY=... npx tsx evals/model/moderation.ts
```

The probes contain safe, age-appropriate artifact briefs and deliberately
unsafe requests. They assess the provider's decision without asking it to emit
unsafe HTML. The older `requests.json` remains temporarily for downstream DSL
evaluation consumers; `artifact-requests.json` is the rewrite corpus.
