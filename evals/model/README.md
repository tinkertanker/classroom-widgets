# Live HTML artifact evaluation

This harness runs the Studio API's production provider, prompts, output checks
and one-repair path against classroom briefs. Each request includes up to two
reviewed, subject-matched HTML exemplars. `artifact-eval.mjs` adds the seed
corpus render checks and heuristically checks requested interaction, locale and
content markers.

Run the focused helper tests without provider credentials:

```sh
node --test evals/model/artifact-eval.test.mjs
```

Run the live generation corpus with:

```sh
DEEPSEEK_API_KEY=... npx tsx evals/model/run.ts
```

Set `EVAL_MODEL` and `EVAL_BASE_URL` for another OpenAI-compatible provider.
Each candidate gets at most one finding-led repair. Results deliberately omit
the full generated HTML.

Run the separate publication-gate probes with:

```sh
DEEPSEEK_API_KEY=... npx tsx evals/model/moderation.ts
```

The probes contain safe, age-appropriate artifact briefs and deliberately
unsafe requests. They assess the provider's decision without asking it to emit
unsafe HTML. `artifact-requests.json` is the generation corpus.
