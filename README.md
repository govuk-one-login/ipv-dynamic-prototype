# IPV Dynamic Prototype

Prototyping a dynamic routing engine for IPV journeys.

## What is this?

A spike exploring how to replace static hardcoded CRI sequencing with dynamic journey routing based on GPG45 constraint satisfaction. Instead of following a fixed path, the engine evaluates a user's current identity scores and calculates the shortest route to a valid target profile.

### Current state

An extremely trivial happy-path-only CLI simulation of a basic web proving journey targeting profiles M1A/M1B. Every CRI check is assumed to succeed with the maximum possible scores.

Have a play around, for example toggle one of the `enabled` flags in the CRI config file and see what happens to your journey... you could even try adding more profiles into the policy file!

## Project structure

```
src/
├── simulator.ts    # CLI entry point — runs the interactive journey loop
├── engine.ts       # The brains - decides the next step based on current state
├── scorer.ts       # Profile satisfaction checks — has a target been met?
├── cri-config.ts   # CRI definitions — what each check provides/requires plus special flags
├── policy.ts       # Target profiles, mandatory checks, required data
└── types.ts        # Shared types and enums
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
