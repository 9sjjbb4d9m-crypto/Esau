"use strict";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const names = {url:"URL inspector", hash:"Hash playground", encryption:"Encryption studio", traffic:"Traffic simulator", guide:"Lab guide"};
const descriptions = {
  url:["01 / OBSERVE & UNDERSTAND", "Understand what a link says before you go anywhere."],
  hash:["02 / COMPARE & DISCOVER", "Explore the fingerprints that make data changes visible."],
  encryption:["03 / PROTECT & VERIFY", "Turn a message into ciphertext. Then test the seal."],
  traffic:["04 / GENERATE & EXPLORE", "Find the rhythm in network activity, without touching a network."],
  guide:["A LITTLE CONTEXT GOES A LONG WAY", "Small experiments to turn curiosity into understanding."]
};
const samples = {
  simple:"https://docs.example.test/learn?topic=security",
  redirect:"http://trusted.example.test@signin.example.test/login?next=https%3A%2F%2Fother.example.test",
  encoded:"https://files.example.test/%61%63%63%6f%75%6e%74?view=profile"
};
let activePage = "url", trafficData = null, tablePage = 0, tableProtocol = "all", toastTimer;
const inFlight = new Set();
let generation = 0;

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 3500);
}

async function api(path, body) {
  const response = await fetch(`/api/${path}`, {
    method:"POST", headers:{"Content-Type":"application/json", "X-Lab-Request":"1"},
    body:JSON.stringify(body), credentials:"omit", cache:"no-store", redirect:"error"
  });
  let data;
  try { data = await response.json(); } catch { throw new Error("The local server returned an unexpected response."); }
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Check your input and try again.");
  return data;
}

async function run(form, task) {
  if (inFlight.has(form)) return;
  const buttons = [...form.querySelectorAll("button")];
  inFlight.add(form);
  const operationGeneration = generation;
  buttons.forEach(b => { b.disabled = true; });
  form.setAttribute("aria-busy", "true");
  $("#reset-button").disabled = true;
  $("#global-error").hidden = true;
  try { await task(); } catch (error) {
    if (operationGeneration === generation) {
      $("#global-error").textContent = error instanceof TypeError ? "Cannot reach the local Python server. Start it with python -m lab, then try again." : error.message;
      $("#global-error").hidden = false;
    }
  } finally {
    buttons.forEach(b => { b.disabled = false; });
    form.removeAttribute("aria-busy");
    inFlight.delete(form);
    $("#reset-button").disabled = inFlight.size > 0;
  }
}

function navigate() {
  const next = location.hash.slice(1);
  activePage = Object.hasOwn(names, next) ? next : "url";
  $$(".page").forEach(page => { page.hidden = page.id !== `page-${activePage}`; });
  $$("[data-page]").forEach(link => {
    const selected = link.dataset.page === activePage;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  $("#page-title").textContent = names[activePage];
  $("#breadcrumb-current").textContent = names[activePage];
  $("#page-eyebrow").textContent = descriptions[activePage][0];
  $("#page-description").textContent = descriptions[activePage][1];
  document.title = `${names[activePage]} — Loopback`;
  $("#global-error").hidden = true;
  window.scrollTo({top:0, behavior:"instant"});
  if (activePage === "traffic" && !trafficData) generateTraffic();
}
window.addEventListener("hashchange", navigate);

function renderURL(data) {
  const e = escapeHTML;
  $("#url-results").innerHTML = `<article class="panel result-panel">
    <div class="result-summary"><div class="result-icon">${icon(data.review_count ? "info" : "check")}</div><div><h2>${e(data.verdict)}</h2><p>Parsed locally · No connection made</p></div><span class="badge ${data.review_count ? "amber" : "green"}">${data.review_count} review ${data.review_count === 1 ? "clue" : "clues"}</span></div>
    <div class="result-content"><h3 class="section-label">THE ANATOMY OF YOUR URL</h3><div class="anatomy">
      <div class="anatomy-part"><span>SCHEME</span><code>${e(data.scheme)}://</code></div>
      <div class="anatomy-part"><span>HOSTNAME</span><code>${e(data.hostname)}</code></div>
      <div class="anatomy-part"><span>PATH</span><code>${e(data.path)}</code></div></div>
      <dl class="detail-list"><dt>ASCII hostname</dt><dd>${e(data.ascii_hostname)}</dd><dt>Port</dt><dd>${data.port}</dd><dt>Decoded path</dt><dd>${e(data.decoded_path)}</dd><dt>Query fields</dt><dd class="query-list">${data.query.length ? data.query.map(q => `<span class="query-item">${e(q.name)} = ${e(q.value)}</span>`).join("") : "None"}</dd><dt>Fragment</dt><dd>${e(data.fragment || "None")}</dd><dt>Credentials</dt><dd>${data.has_credentials ? "Present before @ — not part of the hostname" : "None"}</dd></dl>
      <h3 class="section-label">WHAT TO NOTICE</h3>${data.findings.map(f => `<div class="finding ${f.level}">${icon(f.level === "info" ? "check" : "info")}<div><h3>${e(f.title)}</h3><p>${e(f.description)}</p></div></div>`).join("")}
    </div><div class="result-disclaimer">${icon("info")}<span>${e(data.notice)}</span></div></article>`;
}

function inspectURL() {
  const form = $("#url-form");
  return run(form, async () => {
    // Hide stale results so an invalid new URL cannot inherit a previous verdict.
    $("#url-results").replaceChildren();
    renderURL(await api("url", {url:$("#url-input").value}));
  });
}
$("#url-form").addEventListener("submit", event => { event.preventDefault(); inspectURL(); });
$$("[data-sample]").forEach(button => button.addEventListener("click", () => {
  if (inFlight.has($("#url-form"))) return;
  $("#url-input").value = samples[button.dataset.sample]; inspectURL();
}));

$("#hash-form").addEventListener("submit", event => {
  event.preventDefault();
  run(event.currentTarget, async () => {
    $("#hash-results").replaceChildren();
    const data = await api("hash", {text:$("#hash-text").value, comparison:$("#hash-comparison").value, algorithm:$("#hash-algorithm").value});
    const highlighted = [...data.comparison_digest].map((char, index) => char !== data.digest[index] ? `<span class="different">${char}</span>` : char).join("");
    $("#hash-results").innerHTML = `<article class="panel"><div class="hash-stat"><strong>${data.percent_changed}%</strong><p><b>${data.changed_bits} of ${data.total_bits} bits changed</b>${data.identical ? "Identical bytes, identical digest." : "One small edit can change the entire fingerprint."}</p></div><div class="digest-block"><div class="digest-top"><span>ORIGINAL · ${data.input_bytes} UTF-8 bytes</span><button class="button quiet small" data-copy="digest-a">${icon("copy")} Copy</button></div><pre class="digest" id="digest-a">${data.digest}</pre></div><div class="digest-block"><div class="digest-top"><span>COMPARISON · ${data.comparison_bytes} UTF-8 bytes</span><button class="button quiet small" data-copy="digest-b">${icon("copy")} Copy</button></div><pre class="digest" id="digest-b">${highlighted}</pre></div><p class="bit-legend">Highlighted characters differ. The percentage counts differing bits, not hex characters.</p></article>`;
  });
});

$("#encrypt-form").addEventListener("submit", event => {
  event.preventDefault();
  run(event.currentTarget, async () => {
    $("#encryption-results").replaceChildren();
    $("#encryption-key").value = "";
    $("#envelope").value = "";
    $("#tamper-button").disabled = true;
    const data = await api("encrypt", {text:$("#plaintext").value});
    $("#encryption-key").value = data.key;
    $("#envelope").value = data.envelope;
    $("#tamper-button").disabled = false;
    toast("Encrypted with a fresh key and nonce. Try decrypting below.");
  });
});
$("#decrypt-form").addEventListener("submit", event => {
  event.preventDefault();
  run(event.currentTarget, async () => {
    $("#encryption-results").replaceChildren();
    const data = await api("decrypt", {key:$("#encryption-key").value, envelope:$("#envelope").value});
    $("#encryption-results").innerHTML = `<div class="success-box"><h3>${icon("check")} Authentication passed</h3><p class="plaintext-output">${escapeHTML(data.plaintext) || "(Empty message)"}</p></div>`;
  });
});
$("#tamper-button").addEventListener("click", () => {
  const parts = $("#envelope").value.split(".");
  try {
    if (parts.length !== 3) throw new Error();
    const bytes = atob(parts[2].replace(/-/g, "+").replace(/_/g, "/"));
    if (!bytes.length) throw new Error();
    parts[2] = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1)).replace(/\+/g, "-").replace(/\//g, "_");
    $("#envelope").value = parts.join(".");
    $("#encryption-results").replaceChildren();
    toast("One ciphertext bit changed. Try decrypting again.");
  } catch { toast("Encrypt a message first to create a valid envelope."); }
});
$$("#encryption-key, #envelope").forEach(input => input.addEventListener("input", () => $("#encryption-results").replaceChildren()));

function chart(series) {
  const max = Math.max(1, ...series.map(p => p.packets));
  const points = series.map((p, i) => `${42 + i * 11.05},${172 - p.packets / max * 143}`).join(" ");
  return `<svg class="traffic-chart" viewBox="0 0 720 210" role="img" aria-label="Synthetic packet counts over 60 seconds; peak ${max} packets per second. Exact counts are available in the chart data disclosure below.">
    ${[0, .5, 1].map(t => `<line class="gridline" x1="42" x2="694" y1="${172 - t * 143}" y2="${172 - t * 143}"/><text x="26" y="${176 - t * 143}" text-anchor="end">${Math.round(t * max)}</text>`).join("")}
    <polygon class="area" points="42,172 ${points} 694,172"/><polyline class="chartline" points="${points}"/>
    ${[0, 10, 20, 30, 40, 50, 59].map(i => `<text x="${42 + i * 11.05}" y="198" text-anchor="middle">${String(i).padStart(2,"0")}s</text>`).join("")}</svg>`;
}

function renderTraffic() {
  const {summary:s, protocols, series, seed, scenario} = trafficData;
  $("#traffic-results").innerHTML = `<div class="stats-grid">
    <article class="stat-card"><div class="stat-label">Generated packets</div><div class="stat-value">${s.packets.toLocaleString()}</div><div class="stat-context">60 seconds of synthetic activity</div></article>
    <article class="stat-card"><div class="stat-label">Total volume</div><div class="stat-value">${(s.bytes/1024).toFixed(1)} <small>KiB</small></div><div class="stat-context">Generated packet sizes</div></article>
    <article class="stat-card"><div class="stat-label">Peak activity</div><div class="stat-value">${s.peak_pps} <small>pps</small></div><div class="stat-context">Highest one-second packet count</div></article>
    <article class="stat-card"><div class="stat-label">Source hosts</div><div class="stat-value">${s.sources}</div><div class="stat-context">Reserved documentation addresses</div></article></div>
    <div class="chart-grid"><article class="panel chart-panel"><div class="chart-title-row"><h2>Traffic over time</h2><span class="badge green">SYNTHETIC</span></div><p class="chart-subtitle">Packets per second · Seed ${seed} · ${escapeHTML(scenario)} pattern</p>${chart(series)}<details class="chart-data"><summary>View exact chart data</summary><div class="table-scroll"><table><caption>Counts per simulated second</caption><thead><tr><th scope="col">Second</th><th scope="col">Packets</th><th scope="col">Bytes</th></tr></thead><tbody>${series.map(b=>`<tr><td>${b.second}</td><td>${b.packets}</td><td>${b.bytes}</td></tr>`).join("")}</tbody></table></div></details></article>
    <article class="panel protocols-panel"><h2>Protocol mix</h2>${Object.entries(protocols).sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<div class="protocol-row"><div><strong>${name}</strong><span>${Math.round(count/s.packets*100)}%</span></div><progress value="${count}" max="${s.packets}" aria-label="${name}: ${count} of ${s.packets} packets"></progress></div>`).join("")}</article></div>
    <article class="panel traffic-table-panel"><div class="table-heading"><h2>Packet explorer</h2><div class="table-tools"><select id="protocol-filter" aria-label="Filter packets by protocol"><option value="all">All protocols</option>${["HTTPS","DNS","HTTP","ICMP"].map(p=>`<option>${p}</option>`).join("")}</select><button class="button quiet small" id="export-traffic">${icon("download")} Export CSV</button></div></div><div class="table-scroll"><table><caption class="visually-hidden">Synthetic packet events</caption><thead><tr><th scope="col">TIME</th><th scope="col">SOURCE</th><th scope="col">DESTINATION</th><th scope="col">PROTOCOL</th><th scope="col">BYTES</th><th scope="col">PATTERN</th></tr></thead><tbody id="packet-rows"></tbody></table></div><div class="table-footer"><span id="packet-count"></span><div class="pagination"><button class="button quiet small" id="prev-page" aria-label="Previous packet page">←</button><span id="page-count"></span><button class="button quiet small" id="next-page" aria-label="Next packet page">→</button></div></div></article>`;
  $("#protocol-filter").value = tableProtocol;
  $("#protocol-filter").addEventListener("change", event => { tableProtocol = event.target.value; tablePage = 0; renderPacketRows(); });
  $("#prev-page").addEventListener("click", () => { tablePage--; renderPacketRows(); });
  $("#next-page").addEventListener("click", () => { tablePage++; renderPacketRows(); });
  $("#export-traffic").addEventListener("click", exportTraffic);
  renderPacketRows();
}

function filteredPackets() { return trafficData.packets.filter(p => tableProtocol === "all" || p.protocol === tableProtocol); }
function renderPacketRows() {
  const packets = filteredPackets();
  const pages = Math.max(1, Math.ceil(packets.length / 8));
  tablePage = Math.max(0, Math.min(tablePage, pages - 1));
  const slice = packets.slice(tablePage * 8, (tablePage + 1) * 8);
  $("#packet-rows").innerHTML = slice.length ? slice.map(p=>`<tr><td>00:${String(p.second).padStart(2,"0")}.${String(p.millisecond).padStart(3,"0")}</td><td>${p.source}</td><td>${p.destination}</td><td><span class="badge ${p.protocol === "DNS" ? "blue" : p.protocol === "HTTP" ? "amber" : "green"}">${p.protocol}</span></td><td>${p.bytes}</td><td>${p.pattern}</td></tr>`).join("") : '<tr><td colspan="6">No packets for this protocol. Try another filter.</td></tr>';
  $("#packet-count").textContent = packets.length ? `${tablePage * 8 + 1}–${Math.min((tablePage + 1) * 8, packets.length)} of ${packets.length} packets` : "0 packets";
  $("#page-count").textContent = `${tablePage + 1} / ${pages}`;
  $("#prev-page").disabled = tablePage === 0;
  $("#next-page").disabled = tablePage >= pages - 1;
}

function exportTraffic() {
  const rows = [["synthetic","seed","scenario","id","second","millisecond","source","destination","protocol","port","bytes","pattern"], ...filteredPackets().map(p=>[true,trafficData.seed,trafficData.scenario,p.id,p.second,p.millisecond,p.source,p.destination,p.protocol,p.port ?? "",p.bytes,p.pattern])];
  // All exported values originate from the bounded synthetic generator.
  const csv = rows.map(row=>row.map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  const a = document.createElement("a");
  a.href = url; a.download = `loopback-synthetic-${trafficData.seed}-${tableProtocol}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`Exported ${filteredPackets().length} synthetic events.`);
}

function generateTraffic() {
  return run($("#traffic-form"), async () => {
    trafficData = null;
    $("#traffic-results").replaceChildren();
    trafficData = await api("traffic", {seed:Number($("#traffic-seed").value), count:Number($("#traffic-count").value), scenario:$("#traffic-scenario").value});
    tablePage = 0; tableProtocol = "all"; renderTraffic();
  });
}
$("#traffic-form").addEventListener("submit", event => { event.preventDefault(); generateTraffic(); });

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  try { await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent); toast("Digest copied."); }
  catch { toast("Clipboard unavailable. Select and copy the digest manually."); }
});

$("#reset-button").addEventListener("click", () => {
  generation++;
  $$("form").forEach(form => form.reset());
  $("#encryption-key").value = ""; $("#envelope").value = "";
  $("#tamper-button").disabled = true;
  ["url-results","hash-results","encryption-results","traffic-results"].forEach(id => document.getElementById(id).replaceChildren());
  $("#global-error").hidden = true;
  trafficData = null;
  tablePage = 0; tableProtocol = "all";
  toast("Sample settings restored. Previous results and keys cleared.");
  if (activePage === "traffic") generateTraffic();
});

// Avoid restoring demo keys through the browser's back-forward cache.
window.addEventListener("pagehide", () => { $("#encryption-key").value = ""; $("#envelope").value = ""; $("#encryption-results").replaceChildren(); });
navigate();
inspectURL();
fetch("/api/health", {credentials:"omit", cache:"no-store", redirect:"error"})
  .then(response => response.ok ? response.json() : null)
  .then(data => {
    if (data?.mode === "codespaces") {
      $("#runtime-label").textContent = "Codespaces session";
      $("#runtime-description").textContent = "Tools run inside your Codespace. Keep its forwarded port Private.";
    }
  }).catch(() => { /* Interactive requests already explain local server errors. */ });
