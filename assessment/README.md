# Adaptive placement: architecture, deployment and limits

The existing vanilla browser app links to /placement/. The existing Node server owns /api/placement, its question bank and scoring. There were no dependencies, authentication or database. Anonymous sessions now use random UUID capability IDs and an atomically replaced JSON file (.data/placement.json). Knowing an ID grants access to that anonymous session; keep IDs private. Browser storage remembers session IDs and local result history independently for English and French.

## Run and publish

Run npm start with Node 20+. For production, use HOST=0.0.0.0, PORT and a persistent PLACEMENT_DATA_FILE. Back up the data file. Use one Node process with this file store; multiple replicas need a transactional database.

GitHub Pages cannot execute this API. Its assessment screen explicitly requests a backend connection. Deploy the Node app over HTTPS, set PLACEMENT_ORIGIN=https://9sjjbb4d9m-crypto.github.io on that server, then enter the server origin under “Conexión del servidor” in the assessment. Same-origin Node deployments need no configuration. CORS permits only the explicit origin or the server's own origin. Protected answer keys stay outside public/ and the Pages artifact. Never publicly serve assessment/ or .data/.

A Dockerfile is supplied. Build with docker build -t zoalmon . and run with docker run --rm -p 3000:3000 -v zoalmon-data:/app/.data -e PLACEMENT_ORIGIN=https://9sjjbb4d9m-crypto.github.io zoalmon.

## Content

84 editorial starter items: 42 per language, A1–C2, grammar, vocabulary and reading. Choice, completion, error identification, passage questions and typed gaps are supported. Each item has a stable ID, skill, CEFR tag, heuristic difficulty, key and explanation. Options are shuffled server-side. No answer key or difficulty estimate is sent with a question.

This bank is structurally checked by tests, not externally validated. Advanced items sample narrow aspects of C1/C2; text knowledge alone cannot establish a full CEFR level. All results are estimates scoped to three skills. Below-A1 performance is floored at A1 on the requested scale. Listening is excluded: there is no authentic audio bank. Writing is excluded: no reliable rubric-based evaluator is implemented. Speaking is not tested. Speech synthesis is not substituted for authentic listening assessment. There are no paid AI calls or generated answer keys.

## Scoring heuristic

Maintain a discrete ability posterior per skill on a -0.5 to 6.5 grid, spaced by 0.25. Use broad Gaussian priors (SD 1.8), centred on A2/B1 (1.5) or the optional expected-level index. Each answer contributes a likelihood from item difficulty: logistic slope 1.6 with a guessing floor for choice questions. Discrimination is uniformly 1 because no calibrated data exists.

Prioritise the least-assessed skill, select unused questions close to the current anchor, randomise small target offsets and option order, and prefer unseen items from the preceding attempt when difficulty ties. Update the anchor only after three answers. Timing does not affect ability.

Stop only after at least 18 responses (never fewer than 12), at least four per skill, the last three anchor updates within 0.35, and aggregate SD <= 0.43. Hard cap: 40. Aggregate uncertainty combines skill SDs with a conservative floor of 0.4. Labels round to A1–C2; intervals use 1.64 SD. These are heuristic intervals, not validated statistical confidence intervals. Confidence is only moderate or low. Cap-length and wider-uncertainty results are provisional.

No correctness feedback is given during testing. Results include skill estimates, uncertainty, limits, explanations, strengths and priorities. A level-matched reading activity and weakness-specific task follow. Both homepages show the latest result and a route link. Foundational lessons stay accessible; this does not add full B1–C2 guided coursework.

## Persistence and checks

The server validates language, starting level, current question ID, indices, text length and nonempty responses. Stale/double submissions are rejected. Request size is bounded; writes are serialised and persisted before responding. Sessions survive restarts. Browser requests time out visibly without discarding the session ID. Responses contain user input; never commit the data file. There is no authenticated cross-device history or assessment backup UI.

Run npm test. Coverage includes batched adaptation, skill balance, no duplicate questions, stopping limits, simulated beginner/intermediate/advanced ordering, separate languages, private keys, invalid responses, API persistence and excluded services. Existing learning tests remain included.

Browser regression: install playwright-core for development and run PLAYWRIGHT_MODULE or a standard installed Playwright Core with node qa/placement.mjs. CHROMIUM_PATH selects the Chromium executable. It covers desktop/mobile completion, resume, independent history and homepage personalisation.
