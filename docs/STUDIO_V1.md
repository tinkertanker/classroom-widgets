# Classroom Widgets Studio V1

Classroom Widgets Studio is an iPad app for creating one focused, interactive
classroom widget and publishing it as one student-facing link. It complements
the existing Classroom Widgets web dashboard; it does not replace or reproduce
the dashboard.

The August 2026 pilot targets 10–20 Singapore upper-primary and secondary
teachers. The first release must be safe enough for real classroom use and must
run on an A16 iPad without depending on Apple Intelligence.

## Product promise

> Make the small interactive tool your next lesson needs, then share one link.

Teachers should never have to begin from an empty prompt. They can explore a
finished example, remix one, or answer a few short questions about their
learning intention and the action students should take.

Each Studio project contains exactly one widget. Each publication exposes
exactly one responsive widget without authoring controls, accounts, adverts or
analytics.

## Experience direction

### Visual thesis

A calm, tactile teaching workbench: warm paper-like surfaces, strong editorial
type, one sage action colour and large previews that make the lesson artefact—not
the surrounding interface—the visual focus.

Studio should feel considered and native, not like a dashboard made of cards.
Use open layouts, quiet dividers and generous spacing. A card is appropriate
only when the object itself is selectable, such as an example or saved widget.

### Content plan

- **Explore:** one featured, immediately runnable teaching widget followed by a
  concise subject/level-filtered library.
- **Make:** one question at a time, followed by a plain-language brief that the
  teacher approves before generation.
- **Editor:** the student preview is dominant; Prompt, Arrange and Inspect add
  context without competing with it.
- **My Widgets:** recency, publication state and the next useful action are
  visible at a glance.
- **Publish:** test, check, publish, then show the URL and QR code as the single
  successful outcome.

### Interaction thesis

- Moving from one guided answer to the next uses a short directional transition
  so the interview feels finite and purposeful.
- Generating or patching keeps the existing preview visible and marks only the
  changed region; a revision must not visually replace a working widget with a
  blank loading state.
- Switching between authoring and “Test as student” uses a restrained matched
  transition into a full-screen, chrome-free preview.

Motion must respect Reduce Motion and never delay a teacher who is preparing a
lesson.

## V1 journey

1. Open **Explore**, **Make** or **My Widgets**.
2. Use/remix an example, or answer short guided questions.
3. Approve the generated classroom brief.
4. Generate a constrained `WidgetSpec`.
5. Preview it using the same player students will receive.
6. Refine it with a prompt or direct property edit; undo remains available.
7. Test it as a student and resolve blocking validation/accessibility findings.
8. Publish an unlisted URL, then copy it, display a QR code or use the iPad share
   sheet.
9. Extend or revoke the publication from the originating device.

## Product boundaries

The existing teacher web app, student app and Express/Socket.io server remain
first-class products. Studio is additive and independently deployable. The
unfinished macOS wrapper is outside the Studio roadmap.

Published V1 widgets:

- require no student account;
- collect no student identity, submissions or analytics;
- use no student-facing AI;
- keep transient interaction state in the browser only;
- cannot execute generated JavaScript or import packages;
- cannot contact arbitrary external services;
- contain no advertising or behavioural tracking.

The service may store the teacher-authored specification, processed assets,
ownership metadata, versions, expiry and moderation state. Provider keys never
ship in the iPad app. Public product copy and repository history must not refer
to confidential third-party involvement in the project.

## System boundary

```text
SwiftUI authoring app
        |
        | HTTPS: briefs, generate, patch, assets, publish
        v
Studio API -----> configurable model providers
        |
        +-------> publication metadata and processed assets

WidgetSpec JSON -----> deterministic validation
        |
        +-------> bundled player in iPad WKWebView
        |
        +-------> public player at one unlisted URL
```

`WidgetSpec` is the canonical, versioned contract. It is represented by JSON
Schema and generated/derived TypeScript and Swift models. Only declared
components, properties, actions, variables and safe expressions are renderable.
Unknown properties fail validation rather than being guessed.

The iPad app owns navigation, local projects and versions, guided authoring,
Photos/Files/Camera integration, sharing, accessibility and secure device
ownership credentials. `WKWebView` is used only for the controlled activity
player so author preview and public output have rendering parity.

The Studio API is separate from the real-time Classroom Widgets server even
though both live in this monorepo. It owns model routing, bounded repair,
validation, rate limits, assets, publication and revocation.

## Supported content

Ready-made/remixable widgets:

- timer;
- randomiser and spinner;
- task list;
- traffic light.

Generated families:

- quizzes and retrieval practice;
- matching, sorting and sequencing;
- interactive diagrams and hotspots;
- graph explorers and simple simulations.

V1 supports up to three teacher images per widget. Inputs are size-limited,
resized, compressed and stripped of metadata before publication. Each meaningful
image requires alternative text; decorative images are explicitly marked.

## First end-to-end slice

The first shippable slice is intentionally narrow but uses the final
architecture:

```text
Three-question guided brief
        -> validated quiz WidgetSpec
        -> shared player in iPad preview
        -> one targeted revision with undo
        -> publish to an unlisted URL
        -> complete locally in Safari
        -> revoke and receive a friendly unavailable page
```

This slice is not the definition of V1 completion. It proves the contract and
deployment path before the other required widget families and production gates
are added.

## Verification gates

- Existing web workspaces continue to build and their tests remain green.
- Schema fixtures include valid and deliberately invalid examples.
- Invalid, unsupported or unsafe specifications cannot preview or publish.
- Patch tests prove unrelated working content is preserved.
- Player fixtures cover keyboard, VoiceOver semantics, contrast, Dynamic Type
  where applicable, reduced motion and student-phone layouts.
- Ownership, high-entropy slugs, expiry, extension, rate limiting and revocation
  have automated coverage.
- At least three representative widgets, including a simulation, complete the
  physical-iPad-to-public-Safari flow before pilot release.
- The app builds and runs on the installed A16 iPad simulator and archives for a
  generic iOS device.
- A TestFlight/App Store-ready archive, privacy/data-flow documentation,
  deployment instructions and pilot recovery procedure exist before release.
