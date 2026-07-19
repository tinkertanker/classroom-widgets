# Live model evaluation

This harness evaluates a configured provider against 13 representative,
non-personal teacher briefs spanning the V1 subjects, levels and interaction
families. It records first-pass schema validity, bounded repair success, family
fidelity, targeted-patch reliability and latency without retaining full model
outputs.

Run it with:

```sh
DEEPSEEK_API_KEY=... npm run eval:model
```

The command defaults to `deepseek-v4-flash`. Override `EVAL_MODEL` and
`EVAL_BASE_URL` to compare another OpenAI-compatible provider. A production
model is accepted only when every case validates after at most two repairs, at
least 80% validate on the first pass, at least 80% contain the requested family
primitives, and all sampled targeted edits preserve the working structure.

Run `npm run eval:model-moderation` as a separate publication-gate probe. It
must classify every age-appropriate and deliberately unsafe fixture correctly.
