# Placement: browser testing mode

The placement test runs completely in the browser using public/placement/engine.js and bank.js. GitHub Pages requires no API or configuration. Anonymous sessions, responses, histories and chosen levels are stored in localStorage, separately for English and French. Data is specific to the browser and can be lost if browser storage is cleared. The Node API remains available for existing integrations, but the website no longer calls it.

The browser must receive the question bank and answer keys to score locally. They are visible to users and cannot be kept secret. This is a prototype for practice, not a secure exam or a validated CEFR certification.

The starter bank has 42 questions per language, A1–C2, covering grammar, vocabulary and reading. Listening, writing and speaking are explicitly excluded. The estimated level uses a per-skill discrete posterior and difficulty, not raw accuracy. Selection prioritizes under-assessed skills, avoids session duplicates and adjusts its difficulty anchor only after batches of three. It begins at A2/B1 or an optional expected level, never treats that starting point as a final result, stops after at least 18 questions only when its heuristic stability and uncertainty conditions hold, and has a cap of 40. The reported level and range are heuristic and uncalibrated; performance below A1 is floored at A1.

At the end users can choose any A1–C2 practice level, independently for each language. Three randomized starter items at that level offer feedback. These are a small testing set, not yet a full adaptive exercise curriculum. Users can change their selected level from any saved result; choosing a level never locks other material.

Run npm test for engine/API tests. With Playwright Core and Chromium, run node qa/placement.mjs for full local browser completion, resume, level selection, three practice items, separate histories and mobile/desktop. The shared engine and question bank live in public/placement/; assessment/ re-exports them to avoid divergent scoring.
