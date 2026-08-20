---
title: Passing a catalog into an LLM prompt as a typed parameter
date: 2026-08-20
project: classroom-widgets
tags:
  - baml
  - llm
  - prompt-engineering
  - single-source-of-truth
  - testing
status: unread
---

Think of a restaurant where the menu is printed on laminated cards and the
kitchen keeps its own separate list of what it can actually cook. Every time the
kitchen adds a dish, somebody has to remember to reprint the cards. They never
do. Six months later the card offers eight dishes, the kitchen cooks twenty, and
a customer orders something the card lists that the kitchen stopped making. That
was the state of the voice command prompt in this project: the canonical list of
widgets and actions lives in one JSON file, and the prompt text sent to the
local language model carried a hand-typed copy that had drifted to eight widgets
and twelve actions, with one widget offered as a target that had no matching
action at all.

The interesting part is what we did *not* do to fix it. The obvious move is to
generate the prompt file from the JSON — write a script that reads the catalog
and writes the prompt text out, commit the result, and call it solved. This
project already has that pattern: a generator turns the shared JSON into two
committed constants files, one TypeScript for the teacher app and one JavaScript
for the server. Extending it to also emit prompt text would have been a small
script. It would also have recreated the exact bug we were fixing, just one
level up. Committed generated text can sit stale in the tree whenever somebody
edits the source and forgets to run the generator, and unlike compiled code
nothing fails loudly when prompt text is out of date. The model just quietly
gets a worse menu.

So instead the catalog became a function argument. The prompt lives in a BAML
file — BAML being a small declarative language where you declare a function with
typed parameters and a typed return value, write the prompt as a template over
those parameters, and a code generator hands you a strongly typed client to call
it. The prompt body is a minijinja template, the same family as Jinja2 from
Python, so it can loop and filter over whatever you pass in. We changed the
function's signature from taking just a transcript string to taking a transcript
plus two string arrays, one of widget target names and one of action names, and
replaced the two hardcoded catalog lines with template expressions that join
each array with commas. The server service then derives those two arrays from
the generated constants once at module load and passes them on every call. There
is now exactly one place a widget name is written down, and the prompt reads it
at runtime. The catalog physically cannot be stale, because there is no second
copy to go stale.

One detail worth knowing before you try this: BAML has no way to import or
include external data into a prompt file. There is no equivalent of reading a
JSON file from inside the template. The only channel into a prompt is the
function's typed parameters, which is precisely why the parameter route is the
one that gives you a single source of truth.

We did not assume minijinja's join filter would work — we checked. The generated
client exposes a request builder alongside the normal call: instead of invoking
the model, it renders and returns the HTTP request body the model *would* have
received. That gave us the fully rendered prompt as a string, printed to the
terminal, showing all thirty-three action names and all twenty widget targets in
the right places, with no network call and no waiting on a model. Being able to
inspect a rendered prompt without spending a model call is the single most
useful debugging affordance in this kind of framework, and it is worth reaching
for first whenever a prompt is not behaving. The fallback plan, had the filter
not existed, was to pass two plain strings pre-joined with commas in JavaScript
— the same guarantee, zero template uncertainty — but the observed rendering
made that unnecessary.

Two trade-offs came out of this. First, the prompt got much longer: a 0.5
billion parameter model now reads twenty widget names and thirty-three action
names rather than eight and twelve. Small models genuinely degrade as the choice
space grows, so we ran the same fifteen transcripts through both catalogs, same
template and same model, changing only the arrays passed in. On the eight
transcripts the old narrow catalog could even express, the wide catalog scored
six of eight on action versus five of eight, and five of eight on target either
way — no measurable degradation, and both configurations noisy enough that the
model, not the prompt length, is the limiting factor. That is the right shape of
experiment to reach for here, because making the catalog an argument means you
can A/B two catalogs without touching a single line of code.

Second, we kept `UNKNOWN` written literally in the template rather than
appending it to the array in JavaScript. It is a sentinel the service checks for
when the model cannot parse a command, not a widget action, so it does not
belong in the shared JSON. Putting it in the template means no caller can forget
it. The alternative — appending it in the service — would work too but makes the
guarantee depend on every call site remembering.

The last piece was making this testable. The service lazy-loads the generated
TypeScript client through a transpiler at runtime and then talks to a local
model, neither of which you want in a unit test. So the constructor gained an
optional injected client: pass a fake object with a `ParseVoiceCommand` method
and the service uses it, pass nothing and production behaviour is unchanged.
The tests record what arguments the fake received and assert they match the
shared definitions, which means a future developer who hardcodes a list back
into the service gets a red test. We verified that by temporarily hardcoding the
old eight-widget list, watching four of nine tests fail, and reverting — a
regression test you have not seen fail is a regression test you do not know
works.

A short glossary. **BAML** (Basically A Made-up Language) is a declarative
language for defining typed LLM functions, from which a code generator emits a
typed client library. **minijinja** is a Rust implementation of the Jinja2
template language, used for BAML prompt bodies; the `join` filter turns a list
into a delimited string. **Sentinel value** is a special value used to signal
"none of the above" — here, `UNKNOWN`. **Test seam** is a deliberate injection
point in a class, usually a constructor parameter, that lets a test substitute a
fake for an expensive or external dependency. **Single source of truth** means
one canonical location for a piece of data, with everything else deriving from
it at runtime rather than holding a copy.
