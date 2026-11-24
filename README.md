# IPV Dynamic Prototype

Prototyping a dynamic routing engine for IPV journeys.

## What is this?

A spike exploring how to replace static hardcoded CRI sequencing with dynamic journey routing based on GPG45 constraint satisfaction. Instead of following a fixed path, the engine evaluates a user's current identity scores and calculates the shortest route to a valid target profile.

### Current state

A CLI simulation of a web proving journey targeting `P1`, `P2` or `P3`. The user answers a
short triage form, then the engine decides each next step. Every CRI has a list of stub
results it can return, successful and failed, and you pick which one comes back, so you can
see how the journey reacts to a failed or weaker-than-expected check.

Contra-indicators are not modelled yet: stub results that carry a CI are left out.

Have a play around, for example toggle one of the `enabled` flags in the CRI config file and see what happens to your journey... you could even try changing the profiles in the policy file!

## Architecture

Three components, plus a simulator that wires them together and stands in for the CRIs:

- **core-front** owns the questions and the session: the user's answers (their
  capabilities), the CRIs already attempted and the required level of confidence.
- **engine** plays the role of core-back. It owns the policy, the CRI config, the GPG45
  scoring and the route planning, and answers one question: "what next?"
- **evcs** stores the user's verifiable credentials.

The engine is stateless: each call works only from core-front's request and the
credentials it reads from EVCS, and keeps nothing afterwards. For now the simulator writes
credentials to EVCS; that may move into the engine, or more likely into a separate component
like core-back's `process-cri-callback`.

## How the engine works

The engine is driven by two inputs. The CRI config says what each CRI needs from a user and
what it can award. The `UserCapabilities` in core-front's request say what this user has:
where they live, their device, their documents. Checking one against the other is what
decides which CRIs the engine can use for this user.

On each request the engine:

1. Fetches the user's credentials and scores them the way core-back does: strength and
   validity stay paired per document, and the highest activity, fraud and verification
   scores are taken across all credentials.
2. Returns `COMPLETE` if those scores meet a profile for the requested level.
3. Otherwise works out which CRIs the user can still do, based on their answers. Each CRI
   is in one of six states: available, forced (the only option in its group), ask first
   (usable, but the CRI has its own question to put to the user), not asked yet, second
   chance (ruled out by the user's answer, but can be offered once more), or ruled out.
4. Plans every combination of remaining CRIs that would reach a profile, assuming each
   check returns its best result, and ranks them. Routes the user has already confirmed
   they can do come first, then routes that need a new question, then second chances.
5. Returns `REDIRECT` with the next CRI, `ASK` with a batch of questions, or `STOP` when no
   route is left.

An `ASK` batch is built by the engine playing out the "no" answers itself, so a question is
only included if it can still lead to an identity after "no" to all the ones before it. Each
question carries where to send the user on "yes", and the batch carries what happens if
every answer is "no", which keeps the number of calls from core-front down.

Two rules worth knowing: a forced CRI (the app for users living abroad) closes the rest of
its group for good, even after it has been attempted; and a CRI the user ruled out with
their own answer is offered once more when the other options run out.

## Project structure

```
src/
├── simulator.ts        # CLI entry point — runs the journey loop, stands in for the CRIs
├── render.ts           # Terminal tables and colour
├── shared/
│   ├── types.ts        # Shared types and enums
│   ├── checks.ts       # Every CRI's stub results and the identity data it collects
│   ├── gpg45.ts        # GPG45 scoring and profile matching, as in core-back
│   └── capabilities.ts # Applying a user's answer to their capabilities
├── core-front/
│   ├── core-front.ts   # Session, asking the engine's questions, choosing a redirect
│   ├── triage.ts       # Triage form and answers → capabilities mapping
│   ├── questions.ts    # Triage question copy
│   └── labels.ts       # CRI names and labels
├── engine/
│   ├── engine.ts       # The brains - decides the next step and builds the question batch
│   ├── planner.ts      # Finds every route to a profile and ranks them
│   ├── eligibility.ts  # Which CRIs the user can do, given their answers
│   ├── gpg45.ts        # Which profiles apply to a level, and what a user is short of
│   ├── cri-config.ts   # CRI definitions — requirements, forcing, provides/requires/collects
│   └── policy.ts       # GPG45 profiles, profiles per level, mandatory checks, required data
└── evcs/
    └── evcs.ts         # In-memory credential store
```

## Running

To run the CLI simulator:

```bash
npm install
npm run dev
```

Uses `tsx` to compile and run TS on the fly (no build step required). Node 22+.

### Debug

```bash
npm run debug
```

Attaches a debugger on the default inspect port. Use VSCode launch config or `chrome://inspect`.
