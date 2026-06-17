#!/usr/bin/env python3
"""Alias existing theme CSS rules to the new theme ids.

  cream  -> white   (clean light look reused, slightly whiter)
  starry -> galaxy  (deep-space look reused)

We only duplicate selector text, swapping the data-rtheme id. The appended
block is wrapped in clear markers so it can be regenerated idempotently.
"""
import re, sys, pathlib

CSS = pathlib.Path("client/src/index.css")
START = "/* === BEGIN auto-generated theme aliases (white<-cream, galaxy<-starry) === */"
END = "/* === END auto-generated theme aliases === */"

text = CSS.read_text()

# Strip any previous generated block so re-running is safe.
text = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", text, flags=re.S)

# Find every rule (selector { ... }) that mentions data-rtheme="cream" or "starry".
# Simple, robust split on top-level "}" since this stylesheet has no nested @rules
# around these theme selectors.
rule_pattern = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)

aliases = []
for m in rule_pattern.finditer(text):
    selector = m.group(1)
    body = m.group(2)
    if 'data-rtheme="cream"' in selector:
        new_sel = selector.replace('data-rtheme="cream"', 'data-rtheme="white"')
        aliases.append(f"{new_sel.strip()} {{{body}}}")
    if 'data-rtheme="starry"' in selector:
        new_sel = selector.replace('data-rtheme="starry"', 'data-rtheme="galaxy"')
        aliases.append(f"{new_sel.strip()} {{{body}}}")

block = [START,
         "/* White Basic reuses the cream light styling; Galaxy reuses starry. */"]
block.extend(aliases)
# A few tweaks so White reads cleaner/whiter than cream:
block.append('html[data-rtheme="white"] body { background: #ffffff !important; '
             'background-image: radial-gradient(circle at 50% 0%, rgba(120,160,255,0.05) 0, transparent 45%) !important; '
             'color: #1f2937 !important; }')
block.append('html[data-rtheme="white"] .chalkboard, '
             'html[data-rtheme="white"] .cozy-card, '
             'html[data-rtheme="white"] .classroom-card { '
             'background: #ffffff !important; border: 1px solid rgba(15,23,42,0.10) !important; '
             'box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06) !important; color: #1f2937 !important; }')
block.append('html[data-rtheme="white"] aside, '
             'html[data-rtheme="white"] [aria-label="Sidebar"] { '
             'background: #f8fafc !important; border-right: 1px solid rgba(15,23,42,0.08) !important; color: #1f2937 !important; }')
block.append('html[data-rtheme="white"] .chalk-white, '
             'html[data-rtheme="white"] aside .chalk-white { color: #1f2937 !important; }')
block.append('html[data-rtheme="white"] aside .chalkboard { '
             'background: #eef2f7 !important; border: 1px solid rgba(15,23,42,0.12) !important; color: #1f2937 !important; }')
block.append(END)

CSS.write_text(text.rstrip() + "\n\n" + "\n".join(block) + "\n")
print(f"Appended {len(aliases)} aliased rules (white + galaxy).")
