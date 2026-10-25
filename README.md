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
