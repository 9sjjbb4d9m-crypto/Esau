# zoalmon

A working, local French-learning MVP. Vanilla HTML/CSS/JavaScript and a dependency-free Node.js server. Requires Node.js 20 or later. No build step, account, database, or API key required for the core app.

## Run

```sh
npm start
```

Open http://localhost:3000 in your browser. Set `PORT` to change the port. The server binds to loopback for local use. Stop it with Ctrl+C. Always use the server rather than opening index.html directly.

## Included

- 24 A1 words/phrases in four topic decks, with IPA and example sentences.
- Flip-to-reveal vocabulary flashcards and spaced repetition. New/due cards are served first; Again returns in one minute; Hard, Good and Easy schedule later reviews. Successful repetitions grow the interval; Again resets the repetition count. Review timing is a lightweight SM-2-inspired algorithm, not a full SM-2 implementation.
- Randomized five-question English-meaning quizzes, feedback, scores and saved accuracy.
- French speech playback through browser speech synthesis. Speech recognition where supported, with permission/error feedback and normalized transcript comparison. Recognition does not measure accent quality. Recognition may use the browser vendor's network service; French voices vary by device. Listen and repeat remains available when recognition is unsupported. Microphone access requires localhost or HTTPS.
- Daily goals, streaks, a seven-day activity chart, learned-word counts and due dates. Dates follow the browser's local calendar. A learned word has at least one successful scheduled review; 21+ day intervals count as mastered.
- Local browser persistence, JSON progress export/import, and recovery from malformed saved data. Data does not sync across devices or private browsing sessions. Import replaces the current saved progress.
- Built-in exercise studio plus optional LLM exercises. Generated output is validated and rendered as text. Built-in exercises are a small fixed set; AI generation uses the selected topic.
- Responsive desktop/mobile layout and keyboard-operable controls.

## Optional AI

Set `OPENAI_API_KEY` in your terminal before starting the server. Never put it in the browser files or commit it. Example in bash (input is hidden):

```sh
read -rs -p 'OpenAI API key: ' OPENAI_API_KEY
export OPENAI_API_KEY
npm start
```

`OPENAI_MODEL` optionally overrides `gpt-4o-mini`. The server calls the OpenAI Chat Completions API and requests a JSON exercise. Your selected topic's vocabulary is sent; your review history is not. Provider usage may incur charges. AI exercises can contain mistakes. The core app and built-in exercises work without a key, provider access, or an internet connection after the app loads.

This environment has no configured provider key, so a live AI call was not made. Automated tests cover valid/malformed provider responses and failure handling using mocks. Production deployment/authentication, multi-user storage, rate limiting and a production secret manager are outside this local MVP.

## Tests

```sh
npm test
```

15 dependency-free Node tests cover scheduling, due filtering, daily statistics and streaks, persistence, recognition matching, seed content, static routes, AI configuration, topic scoping, response validation and API failures. Tests use ephemeral local servers and do not call paid APIs.

Optional browser regression suite (requires Playwright Core and an installed Chromium):

```sh
npm install --no-save playwright-core
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Set `CHROMIUM_PATH` to your Chromium executable as needed. The suite launches its own temporary server/browser, checks review persistence after reload, quizzes, exercises, progress, settings, topic selection and mobile overflow, then closes both. `QA_SCREENSHOTS` can point to an existing folder for desktop/mobile screenshots. Real microphone input and audio output require manual testing on the target device.

## Files

- `public/index.html`, `style.css`, `app.js`: interface and interactions.
- `public/core.js`: vocabulary, schedule, stats and validation.
- `server.mjs`: local static server and optional AI proxy.
- `test/`: dependency-free unit/integration tests.
- `qa/browser.mjs`: optional browser regression suite.


## Publish on GitHub Pages

The repository includes a GitHub Actions workflow for Pages. It publishes the static app from `public/` whenever changes are pushed to `main`. In the repository settings, open **Pages** and set **Build and deployment → Source** to **GitHub Actions**. After the workflow finishes, open the Pages URL shown there.

The static Pages version includes vocabulary, flashcards, reviews, quizzes, progress tracking, browser speech features, and built-in exercises. The optional AI exercise endpoint requires the Node server and an `OPENAI_API_KEY`; GitHub Pages serves static files and cannot run that endpoint. Keep the key out of the repository.

For local development, `npm start` runs the app and its optional AI endpoint at `http://localhost:3000`.


## English for Spanish speakers (A2+)

Open `/english/` in the local app or at the published Pages site for a separate English-learning experience. It includes 32 A2+ words and phrases, Spanish instructions and meanings, English example sentences, spaced-repetition flashcards, quizzes, progress tracking, English pronunciation practice where the browser supports speech, five Spanish-language grammar lessons, and contextual sentence-completion exercises with translations and explanations. Its progress is stored separately in the browser. The static GitHub Pages version includes this experience too.

## French A1 grammar in Spanish

Open `/#grammar` for 18 beginner French lessons, each with a Spanish explanation, a reference structure, translated examples and a contextual exercise. Topics cover pronouns, être and avoir, articles, gender and plural, the present tense, essential irregular verbs, negation, questions, adjectives, possessives and demonstratives, prepositions, quantities, existence, numbers and time, reflexives, near future and a first introduction to passé composé. The reader remembers the selected lesson and exercise attempts on the device; answers also count as practice activities. The lessons render one at a time in the existing light/dark themes.

## Adaptive English / French placement

Open /placement/ for server-scored adaptive assessment spanning estimated A1–C2. Grammar, vocabulary and reading are assessed independently; listening, writing and speaking are excluded and clearly labelled. Sessions resume, language histories are separate, results include uncertainty and recommendations, and homepages show the latest result.

Run npm start for the complete local experience. GitHub Pages requires a separate HTTPS Node API; the assessment screen includes a connection setting. See [assessment/README.md](assessment/README.md) for deployment, persistent storage, scoring and limitations. This is an editorial starter assessment, not a CEFR certification.

## Smoked-glass homepages

Both courses now open with a one-screen WebGL portal adapted to zoalmon's learning content. Three.js 0.169.0 and RoomEnvironment load through the jsDelivr import map; Inter is a variable WOFF2 font. There is no build step and all hero graphics and printed textures are drawn in code.

The scene uses rounded extruded polygons, Physical glass materials, PMREM studio lighting, animated shared cut points, per-shard spring hover, global cursor tilt, a shader glow, and a projectively mapped selectable HTML layer. “Cómo funciona” sends the printed shards away; the return sliver reassembles them. The course links are real controls. Existing lessons, practice, dark/light preferences and assessment remain accessible.

Reduced motion, unavailable WebGL and failed CDN loading use styled HTML. GPU resources, animation and resize listeners are disposed when leaving the homepage. Animation speed depends on the device; software rendering is slower. The learning pages retain the spacious reading layout.

Run npm run test:glass with Playwright Core and Chromium as described for other browser checks. It verifies real WebGL hover/shatter/reassembly/navigation, cleanup, reduced-motion mobile controls and CDN failure. Existing browser and placement checks use the static reduced-motion portal for predictable navigation.
