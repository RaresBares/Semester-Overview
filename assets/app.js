function pad2(n) {
  return String(n).padStart(2, "0")
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseYmd(s) {
  const m = String(s || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const da = Number(m[3])
  const d = new Date(y, mo, da, 12, 0, 0, 0)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function addDays(d, n) {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return x
}

function addMonthsKeepDay(d, n) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  const target = new Date(y, m + n, 1, 12, 0, 0, 0)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12, 0, 0, 0).getDate()
  target.setDate(Math.min(day, lastDay))
  return target
}

function freqStepDays(freq) {
  if (freq === "weekly") return 7
  if (freq === "biweekly") return 14
  return null
}

function safeText(s) {
  return String(s == null ? "" : s)
}

async function loadYaml(url) {
  const r = await fetch(url, { cache: "no-store" })
  if (!r.ok) throw new Error(`Fetch failed: ${url}`)
  const t = await r.text()
  return window.jsyaml.load(t)
}

function normalizeCoursesIndex(raw) {
  const list = Array.isArray(raw?.courses) ? raw.courses : []
  return list
    .map((c) => ({
      id: safeText(c?.id),
      title: safeText(c?.title),
      short: safeText(c?.short || c?.title),
      page: safeText(c?.page || `/course.html?course=${safeText(c?.id)}`),
    }))
    .filter((c) => c.id && c.title && c.id !== "admin")
}

function normalizeTasks(raw) {
  const list = Array.isArray(raw?.tasks) ? raw.tasks : []
  return list
    .map((t) => ({
      course: safeText(t?.course || ""),
      name: safeText(t?.name || ""),
      description: safeText(t?.description || ""),
      start: safeText(t?.start || ""),
      frequency: safeText(t?.frequency || "unique"),
      until: safeText(t?.until || ""),
    }))
    .filter((t) => t.course && t.name && t.start)
}

function buildOccurrences(tasks, coursesById, windowDays) {
  const now = new Date()
  const startWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endWindow = addDays(startWindow, windowDays + 1)

  const occ = []

  for (const t of tasks) {
    const d0 = parseYmd(t.start)
    if (!d0) continue

    const until = t.until ? parseYmd(t.until) : null
    const hardEnd = until && until < endWindow ? until : endWindow

    const step = freqStepDays(t.frequency)

    if (t.frequency === "unique") {
      if (d0 >= startWindow && d0 < endWindow) occ.push({ task: t, date: d0 })
      continue
    }

    if (step != null) {
      let d = d0
      while (d < startWindow) d = addDays(d, step)
      while (d <= hardEnd) {
        if (d >= startWindow && d < endWindow) occ.push({ task: t, date: d })
        d = addDays(d, step)
      }
      continue
    }

    if (t.frequency === "monthly") {
      let d = d0
      while (d < startWindow) d = addMonthsKeepDay(d, 1)
      while (d <= hardEnd) {
        if (d >= startWindow && d < endWindow) occ.push({ task: t, date: d })
        d = addMonthsKeepDay(d, 1)
      }
    }
  }

  occ.sort((a, b) => a.date.getTime() - b.date.getTime())

  return occ.map((o) => ({
    ...o,
    courseTitle: coursesById[o.task.course]?.short || coursesById[o.task.course]?.title || o.task.course,
  }))
}

function groupByDay(occ) {
  const map = new Map()
  for (const o of occ) {
    const k = ymd(o.date)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(o)
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}

function dayLabel(ymdStr) {
  const d = parseYmd(ymdStr)
  if (!d) return ymdStr
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()]
  return `${wd} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

function renderCoursesGrid(courses) {
  const root = document.getElementById("courseGrid")
  root.innerHTML = ""

  const grid = document.createElement("div")
  grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"

  for (const c of courses) {
    const a = document.createElement("a")
    a.href = c.page
    a.className = "block rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50 no-underline"
    a.innerHTML = `
      <div class="text-sm font-semibold text-neutral-900">${safeText(c.short)}</div>
      <div class="mt-1 text-xs text-neutral-500">${safeText(c.title)}</div>
    `
    grid.appendChild(a)
  }

  root.appendChild(grid)
}

function renderTimeline(groups) {
  const root = document.getElementById("timeline")
  root.innerHTML = ""

  if (!groups.length) {
    root.innerHTML = `<div class="text-sm text-neutral-500">Keine Tasks im Zeitraum.</div>`
    return
  }

  const wrap = document.createElement("div")
  wrap.className = "space-y-3"

  for (const [day, items] of groups) {
    const dayBox = document.createElement("div")
    dayBox.className = "rounded-2xl border border-neutral-200 bg-white p-4"

    const header = document.createElement("div")
    header.className = "flex items-center justify-between"
    header.innerHTML = `
      <div class="text-sm font-semibold text-neutral-900">${dayLabel(day)}</div>
      <div class="text-xs text-neutral-500">${items.length}</div>
    `
    dayBox.appendChild(header)

    const list = document.createElement("div")
    list.className = "mt-3 space-y-2"

    for (const o of items) {
      const row = document.createElement("div")
      row.className = "rounded-xl border border-neutral-200 bg-white px-3 py-3"
      row.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs text-neutral-500">${safeText(o.courseTitle)}</div>
            <div class="mt-1 text-sm font-semibold text-neutral-900">${safeText(o.task.name)}</div>
            <div class="mt-1 text-xs text-neutral-600">${safeText(o.task.description)}</div>
          </div>
          <a class="text-xs text-blue-700 hover:underline" href="/course.html?course=${encodeURIComponent(o.task.course)}">Kurs</a>
        </div>
      `
      list.appendChild(row)
    }

    dayBox.appendChild(list)
    wrap.appendChild(dayBox)
  }

  root.appendChild(wrap)
}

;(async () => {
  const courseIndex = await loadYaml("/courses/index.yml")
  const courses = normalizeCoursesIndex(courseIndex)
  const coursesById = {}
  for (const c of courses) coursesById[c.id] = c

  const tasksRaw = await loadYaml("/tasks.yml")
  const tasks = normalizeTasks(tasksRaw)

  renderCoursesGrid(courses)

  const occ = buildOccurrences(tasks, coursesById, 90)
  const groups = groupByDay(occ)
  renderTimeline(groups)
})().catch((e) => {
  const root = document.getElementById("timeline")
  if (root) root.innerHTML = `<div class="text-sm text-red-700">${safeText(e && e.message ? e.message : e)}</div>`
})