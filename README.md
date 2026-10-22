# BIB Line Questionnaire · 袋中袋产线需求问卷

> A customer questionnaire for Bag-in-Bag (BIB) secondary packaging lines — friendly for customers, structured for AI.
> 客户填得轻松，AI 读得精准的袋中袋产线需求问卷。

**Live / 在线问卷**: https://yangcong2828.github.io/BIB-Secondary-Packaging-Machine-Solution--questionnaire/ (GitHub Pages, deployed from `main`)
**Inbox / 后台**: same URL + `#admin`
**Sister tool / 姊妹工具**: [BIB Solution Calculator](https://github.com/yangcong2828/bib-calculator)

---

## What it does / 功能

Four steps, about five minutes. Only what blocks a first proposal is required; everything else may be left blank.

四步、约 5 分钟。只有"没有就无法出初步方案"的字段才必填，其余都可以留空。

| Step | Asks | Required |
|---|---|---|
| 01 Product | category, form, traits, particle size, bulk density, moisture | category |
| 02 Packaging | pouch sizes (weight, L × W × T, pcs per bag, per layer), film, master bag type, arrangement | weight, pcs per bag, bag type |
| 03 Line & site | pain points, scope, target capacity, accuracy, machine material, power, air, space | scope |
| 04 Contact | name, company, country, email / WhatsApp, timeline + review | name, company, country, one channel |

- **Three languages / 三语** — EN · RU · 中文, auto-detected, or forced with `?lang=ru`. Data is always stored in English codes.
- **Live engineering preview / 实时工程预览** — master bag weight, empty bag size and machine match, using the same formulas as the calculator.
- **Never loses work / 不丢草稿** — autosaves on the device; reopening the link resumes where the customer stopped.
- **Source tracking / 来源追踪** — add `?src=dhaka-expo` to a link; it is saved with the inquiry.
- **Delivery / 回传** — posts to your Google Sheet and emails you the brief; the page says "Received" only after the backend confirms it. Without a backend, the customer sends it via WhatsApp / email, or as a PDF if neither is configured.

---

## Design principle / 设计原则

**One data contract, three readers. 一份数据契约，三种读者。**

| Reader | Gets | Why |
|---|---|---|
| Customer | localized form, chips instead of typing, units fixed per field, reference values, "Not sure" everywhere | lower effort → more submissions; blanks are fine |
| AI (Claude) | fixed-schema JSON + Markdown brief, English enum codes, numbers as numbers with unit in the key, `derived` and `unknowns` blocks | no guessing; the follow-up list is already computed |
| Leo | Google Sheet row + email brief + `#admin` inbox with **Copy for Claude** | from inquiry to proposal draft in one paste |

Ask customers what they **know** (pouch size, count, film) — compute what they **don't** (master bag size, machine, throughput).
问客户知道的（小袋尺寸、数量、膜材），算客户不知道的（大袋尺寸、机型、产能）。

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
const HEADERS = ['received_at', 'id', 'company', 'contact', 'country', 'email', 'whatsapp', 'category', 'pouches',
  'master_bag', 'scope', 'capacity', 'timeline', 'to_confirm', 'form_language', 'source', 'brief_md', 'json'];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.website) return out_({ ok: true });                      // honeypot: bots fill hidden fields
  const s = body.submission;
  if (!s || s.schema !== 'bib-questionnaire/v2' || !s.id) return out_({ ok: false, error: 'bad payload' });
  const c = s.contact || {}, cap = s.line && s.line.target_capacity;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    if (sh.getLastRow() > 1 && sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(s.id).matchEntireCell(true).findNext()) {
      return out_({ ok: true, id: s.id, duplicate: true });     // a retry of an inquiry we already stored
    }
    sh.appendRow([new Date(), s.id, c.company, c.name, c.country, c.email || '', c.whatsapp || '',
      s.product.category, s.pouches.map(p => `${p.weight_g} g × ${p.pouches_per_bag}`).join('; '),
      s.packaging.master_bag_material, (s.line.scope || []).join(', '), cap ? `${cap.value} ${cap.unit}` : '',
      s.project.timeline || '', (s.unknowns || []).length, s.form_language, s.source || '',
      body.brief_md || '', JSON.stringify(s)].map(asText_));
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

**Copy for Claude** puts this on your clipboard — paste it into Claude (or a Claude Project with your quotation template):

1. A fixed instruction: summarise the need, propose a line configuration from the derived figures (flagging anything resting on missing input), and draft a WhatsApp follow-up **in the customer's form language** from the "To confirm" list.
2. The Markdown brief.
3. The full JSON.

Typical result: a configuration outline you check, plus a follow-up message you send — the missing-data loop closes in one round.

---

## Data contract / 数据契约 · `bib-questionnaire/v2`

Rules: keys are `snake_case` with the unit in the name (`weight_g`, `bulk_density_g_cm3`). Enum values are fixed English codes whatever the form language. `null` = left blank; `"not_sure"` = customer explicitly unsure. Free text is kept verbatim in the customer's language.

| Path | Type | Values |
|---|---|---|
| `schema` · `id` · `submitted_at` | string | `bib-questionnaire/v2` · `BIB-YYMMDD-XXXX` · ISO 8601 |
| `form_language` · `source` | string | `en` `ru` `zh` · from `?src=` |
| `contact.{name,company,country,role,email,whatsapp}` | string \| null | |
| `product.category` | enum | `salt` `sugar` `rice` `seeds` `detergent` `flour` `other` |
| `product.description` | string \| null | |
| `product.form` | enum \| null | `granule` `crystal` `powder` `flake` `other` |
| `product.traits` | enum[] | `free_flowing` `dusty` `sticky` `hygroscopic` `corrosive` `fragile` |
| `product.particle_size_mm` | string \| null | range as typed, e.g. `0.3–0.8` |
| `product.bulk_density_g_cm3` · `product.moisture_pct` | number \| null | |
| `pouches[]` | 1–4 objects | `weight_g`, `length_mm`, `width_mm`, `thickness_mm`, `pouches_per_bag`, `per_layer` (numbers \| null) |
| `packaging.pouch_film` · `packaging.existing_master_bag` | string \| null | |
| `packaging.master_bag_material` | enum | `pe_film` `pp_woven` `not_sure` |
| `packaging.arrangement` | enum \| null | `top_to_top` `side_to_side` `not_sure` |
| `line.pain_points` | string \| null | customer's own words |
| `line.scope` | enum[] (≥ 1) | `primary_packing` `secondary_bib` `conveying` `inspection` `palletizing` `turnkey` |
| `line.target_capacity` | object \| null | `{ value: number, unit: "t_per_hour" \| "t_per_day" \| "pouches_per_min" }` |
| `line.weighing_accuracy` | string \| null | |
| `line.machine_material` | enum \| null | `ss304_contact` `ss304_full` `ss316_contact` `not_sure` |
| `line.current_method` | enum \| null | `manual` `semi_auto` `automatic` `new_project` |
| `site.voltage_v` | number \| null | |
| `site.frequency_hz` · `site.phase` | number \| null | `50` `60` · `3` `1` |
| `site.compressed_air` | enum \| null | `yes` `no` `not_sure` |
| `site.space` | string \| null | |
| `project.timeline` | enum \| null | `within_3m` `3_6m` `6_12m` `exploring` |
| `derived` | object | preliminary engineering, see below |
| `unknowns[]` | `{ field, label }` | inputs still to confirm with the customer |

### Derived figures / 派生工程数据

Same formulas as [bib-calculator](https://github.com/yangcong2828/bib-calculator); a key is present only when every input it needs is present.

```
Master bag weight  = weight_g × pouches_per_bag / 1000                         (kg)
Stack (per pouch)  = A₁ × B × H     A = n × L (top-to-top) or n × W (side-to-side)
                                    A₁ = A − (n−1) × o    o = min(18, 0.4 L)  or  0.1 W
                                    B = W or L,  H = ⌈count ÷ n⌉ × T
Empty bag          = A₁ × B × (1.1 H + B + 100)   PE film   ·   (… + 50)   PP woven
Machine            = ZR-VBIB-120 (PE film, 120 pouches/min) · ZR-WBIB-90 (PP woven, 90 pouches/min, ≤ 6 bags/min)
Machines needed    = ⌈target pouches/min ÷ machine pouches/min⌉       t/day assumes 16 h/day
```

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
