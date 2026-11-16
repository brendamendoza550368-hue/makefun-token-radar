# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/brendamendoza550368-hue/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/brendamendoza550368-hue/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 227 pre-token protocols by implied value (TVL × category multiple × growth multiplier × maturity multiplier) on a sortable, filterable board, with per-protocol detail views, a live-tokens view, and a method & calibration page. Each category's multiple is the median market-cap/TVL of that category's own traded protocols, clamped to [0.05, 3]; categories with fewer than 3 traded peers fall back to the universe median and are flagged as such.

## Run it

```sh
cd dashboard && python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
