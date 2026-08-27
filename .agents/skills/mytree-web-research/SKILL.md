---
name: mytree-web-research
description: Use when MyTree work depends on current external documentation, SDK behavior, vendor policies, legal/operational constraints, competitor patterns, SEO/discovery research, Google/LINE/Expo/Cloudflare/Supabase updates, or other facts that may have changed.
---

# MyTree Web Research

## Source order

Use this priority unless the task requires otherwise:

1. MyTree Bible/current repo for internal product decisions.
2. First-party vendor documentation for SDK/API/policy behavior.
3. Official changelogs/release notes.
4. High-quality secondary sources for implementation patterns.
5. Community reports only as supporting evidence, not authority.

Firecrawl, if installed, is a research accelerator only. It does not override source hierarchy.

## Workflow

1. State what current external fact must be verified.
2. Search first-party sources first.
3. Record publication/update dates when recency matters.
4. Separate documented fact from inference/recommendation.
5. Check the installed/current project version before applying generic vendor guidance.
6. Do not paste third-party examples into production without adapting to MyTree security and architecture constraints.
7. For Google Places/Maps, respect current attribution, caching, storage, and usage policies; do not scrape/copy Google business data into permanent MyTree merchant records.
8. For SEO, distinguish runtime seed/discovery data from MyTree-owned/claimed/indexable content.
9. For LINE/Expo/Cloudflare/Supabase, prefer official docs matching the project's active SDK/API version.

## Research outputs

Return:

- verified current facts,
- sources and dates,
- impact on MyTree,
- recommendation,
- implementation changes required (if any),
- unresolved uncertainty that should block coding.

## When not to use web research

Do not research externally merely to answer a question already settled by the current Bible or source code. Internal product decisions remain internal authority.
