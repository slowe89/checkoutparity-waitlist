const GATES = [
  {
    id: 1,
    label: 'Feed refresh SLA \u2264 15 minutes (documented)',
    hint: 'Inventory/price push to the agent-facing feed has a documented refresh cadence \u226415 min (or stricter).',
  },
  {
    id: 2,
    label: '`native_commerce` (or equivalent agentic-commerce eligibility) is set and verified',
    hint: 'Eligibility attributes required by your UCP/ACP / Merchant Center path are present and not failing silent checks.',
  },
  {
    id: 3,
    label: 'Price agrees: feed = schema.org/Offer = PDP = checkout session',
    hint: 'Same SKU, same currency, same unit price across all four surfaces at probe time.',
  },
  {
    id: 4,
    label: 'Availability agrees: feed stock state = checkout purchasability',
    hint: 'In-stock / out-of-stock / backorder meaning matches; agents cannot start checkout on feed-\u201cin-stock\u201d that checkout rejects.',
  },
  {
    id: 5,
    label: 'Stable ID map: `merchant_item_id` / SKU / GTIN consistent across feed, PDP, checkout',
    hint: 'One product identity resolves the same item on every surface (no silent SKU remap).',
  },
  {
    id: 6,
    label: 'Structured data on PDP matches live PDP truth (not stale cache)',
    hint: 'Product/Offer markup is generated from the same source of truth as the visible PDP, not a weekly export.',
  },
  {
    id: 7,
    label: 'Checkout session APIs support create / update / complete / cancel',
    hint: 'Agent-callable session lifecycle exists (or platform equivalent); not human-only form POST.',
  },
  {
    id: 8,
    label: 'Checkout idempotency tested under retries',
    hint: 'Duplicate create/complete with same idempotency key does not double-charge or double-allocate inventory.',
  },
  {
    id: 9,
    label: 'Parallel agent-shaped checkout load tested',
    hint: 'Concurrent sessions (multi-agent / multi-tab pattern) do not corrupt inventory, price, or session state vs single-buyer happy path.',
  },
  {
    id: 10,
    label: 'Returns / refund / policy attributes required for agentic eligibility are present',
    hint: 'Return window, refund method, and related UCP/ACP policy fields exist and match storefront policy pages.',
  },
]

const answers = Object.fromEntries(GATES.map((g) => [g.id, null]))

function bandFor(score) {
  if (score <= 39) {
    return {
      className: 'critical',
      label: '0\u201339 Critical blind spots',
      copy: 'Agents will abort or oversell. Priority: items 3\u20135 and 8\u20139 before flipping agentic checkout live.',
    }
  }
  if (score <= 69) {
    return {
      className: 'partial',
      label: '40\u201369 Partial parity',
      copy: 'Eligible on paper, fragile under traffic. Ship pack usually starts at price/availability + idempotency.',
    }
  }
  if (score <= 89) {
    return {
      className: 'shiprisk',
      label: '70\u201389 Ship-risk remains',
      copy: 'Close \u2014 retest under parallel load and ID map before marketing \u2018agent-ready.\u2019',
    }
  }
  return {
    className: 'strong',
    label: '90\u2013100 Strong (still retest under load)',
    copy: 'Self-score is high; still get an independent probe before trust-score week.',
  }
}

function computeScore() {
  const values = Object.values(answers)
  if (values.some((v) => v === null)) return null
  return values.reduce((sum, v) => sum + (v ? 10 : 0), 0)
}

function vectorString() {
  return GATES.map((g) => {
    const a = answers[g.id]
    return `${g.id}:${a === true ? 'Y' : a === false ? 'N' : '?'}`
  }).join(',')
}

function escapeWithCode(str) {
  return str
    .split('`')
    .map((part, i) => {
      const safe = part
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
      return i % 2 === 1 ? `<code>${safe}</code>` : safe
    })
    .join('')
}

function renderScore() {
  const score = computeScore()
  const numEl = document.getElementById('score-num')
  const bandEl = document.getElementById('score-band')
  const copyEl = document.getElementById('score-copy')
  const totalField = document.getElementById('field-score-total')
  const vectorField = document.getElementById('field-score-vector')
  const sourceField = document.getElementById('field-source')

  vectorField.value = vectorString()

  if (score === null) {
    const answered = Object.values(answers).filter((v) => v !== null).length
    numEl.textContent = '\u2014'
    bandEl.className = 'score-band'
    bandEl.textContent = `Answer the gates to see your band (${answered}/10)`
    copyEl.textContent = 'Each Yes is 10 points. Incomplete answers stay unscored.'
    totalField.value = ''
    sourceField.value = 'checkoutparity-waitlist'
    return
  }

  const band = bandFor(score)
  numEl.textContent = String(score)
  bandEl.className = `score-band ${band.className}`
  bandEl.textContent = band.label
  copyEl.textContent = band.copy
  totalField.value = String(score)
  sourceField.value = 'checkoutparity-scorecard'
}

function setAnswer(id, value, yesBtn, noBtn) {
  answers[id] = value
  yesBtn.classList.toggle('active-yes', value === true)
  noBtn.classList.toggle('active-no', value === false)
  renderScore()
}

function renderGates() {
  const root = document.getElementById('gates')
  root.innerHTML = ''
  for (const gate of GATES) {
    const row = document.createElement('div')
    row.className = 'gate'
    row.dataset.gate = String(gate.id)

    const q = document.createElement('div')
    q.className = 'gate-q'
    q.innerHTML = `<span class="num">${gate.id}.</span>${escapeWithCode(gate.label)}<span class="gate-hint">${escapeWithCode(gate.hint)}</span>`

    const toggle = document.createElement('div')
    toggle.className = 'toggle'
    toggle.setAttribute('role', 'group')
    toggle.setAttribute('aria-label', `Gate ${gate.id}`)

    const yesBtn = document.createElement('button')
    yesBtn.type = 'button'
    yesBtn.textContent = 'Yes'

    const noBtn = document.createElement('button')
    noBtn.type = 'button'
    noBtn.textContent = 'No'

    yesBtn.addEventListener('click', () => setAnswer(gate.id, true, yesBtn, noBtn))
    noBtn.addEventListener('click', () => setAnswer(gate.id, false, yesBtn, noBtn))

    toggle.append(yesBtn, noBtn)
    row.append(q, toggle)
    root.append(row)
  }
}

function configureFormEndpoint(form) {
  const fromEnv = import.meta.env.VITE_FORM_ENDPOINT
  if (fromEnv && String(fromEnv).trim()) {
    form.action = String(fromEnv).trim()
  }
}

function wireForm() {
  const form = document.getElementById('priestley-form')
  configureFormEndpoint(form)

  form.addEventListener('submit', (e) => {
    const q2 = [...form.querySelectorAll('input[name="q2_surfaces"]:checked')]
    if (q2.length === 0) {
      e.preventDefault()
      alert('Please select at least one option for question 2 (surfaces).')
      return
    }

    const existing = form.querySelector('input[name="q2_surfaces_joined"]')
    if (existing) existing.remove()
    const hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.name = 'q2_surfaces_joined'
    hidden.value = q2.map((el) => el.value).join(' | ')
    form.appendChild(hidden)

    document.getElementById('field-submitted-at').value = new Date().toISOString()
    document.getElementById('field-score-vector').value = vectorString()
    const score = computeScore()
    document.getElementById('field-score-total').value = score === null ? '' : String(score)
  })
}

document.getElementById('year').textContent = String(new Date().getFullYear())
renderGates()
renderScore()
wireForm()
