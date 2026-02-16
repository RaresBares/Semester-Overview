function qs(name) {
  const u = new URL(window.location.href)
  return u.searchParams.get(name)
}

function el(id) {
  return document.getElementById(id)
}

function safeText(v) {
  return String(v == null ? "" : v)
}

async function loadYaml(url) {
  const r = await fetch(url, { cache: "no-store" })
  if (!r.ok) throw new Error(`Fetch failed: ${url}`)
  const t = await r.text()
  return window.jsyaml.load(t)
}

function setIfNonEmpty(node, text) {
  const s = safeText(text).trim()
  if (!s) {
    node.style.display = "none"
    return
  }
  node.textContent = s
  node.style.display = ""
}

function renderKv(data) {
  const root = el("kv")
  root.innerHTML = ""

  const items = []
  if (data?.lecturers) items.push(["Dozierende", safeText(data.lecturers)])
  if (data?.scope) items.push(["Umfang", safeText(data.scope)])
  if (Array.isArray(data?.assessment) && data.assessment.length) items.push(["Prüfung", data.assessment.map(safeText).join(" · ")])
  if (data?.language) items.push(["Sprache", safeText(data.language)])

  if (items.length === 0) {
    root.innerHTML = `<div class="wiki-label">Info</div><div class="wiki-value">—</div>`
    return
  }

  for (const [k, v] of items) {
    const kDiv = document.createElement("div")
    kDiv.className = "wiki-label"
    kDiv.textContent = k

    const vDiv = document.createElement("div")
    vDiv.className = "wiki-value"
    vDiv.textContent = v

    root.appendChild(kDiv)
    root.appendChild(vDiv)
  }
}

function renderSchedule(schedule) {
  const root = el("schedule")
  root.innerHTML = ""

  const list = Array.isArray(schedule) ? schedule : []
  if (list.length === 0) {
    root.innerHTML = `<div style="color:#6b7280;font-size:14px;">Keine Termine hinterlegt.</div>`
    return
  }

  const wrap = document.createElement("div")
  wrap.className = "d-flex flex-column gap-2"

  for (const s of list) {
    const box = document.createElement("div")
    box.className = "wiki-note p-3"
    box.innerHTML = `
      <div style="font-weight:650;font-size:13px;color:#111827;">${safeText(s?.type || "")}</div>
      <div style="margin-top:4px;font-size:13px;color:#111827;">${safeText(s?.day || "")} ${safeText(s?.time || "")}</div>
      <div style="margin-top:2px;font-size:12px;color:#6b7280;">${safeText(s?.room || "")}</div>
    `
    wrap.appendChild(box)
  }

  root.appendChild(wrap)
}

function renderLinks(links) {
  const root = el("links")
  root.innerHTML = ""

  const list = Array.isArray(links) ? links : []
  if (list.length === 0) {
    root.innerHTML = `<div style="color:#6b7280;font-size:14px;">Keine Links hinterlegt.</div>`
    return
  }

  const wrap = document.createElement("div")
  wrap.className = "d-flex flex-column gap-2"

  for (const l of list) {
    const a = document.createElement("a")
    a.className = "wiki-note p-3"
    a.href = safeText(l?.url || "#")
    a.target = "_blank"
    a.rel = "noreferrer"
    a.style.textDecoration = "none"

    const label = safeText(l?.label || l?.url || "")
    const url = safeText(l?.url || "")

    a.innerHTML = `
      <div style="font-weight:650;font-size:13px;color:#1d4ed8;">${label}</div>
      <div style="margin-top:2px;font-size:12px;color:#6b7280;">${url}</div>
    `
    wrap.appendChild(a)
  }

  root.appendChild(wrap)
}

function renderNotes(data) {
  const root = el("notes")
  root.innerHTML = ""

  const defaults = [
    "Wöchentlich: 1× 45 Minuten Wiederholung + 1× Übungsblock.",
    "Offene Fragen sofort als Bullet sammeln und in der nächsten Übung klären.",
    "Vor Abgaben: Checkliste (Format, Units, Randbedingungen, Plausibilität).",
    "Prüfung: alte Serien priorisieren, Fehlerkatalog führen."
  ]

  const list = Array.isArray(data?.notes) && data.notes.length ? data.notes.map(safeText) : defaults

  for (const n of list) {
    const li = document.createElement("li")
    li.textContent = n
    root.appendChild(li)
  }
}

;(async () => {
  const courseId = qs("course") || "emfw"
  const ymlUrl = `courses/${encodeURIComponent(courseId)}.yml`
  el("openYaml").href = ymlUrl

  const data = await loadYaml(ymlUrl)

  const title = safeText(data?.title || courseId)
  document.title = title
  el("title").textContent = title

  const subtitleParts = []
  if (data?.lecturers) subtitleParts.push(safeText(data.lecturers))
  if (data?.scope) subtitleParts.push(safeText(data.scope))
  el("subtitle").textContent = subtitleParts.join(" · ")

  setIfNonEmpty(el("codePill"), data?.code || "")
  setIfNonEmpty(el("ectsPill"), data?.ects || "")

  el("desc").textContent = safeText(data?.description || "—")

  renderKv(data)
  renderNotes(data)
  renderSchedule(data?.schedule)
  renderLinks(data?.links)
})().catch((e) => {
  document.body.innerHTML =
    `<div style="max-width:920px;margin:0 auto;padding:40px 16px;font-size:14px;color:#991b1b;">${safeText(e && e.message ? e.message : e)}</div>`
})