# Contagem Regressiva — Alexa Skill

> Alexa skill in Brazilian Portuguese (`pt-BR`) that reports rocket launches: today, tomorrow, and the next 5 upcoming launches, with vehicle, mission, launch provider, time and launch pad.

- **Locale:** `pt-BR` (Brazil)
- **Invocation name:** `contagem regressiva`
- **Hosting:** Alexa-Hosted (Node.js), region US East (N. Virginia)
- **Runtime:** Node.js 16

---

## Table of Contents

- [About](#about)
- [Data source](#data-source)
- [Features](#features)
- [Repository structure](#repository-structure)
- [Implementation notes](#implementation-notes)
- [Development](#development)
- [Publishing](#publishing)
- [Roadmap](#roadmap)
- [License](#license)

---

## About

**Contagem Regressiva** ("Countdown") lets users ask Alexa about upcoming rocket launches in natural language:

```
Alexa, open contagem regressiva
Alexa, ask contagem regressiva if there is a launch tomorrow
Alexa, ask contagem regressiva what are the next launches
```

The skill answers with the launch vehicle, mission name, launch provider, local launch time (Brazil time) and launch pad. Outside its supported scope (any date beyond today/tomorrow and the next 5 launches) it replies with a guided message suggesting valid questions.

## Data source

| Item | Value |
| --- | --- |
| API | [RocketLaunch.Live](https://rocketlaunch.live) free endpoint |
| URL | `https://fdo.rocketlaunch.live/json/launches/next/5` |
| Auth | None (no API key required) |
| Timezone used | `America/Sao_Paulo` |
| Spoken attribution | "Dados por RocketLaunch ponto Live." |

- Launch times are displayed in **Brazil time** regardless of launch location.
- This skill is not affiliated with, sponsored by, or endorsed by RocketLaunch.Live, nor by any launch provider or mission shown in its responses.

## Features

| Intent | Trigger example | Behavior |
| --- | --- | --- |
| `LaunchRequest` | "open contagem regressiva" | Lists launches scheduled for today |
| `GetLaunchesIntent` | "tem lançamento de foguete {fecha}" | Slot `fecha` (`AMAZON.DATE`); answers for today/tomorrow; any other date → scope message |
| `GetNextLaunchesIntent` | "quais são os próximos lançamentos" | Lists up to 5 upcoming launches chronologically |
| `AMAZON.HelpIntent` | "ajuda" | Explains supported questions |
| `AMAZON.FallbackIntent` | (unrecognized) | Friendly reprompt with example questions |
| `AMAZON.Cancel/StopIntent` | "pare" | Ends session |

Scope message (out of scope dates):

> Só tenho informações dos lançamentos de hoje, de amanhã e dos próximos 5 lançamentos. Tente perguntar: tem lançamento amanhã, ou quais são os próximos lançamentos?

## Repository structure

```
alexa-contagem-regressiva/
├── index.js                 # Lambda backend (request handlers, API client, SSML)
├── GetLaunchesIntent.json   # Interaction model fragment: intent + slot "fecha"
├── assets/
│   ├── contagem_regressiva_108x108.png   # Small skill icon
│   └── contagem_regressiva_512x512.png   # Large skill icon
└── README.md
```

## Implementation notes

- **No `fetch`** — the Alexa-Hosted runtime is Node.js 16, which has no global `fetch`. All HTTP calls use the built-in `https` module with a 10s timeout.
- **SSML escaping** — API data can contain `&`, `<`, `>` (e.g. mission names like `NeonSat-2 to 6 & Others`). Unescaped characters produce invalid SSML and Alexa replies with *"a problem occurred with the skill's response"*. `escapeXml()` and `cleanMission()` sanitize every dynamic value inserted into `<speak>`.
- **Launch timestamps** — prefer `t0` (exact time) and fall back to `sort_date` (Unix seconds); items without a timestamp are filtered out of the "next launches" list.
- **Slot reading** — `Alexa.getSlotValue()` must be called with `handlerInput.requestEnvelope`, not `handlerInput`.
- **Scope guard** — dates outside today/tomorrow are rejected before any API call.

## Development

1. Open the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → your skill → **Code**.
2. Paste `index.js` into `lambda/index.js` → **Save** → **Deploy** (wait for "Deployment successful").
3. If the interaction model changed (intents/slots/samples): **Build** tab → **Save Model** → **Build Skill**.
4. Test in the **Test** tab (development mode):

   ```
   open contagem regressiva
   tem lançamento de foguete amanhã
   quais são os próximos lançamentos
   tem lançamento na próxima semana   ← expects the scope message
   ```

## Publishing

Distribution checklist (all required before submission):

| Section | Setting |
| --- | --- |
| Availability | Public — Brazil (`pt-BR`) |
| Store Detail | Name, short/long description, 3 example phrases, category, keywords |
| Privacy & Compliance | Purchases: **No** · Advertising: **No** · Personal data: **No** · Children under 13: **No** · Export compliance: confirmed |
| Testing Instructions | Steps, hardware notes, data source / rights link |
| Skill icons | `assets/*.png` (108×108 and 512×512) |

Flow: **Certification → Validation → Run** → fix reported issues → **Submission → Certify and publish now**.

Every code change (including post-publication fixes) goes through certification again; the currently live version keeps serving users until the new one is approved.

## Roadmap

- [ ] `en-US` locale: bilingual invocation (`rocket countdown`) and responses selected by `Alexa.getLocale()`
- [ ] Q&A / quiz mode about space and rockets, per locale
- [ ] Wider date range (if a paid API tier is adopted)

## License

Code in this repository is released under the [MIT License](LICENSE).

RocketLaunch.Live data is provided by RocketLaunch.Live and is subject to its own terms of use; this skill only queries its public endpoint and does not claim affiliation with RocketLaunch.Live or any launch provider.
