# BIB Line Questionnaire · 袋中袋产线需求问卷

> A customer questionnaire for Bag-in-Bag (BIB) secondary packaging lines — friendly for customers, structured for AI, aligned with the BIB URD.
> 客户填得轻松，AI 读得精准，字段与 BIB URD 一一对应的袋中袋产线需求问卷。

**Live / 在线问卷**: https://yangcong2828.github.io/BIB-Secondary-Packaging-Machine-Solution--questionnaire/ (GitHub Pages, deployed from `main`)
**Inbox / 后台**: same URL + `#admin`
**Sister tool / 姊妹工具**: [BIB Solution Calculator](https://github.com/yangcong2828/bib-calculator)

---

## What it does / 功能

Four steps, about five minutes. The steps follow the BIB URD / TCP master — Material → Primary bag → Master bag → Process → Scope of supply — so an inquiry becomes a URD without re-typing.

四步、约 5 分钟。步骤顺序沿用 BIB URD / TCP 母版（物料特性 → 小袋 → 大袋 → 生产工艺 → 供货范围），提交即可直接生成 URD，无需二次整理。

| Step | URD section | Asks | Required |
|---|---|---|---|
| 01 Material | 一、物料特性 | material, PSD, bulk density, water content, flowability, other characteristics | material |
| 02 Bags | 二、小袋 · 三、大袋 | line type; per pouch size: weight, filled size L × W × H, film / thickness, sealing, pouches per master bag, master bag L × W × H (gusset), material, per layer; stacking | line, weight, pouches per master bag, **filled pouch size** (rule 0) |
| 03 Process & supply | 四、生产工艺 · 五、供货范围 | pain points, primary / secondary speed, metering / counting accuracy, machine material, scope of supply (8 items), power, air, site conditions, space | scope |
| 04 Contact | — | name, company, country, email / WhatsApp, timeline + review | name, company, country, one channel |

- **Rule 0 / 规则零** — the filled pouch size is required. The only way past it is the customer ticking *"No sample yet — please prepare a reference proposal on estimates, I will measure to confirm"* (exception 4); the inquiry is then marked `estimate_requested`.
- **Three languages / 三语** — EN · RU · 中文, auto-detected, or forced with `?lang=ru`. Data is always stored in English codes.
- **Live engineering preview / 实时工程预览** — master bag weight, empty bag size and machine match, using the calculator's formulas.
- **Never loses work / 不丢草稿** — autosaves on the device; reopening the link resumes where the customer stopped.
- **Source tracking / 来源追踪** — add `?src=dhaka-expo` to a link; it is saved with the inquiry.
- **Delivery / 回传** — posts to your Google Sheet and emails you the brief; the page says "Received" only after the backend confirms it. Without a backend, the customer sends it via WhatsApp / email, or as a PDF if neither is configured.

---

## Design principle / 设计原则

**One data contract, three readers. 一份数据契约，三种读者。**

| Reader | Gets | Why |
|---|---|---|
| Customer | localized form, chips instead of typing, units fixed per field, reference values, "Not sure" where it is honest | lower effort → more submissions |
| AI (Claude) | fixed-schema JSON + Markdown brief in URD order, English enum codes, numbers with the unit in the key, `derived` and `unknowns` blocks | maps straight onto the `urd-bib` skill; the follow-up list is already computed |
| Leo | Google Sheet row + email brief + `#admin` inbox with **Copy for Claude** | from inquiry to URD draft in one paste |

Ask customers what they **know** (pouch size, count, film) — compute what they **don't** (master bag size, machine, throughput). Customer-provided master bag sizes always take precedence over computed ones.
问客户知道的（小袋尺寸、数量、膜材），算客户不知道的（大袋尺寸、机型、产能）；客户给了大袋尺寸，一律以客户为准。

### Type / 字体

Chinese **SimSun（宋体）**, English and other languages **Arial** — the same rule as the URD documents, applied to the page and the PDF export.
SimSun ships only with Windows; elsewhere the page falls back to Noto Serif SC (Google Fonts, an open Song face, downloaded only when Chinese glyphs are shown), then the system Song font.

---

## Setup / 部署（约 10 分钟）

### 1 · Fill in the config / 填写配置

At the top of the second `<script>` in `index.html`:

```js
const CONFIG = {
  endpoint: '',   // Apps Script web-app URL (step 2)
  whatsapp: '',   // digits only, with country code, e.g. '8613800000000'
  email: '',      // your inbox for the email fallback
};
```

### 2 · Google Sheet backend / Google 表格回传

1. Create a Google Sheet → **Extensions → Apps Script** → paste the code below → Save.
2. **Project Settings → Script properties** → add `ADMIN_TOKEN` = a long random string (this is the `#admin` password).
3. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone** → Deploy → authorise.
4. Copy the `/exec` URL into `CONFIG.endpoint`, commit, push.

Each submission appends one row to the `Submissions` sheet and emails the Markdown brief to the script owner (you). The `json` column holds the full record. A repeated inquiry ID is ignored, so retries never create duplicate rows.

```js
// Apps Script — bound to your Google Sheet
const SHEET_NAME = 'Submissions';
const SCHEMA = 'bib-questionnaire/v3';
const HEADERS = ['received_at', 'id', 'company', 'contact', 'country', 'email', 'whatsapp', 'material', 'line',
  'pouch_size_status', 'skus', 'stacking', 'counting_accuracy', 'scope', 'timeline', 'pending', 'form_language', 'source',
  'brief_md', 'json'];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.website) return out_({ ok: true });                      // honeypot: bots fill hidden fields
  const s = body.submission;
  if (!s || s.schema !== SCHEMA || !s.id) return out_({ ok: false, error: 'bad payload' });
  const c = s.contact || {}, k = s.packaging || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    if (sh.getLastRow() > 1 && sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(s.id).matchEntireCell(true).findNext()) {
      return out_({ ok: true, id: s.id, duplicate: true });     // a retry of an inquiry we already stored
    }
    sh.appendRow([new Date(), s.id, c.company, c.name, c.country, c.email || '', c.whatsapp || '',
      s.material.category, k.line, k.pouch_size_status,
      k.skus.map(p => `${p.weight_g} g × ${p.pouches_per_master}`).join('; '), k.stacking || '',
      s.process.counting_accuracy || '', (s.scope || []).join(', '), s.project.timeline || '',
      (s.unknowns || []).length, s.form_language, s.source || '', body.brief_md || '', JSON.stringify(s)].map(asText_));
  } finally {
    lock.releaseLock();
  }
  const mail = { to: Session.getEffectiveUser().getEmail(), subject: `[BIB] ${c.company} · ${c.country} · ${s.id}`, body: body.brief_md || s.id };
  if (c.email) mail.replyTo = c.email;
  MailApp.sendEmail(mail);
  return out_({ ok: true, id: s.id });
}

// Read access for index.html#admin — requires the ADMIN_TOKEN script property.
function doGet(e) {
  const token = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!token || (e.parameter.token || '') !== token) return out_({ ok: false, error: 'unauthorized' });
  const rows = sheet_().getDataRange().getValues().slice(1);
  const col = HEADERS.indexOf('json');
  const submissions = rows.map(r => { try { return JSON.parse(r[col]); } catch (_) { return null; } }).filter(Boolean);
  return out_({ ok: true, submissions });
}

// Sheets treats text starting with = + - @ as a formula ("+880 1711…" would break, "=IMPORTXML(…)" would run).
function asText_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

> After editing the script, use **Deploy → Manage deployments → Edit → New version**, otherwise the old code keeps running.

### 3 · Inbox / 后台

Open `…/#admin`, paste the `/exec` URL and your `ADMIN_TOKEN` once (stored only in your browser), **Load sheet**.
Each inquiry has **Copy for Claude** (prompt + brief + JSON), **Brief**, **JSON**; the toolbar exports everything as JSON or CSV.

---

## AI workflow / AI 工作流

**Copy for Claude** puts this on your clipboard — paste it into Claude:

1. A fixed instruction: use the **`urd-bib`** skill to turn the inquiry into the standard BIB URD (rule 0 is pre-checked: `measured` or the customer's explicit `estimate_requested`); otherwise propose a configuration from the derived figures, flagging anything that rests on missing input; then draft a WhatsApp follow-up **in the customer's form language** from "Pending from client".
2. The Markdown brief, in URD section order.
3. The full JSON.

Structured form input means the URD's "extraction assumptions" section stays empty.

---

## Data contract / 数据契约 · `bib-questionnaire/v3`

Rules: keys are `snake_case` with the unit in the name (`weight_g`, `bulk_density_g_cm3`). Enum values are fixed English codes whatever the form language. `null` = left blank; `"not_sure"` = customer explicitly unsure. Free text is kept verbatim in the customer's language.

| Path | URD | Type | Values |
|---|---|---|---|
| `schema` · `id` · `submitted_at` | | string | `bib-questionnaire/v3` · `BIB-YYMMDD-XXXX` · ISO 8601 |
| `form_language` · `source` | | string | `en` `ru` `zh` · from `?src=` |
| `contact.{name,company,country,role,email,whatsapp}` | file name only | string \| null | |
| `material.category` | 一 | enum | `salt` `sugar` `rice` `seeds` `detergent` `flour` `other` |
| `material.name` · `material.particle_size` | 一 | string \| null | particle size as typed, e.g. `0.3–0.8` (mm) |
| `material.bulk_density_g_cm3` · `material.moisture_pct` | 一 | number \| null | |
| `material.flowability` | 一 | enum \| null | `good` `fair` `poor` `not_sure` |
| `material.traits` | 一 | enum[] | `corrosive` `toxic` `abrasive` `static` `leaky` `hygroscopic` `dusty` |
| `packaging.line` | 线别 | enum | `roll_film` `woven_bag` `not_sure` |
| `packaging.pouch_size_status` | 规则零 | enum | `measured` · `estimate_requested` (exception 4, customer's explicit request) |
| `packaging.skus[]` (1–4) | 二 · 三 | object | `weight_g`, `length_mm`, `width_mm`, `height_mm` (filled pouch), `film`, `sealing` (`heat_seal` `stitching`), `pouches_per_master`, `per_layer`, `master_length_mm`, `master_width_mm`, `master_gusset_mm` (H, 0 = none), `master_material` |
| `packaging.stacking` | 三 · 四 | enum \| null | `top_to_top` `side_to_side` `not_sure` |
| `process.pain_points` | 客户原话 | string \| null | customer's own words |
| `process.primary_speed_ppm` · `process.secondary_speed_bpm` | 四 | number \| null | pouches/min · master bags/min |
| `process.metering_accuracy` · `process.counting_accuracy` | 四 | string \| null | e.g. `±2% @2σ` · `99.9%` |
| `process.machine_material` | 四 | enum \| null | `ss304_contact` `ss304_full` `ss316_contact` (SS316L) `not_sure` |
| `process.current_method` | | enum \| null | `manual` `semi_auto` `automatic` `new_project` |
| `scope` | 五 | enum[] (≥ 1) | `feeding_elevator` `metering_scale` `primary_packer` `secondary_packer` `checkweigher` `metal_detector` `palletizer` `other` |
| `site.voltage_v` · `site.frequency_hz` · `site.phase` | 七 R6 | number \| null | · `50` `60` · `3` `1` |
| `site.compressed_air` | | enum \| null | `yes` `no` `not_sure` |
| `site.conditions` | 七 R6 | enum[] | `hot` (> 40 °C) `humid_coastal` `power_cuts` `multi_floor` |
| `site.space` | | string \| null | |
| `project.timeline` | | enum \| null | `within_3m` `3_6m` `6_12m` `exploring` |
| `derived` | 我方推荐值 | object | preliminary engineering, see below |
| `unknowns[]` | Pending | `{ field, label }` | inputs still to confirm with the customer |

### Derived figures / 派生工程数据 — 【我方推荐值，待技术部凭客户实测小袋尺寸做工程设计确认】

The [bib-calculator](https://github.com/yangcong2828/bib-calculator) formulas are authoritative; a key is present only when every input it needs is present.

```
Master bag weight  = weight_g × pouches_per_master / 1000                      (kg)
Stack (per size)   = A₁ × B × H     A = n × L (top-to-top) or n × W (side-to-side)
                                    A₁ = A − (n−1) × o    o = min(18, 0.4 L)  or  0.1 W
                                    B = W or L,  H = ⌈count ÷ n⌉ × pouch H
Empty bag          = A₁ × B × (1.1 H + B + 100)   roll-film line   ·   (… + 50)   woven-bag line
Machine            = ZR-VBIB-120 (roll-film, 120 pouches/min) · ZR-WBIB-90 (woven, 90 pouches/min, ≤ 6 bags/min)
Machines needed    = ⌈primary speed ÷ machine pouches/min⌉
```

> The `urd-bib` skill (2026-08) still describes the older rules — empty bag `A' = A − 50 mm` and roll-film master bags ≤ 8 bags/min. The calculator supersedes them; update the skill to match.

---

## Files / 文件

```
index.html   the whole tool — form, data contract, three languages, #admin inbox
README.md    this file — setup, Apps Script backend, data contract
```

---

## Designed by / 设计者

**景 (Leo)** · [@yangcong2828](https://github.com/yangcong2828)

Personal project. 个人项目。

---

## License

MIT — free to use, modify, and distribute.
