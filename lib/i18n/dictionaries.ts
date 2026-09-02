export type Locale = "id" | "en";

export const locales: Locale[] = ["id", "en"];

type Dictionary = {
  topBar: {
    brand: string;
    newSession: string;
    onboardingTrigger: string;
    themeToLight: string;
    themeToDark: string;
    langSwitch: string;
  };
  empty: {
    ready: string;
    notReady: string;
    notReadyHint: string;
  };
  composer: {
    projectPlaceholder: string;
    agentPlaceholder: string;
    agentLoading: string;
    notionPlaceholder: string;
    rescanTitle: string;
    incompleteProject: (missing: string) => string;
    inputPlaceholder: string;
    inputPlaceholderNotReady: string;
    send: string;
    incompleteLabel: string;
    emptyLabel: string;
  };
  errors: {
    configLoad: string;
    scanProject: string;
    chatFailed: string;
    sessionError: string;
    notionCreate: string;
  };
  notionTicket: {
    ready: string;
    readyCount: (count: number) => string;
    create: string;
    creating: string;
    generating: string;
    open: string;
    retry: string;
    preview: string;
    previewTitle: string;
    previewEmpty: string;
    counter: (current: number, total: number) => string;
    prevTicket: string;
    nextTicket: string;
  };
  missingFields: {
    confirm: string;
    pickDate: string;
    include: string;
    skip: string;
    kindField: string;
    kindQuestion: string;
    kindRisk: string;
  };
  sidebar: {
    collapse: string;
    expand: string;
    empty: string;
    selectProject: string;
    loadError: string;
  };
  onboarding: {
    triggerTitle: string;
    dialogTitle: string;
    tabGuide: string;
    tabPrompt: string;
    copyTitle: string;
    promptIntro: string;
    guideStep1Title: string;
    guideStep1Rest: string;
    guideStep1Code: string;
    guideStep2: string[];
    guideStepRequiredTitle: string;
    guideStepRequiredCode: string;
    guideStepRequiredNote: string;
    guideStepPeopleTitle: string;
    guideStepPeopleCode: string;
    guideStepPeopleNote: string;
    guideStepSettingsTitle: string;
    guideStepSettingsCode: string;
    guideStepSettingsNote: string;
    guideStep3: string[];
    guideStep4Title: string;
    guideStep4Rest: string;
    guideStep4Code: string;
    guideStep4Note1: string;
    guideStep4Note2: string;
    guideExample: string;
    prompt: string;
  };
};

const id: Dictionary = {
  topBar: {
    brand: "Orchestrator",
    newSession: "Sesi baru",
    onboardingTrigger: "Cara daftarkan project baru",
    themeToLight: "Ganti ke light mode",
    themeToDark: "Ganti ke dark mode",
    langSwitch: "Ganti bahasa",
  },
  empty: {
    ready: "Mulai brief",
    notReady: "Pilih project, agent, dan akun Notion",
    notReadyHint: "Lengkapi pilihan di kolom bawah dulu.",
  },
  composer: {
    projectPlaceholder: "Project…",
    agentPlaceholder: "Agent…",
    agentLoading: "memuat…",
    notionPlaceholder: "Notion…",
    rescanTitle: "Scan ulang .claude/agents/",
    incompleteProject: (missing: string) => `Project belum lengkap: ${missing}`,
    inputPlaceholder: "Ketik intent…",
    inputPlaceholderNotReady: "Lengkapi pilihan di atas dulu",
    send: "Kirim",
    incompleteLabel: "(tidak lengkap)",
    emptyLabel: "(kosong)",
  },
  errors: {
    configLoad: "Gagal memuat /api/config",
    scanProject: "Gagal scan project",
    chatFailed: "Request gagal",
    sessionError: "Sesi berakhir dengan error.",
    notionCreate: "Gagal membuat page Notion",
  },
  notionTicket: {
    ready: "Ticket Notion siap dibuat",
    readyCount: (count) => `${count} ticket Notion siap dibuat`,
    create: "Buat di Notion",
    creating: "Membuat…",
    generating: "Membuat ticket notion ...",
    open: "Buka di Notion ↗",
    retry: "Coba lagi",
    preview: "Preview",
    previewTitle: "Preview ticket Notion",
    previewEmpty: "Empty",
    counter: (current, total) => `Ticket ${current} dari ${total}`,
    prevTicket: "Ticket sebelumnya",
    nextTicket: "Ticket selanjutnya",
  },
  missingFields: {
    confirm: "Konfirmasi",
    pickDate: "Pilih tanggal",
    include: "Ya, sertakan",
    skip: "Tidak, abaikan",
    kindField: "Properti wajib",
    kindQuestion: "Open question",
    kindRisk: "Risk",
  },
  sidebar: {
    collapse: "Sembunyikan riwayat sesi",
    expand: "Tampilkan riwayat sesi",
    empty: "Belum ada sesi tersimpan",
    selectProject: "Pilih project dulu",
    loadError: "Gagal memuat daftar sesi",
  },
  onboarding: {
    triggerTitle: "Cara daftarkan project baru",
    dialogTitle: "Daftarkan project baru",
    tabGuide: "Panduan",
    tabPrompt: "Prompt AI setup",
    copyTitle: "Copy prompt",
    promptIntro: "Copy, jalankan di root project baru (folder itu jadi cwd agent-nya).",
    guideStep1Title: "Buat folder ",
    guideStep1Rest: " di root project, isi:",
    guideStep1Code: `.claude/
  agents/<nama-agent>.md   # wajib: frontmatter name + description
  docs/*.md                # opsional: referensi buat agent
  rules/tasking.md         # wajib: aturan keras, dibaca penuh tiap sesi`,
    guideStep2: [
      "Kalau project butuh auto-create ticket Notion: tambah ",
      ".claude/docs/NOTION_TASK_SCHEMA.md",
      " berisi database ID + daftar lengkap Properties (nama, type, opsi). Agent baca file ini sendiri buat nentuin ",
      "database_id",
      " — tidak disimpan di registry app.",
    ],
    guideStepRequiredTitle:
      "Supaya app bisa nanya lewat tombol/pilihan (bukan minta agent nebak) kalau ada properti yang belum diisi, tambah section ini di NOTION_TASK_SCHEMA.md:",
    guideStepRequiredCode: `## Required fields (task creation)

| Property     | Rule                                          |
|---           |---                                            |
| \`Programmer\` | assignee — ask if not given                  |
| \`Due Date\`   | only if user gives one explicit — no invent  |
| \`Reviewer\`   | always Hafid Kusuma (\`person-id\`)            |`,
    guideStepRequiredNote:
      "Baris yang butuh input user (bukan yang auto/default/hardcode) bikin agent munculin picker interaktif di chat: pilihan people/select jadi tombol, date jadi date-picker, sisanya jadi input teks. Baris yang sudah pasti/default (kayak Reviewer di atas) tidak akan ditanyakan.",
    guideStepPeopleTitle:
      "Kalau ada properti type people (Programmer/Reviewer dsb), isi tabel \"Known people\" di NOTION_TASK_SCHEMA.md — JANGAN pakai GET /v1/users, itu cuma balikin identity yang sudah connect ke integration (biasanya cuma workspace owner + bot-nya sendiri), bukan semua member workspace:",
    guideStepPeopleCode: `# 1) query database, page_size 100, paginate pakai has_more + next_cursor
curl -s -X POST "https://api.notion.com/v1/databases/<database_id>/query" \\
  -H "Authorization: Bearer $NOTION_API_KEY" \\
  -H "Notion-Version: 2022-06-28" \\
  -H "Content-Type: application/json" \\
  -d '{"page_size": 100}'

# 2) try/catch tiap page:
#    - request gagal (403/404) -> database belum di-"Connect to" ke integration
#      di Notion UI, sambungkan dulu, baru ulangi
#    - request sukses tapi results kosong & has_more:false -> project baru,
#      belum ada task lama; minta user assign 1 task dummy manual lewat
#      Notion UI dulu, baru ulangi query ini
# 3) kumpulkan id unik dari tiap page:
#    properties.Programmer.people[] + properties.Reviewer.people[]
#    - name terisi -> tulis ke tabel Known people
#    - name null/kosong -> tandai *(unresolved)*: guest/removed member,
#      di luar jangkauan baca integration, resolve manual di Notion UI`,
    guideStepPeopleNote:
      "Jangan pernah nebak/hardcode person-id. Hasil akhir ditulis ke NOTION_TASK_SCHEMA.md persis format tabel Name | Person ID | Email — contoh lengkap di ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md bagian \"Known people\".",
    guideStepSettingsTitle:
      "Kalau agent project ini dijalankan langsung lewat Claude Code (bukan lewat app orchestrator ini) dan query Notion pakai Bash + curl + $NOTION_API_KEY sendiri (bukan tool query_database bawaan app), tambah .claude/settings.json biar tidak muncul permission prompt tiap query. Scope izinnya sesempit mungkin — curl ke database ID spesifik, bukan curl secara umum:",
    guideStepSettingsCode: `{
  "permissions": {
    "allow": [
      "Bash(curl -s https://api.notion.com/v1/databases/<database_id>*)"
    ]
  }
}`,
    guideStepSettingsNote:
      "Commit file ini (settings.json, bukan settings.local.json) supaya izinnya berlaku buat semua orang yang jalanin agent ini, tidak cuma kamu.",
    guideStep3: [
      'Paling gampang: pakai tab "Prompt AI setup" — copy, tempel ke Claude Code (atau agent lain) yang jalan di folder project barumu. Dia akan wawancara singkat lalu generate semua file di atas.',
    ],
    guideStep4Title: "Terakhir, tambah satu baris ke ",
    guideStep4Rest: " di repo orchestrator ini:",
    guideStep4Code: "| <id> | <label> | <path absolut project> |",
    guideStep4Note1: "Path harus di dalam ",
    guideStep4Note2:
      " (lihat .env), kalau tidak project muncul disabled di dropdown.",
    guideExample: "Contoh struktur lengkap yang benar: ~/qc_apps/.claude.",
    prompt: `Kamu bantu setup folder ".claude" di repo ini supaya project ini bisa didaftarkan ke app "orchestrator" (Claude Agent SDK runner lokal).

Struktur wajib, persis:

.claude/
  agents/
    <nama-agent>.md      # satu atau lebih persona agent
  docs/
    (bebas, file .md apa saja yang agent butuh baca — desain, schema, dsb)
  rules/
    tasking.md            # WAJIB, satu file ini dibaca penuh & disuntik ke system prompt tiap sesi

Ketentuan tiap file:

1. .claude/agents/<nama>.md
   - Frontmatter YAML wajib ada "name" dan "description" (description dipakai buat nentuin kapan agent ini dipakai).
   - Opsional: "tools" (daftar tool yang boleh dipakai persona ini secara konsep — app sendiri sudah hardcode allowedTools ke Read/Glob/Grep, jadi field ini dokumentasi saja).
   - Body: system prompt persona itu — siapa dia, project apa, urutan file yang harus dia baca dulu sebelum jawab, gaya output, batasan (boundaries) apa yang TIDAK boleh dia lakukan (misal: gak nulis kode, gak edit file X).

2. .claude/rules/tasking.md
   - WAJIB ada, kalau tidak ada project dianggap tidak lengkap (disabled di dropdown).
   - Isi: aturan keras yang harus selalu dipatuhi tiap kali agent bikin output/task — format penamaan, properti wajib, urutan section body, dsb.
   - Kalau project ini bakal dipakai buat auto-create ticket Notion: sebutkan di sini bahwa detail schema Notion (database ID, property list, opsi) ada di .claude/docs/NOTION_TASK_SCHEMA.md, dan agent WAJIB baca file itu dulu sebelum nyusun properties. Kamu TIDAK perlu nulis ulang format JSON output-nya di sini — itu sudah otomatis disuntik oleh orchestrator app sendiri.

3. .claude/docs/*.md
   - File referensi apa saja yang persona butuh baca (desain arsitektur, ringkasan modul, dsb).
   - Kalau ada NOTION_TASK_SCHEMA.md: wajib cantumkan Database ID, workspace, dan tabel lengkap semua Properties Notion (nama, type, opsi/select values) — agent baca ini buat nyusun "properties" sesuai bentuk asli Notion API (mis. {"Name": {"title": [...]}}).
   - Tambahkan juga section "## Required fields (task creation)" — tabel \`Property | Rule\` berisi properti yang WAJIB diisi tiap task dibuat. Untuk baris yang nilainya harus ditanya ke user (bukan auto/default/hardcode), tulis rule-nya jelas (mis. "assignee — ask if not given", "only if user gives one explicit — no invent"). Ini yang bikin app munculin picker interaktif (tombol pilihan / date-picker) di chat kalau propertinya belum keisi — lihat contoh lengkap di ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md.

4. .claude/settings.json (cuma kalau agent project ini juga dipakai langsung lewat Claude Code, bukan cuma lewat orchestrator app, dan dia query Notion pakai Bash + curl + $NOTION_API_KEY)
   - Tambah permissions.allow discope sesempit mungkin ke curl database ID itu saja, contoh: {"permissions":{"allow":["Bash(curl -s https://api.notion.com/v1/databases/<database_id>*)"]}}
   - Commit file ini (bukan settings.local.json) biar izinnya kepakai buat semua orang, bukan cuma kamu.

5. Tabel "Known people" (Programmer/Reviewer) di NOTION_TASK_SCHEMA.md — cuma kalau ada property type people
   - JANGAN pakai GET /v1/users buat resolve nama ke person-id. Integration token cuma bisa lihat identity yang sudah connect ke integration itu (biasanya cuma workspace owner + bot-nya sendiri), bukan semua member workspace.
   - Cara yang benar: POST https://api.notion.com/v1/databases/<database_id>/query dengan {"page_size": 100}, paginate pakai has_more + start_cursor/next_cursor sampai habis. Dari tiap page, kumpulkan id unik di properties.Programmer.people[] dan properties.Reviewer.people[].
   - Try/catch tiap request:
     - gagal (403/404) -> database belum di-"Connect to" ke integration lewat titik-tiga halaman database di Notion UI. Kasih tau user, minta connect, baru ulangi.
     - sukses tapi results kosong & has_more:false -> project baru, belum ada task lama buat difetch. Minta user assign 1 task dummy manual lewat Notion UI dulu (siapa aja), baru ulangi query ini.
   - Tiap person id: kalau field "name" di response terisi, tulis ke tabel Known people. Kalau null/kosong, tandai *(unresolved)* — artinya guest/removed member, di luar jangkauan baca integration, gak bisa diisi otomatis, harus resolve manual di Notion UI.
   - Jangan pernah nebak/hardcode person-id. Tulis hasil akhir persis format tabel Name | Person ID | Email — contoh lengkap di ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md bagian "Known people".

Tugas kamu sekarang:
1. Baca struktur repo ini (README, docs yang ada) buat ngerti domain project-nya.
2. Tanya aku hal yang belum jelas: nama & tujuan agent yang mau dibuat, apakah butuh integrasi Notion (kalau ya minta database ID + property list, atau bantu aku fetch via API), aturan tasking spesifik apa yang harus dipatuhi.
3. Generate semua file di atas dengan isi yang sudah disesuaikan ke project ini, bukan template kosong.
4. Kalau ada NOTION_TASK_SCHEMA.md dengan property type people: langsung jalankan prosedur poin 5 di atas buat bootstrap tabel Known people-nya, jangan cuma nulis section kosong.
5. Kasih tau aku baris yang harus ditambahkan ke workflow/projects.md di repo orchestrator: "| <id> | <label> | <path absolut project ini> |".`,
  },
} as const;

const en: Dictionary = {
  topBar: {
    brand: "Orchestrator",
    newSession: "New session",
    onboardingTrigger: "How to register a new project",
    themeToLight: "Switch to light mode",
    themeToDark: "Switch to dark mode",
    langSwitch: "Switch language",
  },
  empty: {
    ready: "Start a brief",
    notReady: "Pick a project, agent, and Notion account",
    notReadyHint: "Fill in the fields below first.",
  },
  composer: {
    projectPlaceholder: "Project…",
    agentPlaceholder: "Agent…",
    agentLoading: "loading…",
    notionPlaceholder: "Notion…",
    rescanTitle: "Rescan .claude/agents/",
    incompleteProject: (missing: string) => `Project incomplete: ${missing}`,
    inputPlaceholder: "Type your intent…",
    inputPlaceholderNotReady: "Fill in the fields above first",
    send: "Send",
    incompleteLabel: "(incomplete)",
    emptyLabel: "(empty)",
  },
  errors: {
    configLoad: "Failed to load /api/config",
    scanProject: "Failed to scan project",
    chatFailed: "Request failed",
    sessionError: "Session ended with an error.",
    notionCreate: "Failed to create Notion page",
  },
  notionTicket: {
    ready: "Notion ticket ready to create",
    readyCount: (count) => `${count} Notion tickets ready to create`,
    create: "Create in Notion",
    creating: "Creating…",
    generating: "Creating Notion ticket…",
    open: "Open in Notion ↗",
    retry: "Retry",
    preview: "Preview",
    previewTitle: "Notion ticket preview",
    previewEmpty: "Empty",
    counter: (current, total) => `Ticket ${current} of ${total}`,
    prevTicket: "Previous ticket",
    nextTicket: "Next ticket",
  },
  missingFields: {
    confirm: "Confirm",
    pickDate: "Pick a date",
    include: "Yes, include it",
    skip: "No, skip it",
    kindField: "Required field",
    kindQuestion: "Open question",
    kindRisk: "Risk",
  },
  sidebar: {
    collapse: "Hide session history",
    expand: "Show session history",
    empty: "No saved sessions yet",
    selectProject: "Pick a project first",
    loadError: "Failed to load session list",
  },
  onboarding: {
    triggerTitle: "How to register a new project",
    dialogTitle: "Register a new project",
    tabGuide: "Guide",
    tabPrompt: "AI setup prompt",
    copyTitle: "Copy prompt",
    promptIntro: "Copy, run it at the new project's root (that folder becomes the agent's cwd).",
    guideStep1Title: "Create a ",
    guideStep1Rest: " folder at the project root, containing:",
    guideStep1Code: `.claude/
  agents/<agent-name>.md   # required: frontmatter name + description
  docs/*.md                # optional: reference material for the agent
  rules/tasking.md         # required: hard rules, read in full every session`,
    guideStep2: [
      "If the project needs auto-create Notion tickets: add ",
      ".claude/docs/NOTION_TASK_SCHEMA.md",
      " with the database ID + full Properties list (name, type, options). The agent reads this itself to determine the ",
      "database_id",
      " — it isn't stored in the app's registry.",
    ],
    guideStepRequiredTitle:
      "So the app can ask via buttons/pickers (instead of making the agent guess) when a property is missing, add this section to NOTION_TASK_SCHEMA.md:",
    guideStepRequiredCode: `## Required fields (task creation)

| Property     | Rule                                          |
|---           |---                                            |
| \`Programmer\` | assignee — ask if not given                  |
| \`Due Date\`   | only if user gives one explicit — no invent  |
| \`Reviewer\`   | always Hafid Kusuma (\`person-id\`)            |`,
    guideStepRequiredNote:
      "A row that needs user input (not auto/default/hardcoded) makes the agent show an interactive picker in chat: people/select options become buttons, date becomes a date-picker, anything else becomes a text input. A row that's already fixed/default (like Reviewer above) never gets asked.",
    guideStepPeopleTitle:
      "If there's a people-type property (Programmer/Reviewer, etc), fill in the \"Known people\" table in NOTION_TASK_SCHEMA.md — do NOT use GET /v1/users, it only returns identities already connected to the integration (usually just the workspace owner + its own bot), not the whole workspace membership:",
    guideStepPeopleCode: `# 1) query the database, page_size 100, paginate via has_more + next_cursor
curl -s -X POST "https://api.notion.com/v1/databases/<database_id>/query" \\
  -H "Authorization: Bearer $NOTION_API_KEY" \\
  -H "Notion-Version: 2022-06-28" \\
  -H "Content-Type: application/json" \\
  -d '{"page_size": 100}'

# 2) try/catch each page:
#    - request fails (403/404) -> database isn't "Connected to" the
#      integration yet in the Notion UI; connect it, then retry
#    - request succeeds but results empty & has_more:false -> brand-new
#      project, no prior tasks; ask the user to manually assign one dummy
#      task via the Notion UI first, then retry this query
# 3) collect distinct ids across every page:
#    properties.Programmer.people[] + properties.Reviewer.people[]
#    - name present -> write to the Known people table
#    - name null/empty -> mark *(unresolved)*: guest/removed member,
#      outside the integration's read scope, resolve manually in Notion UI`,
    guideStepPeopleNote:
      "Never guess or hardcode a person-id. Write the final result into NOTION_TASK_SCHEMA.md in the exact Name | Person ID | Email table format — full example at ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md, \"Known people\" section.",
    guideStepSettingsTitle:
      "If this project's agent runs directly via Claude Code (not through this orchestrator app) and queries Notion using Bash + curl + $NOTION_API_KEY itself (instead of the app's built-in query_database tool), add .claude/settings.json so query calls don't hit a permission prompt every time. Scope the rule as narrowly as possible — curl to that specific database ID, not curl in general:",
    guideStepSettingsCode: `{
  "permissions": {
    "allow": [
      "Bash(curl -s https://api.notion.com/v1/databases/<database_id>*)"
    ]
  }
}`,
    guideStepSettingsNote:
      "Commit this file (settings.json, not settings.local.json) so the permission applies to everyone running this agent, not just you.",
    guideStep3: [
      'Easiest: use the "AI setup prompt" tab — copy it, paste into Claude Code (or another agent) running in your new project\'s folder. It will interview you briefly then generate all files above.',
    ],
    guideStep4Title: "Finally, add one row to ",
    guideStep4Rest: " in this orchestrator repo:",
    guideStep4Code: "| <id> | <label> | <absolute project path> |",
    guideStep4Note1: "Path must be inside ",
    guideStep4Note2:
      " (see .env), otherwise the project shows disabled in the dropdown.",
    guideExample: "Example of a correct full structure: ~/qc_apps/.claude.",
    prompt: `Help me set up a ".claude" folder in this repo so this project can be registered with the "orchestrator" app (a local Claude Agent SDK runner).

Required structure, exactly:

.claude/
  agents/
    <agent-name>.md      # one or more agent personas
  docs/
    (any .md files the agent needs to read — design, schema, etc.)
  rules/
    tasking.md            # REQUIRED, this one file is read in full & injected into the system prompt every session

Requirements per file:

1. .claude/agents/<name>.md
   - YAML frontmatter must have "name" and "description" (description is used to decide when this agent is picked).
   - Optional: "tools" (list of tools this persona is conceptually allowed to use — the app itself already hardcodes allowedTools to Read/Glob/Grep, so this field is documentation only).
   - Body: that persona's system prompt — who they are, what project, which files they must read before answering, output style, boundaries — what they must NOT do (e.g. don't write code, don't edit file X).

2. .claude/rules/tasking.md
   - REQUIRED — if missing, the project is treated as incomplete (disabled in the dropdown).
   - Content: hard rules that must always be followed whenever the agent produces output/tasks — naming format, required properties, body section order, etc.
   - If this project will be used for Notion auto-create tickets: state here that Notion schema details (database ID, property list, options) live in .claude/docs/NOTION_TASK_SCHEMA.md, and the agent MUST read that file before building properties. You do NOT need to restate the JSON output format here — the orchestrator app injects that automatically.

3. .claude/docs/*.md
   - Any reference files the persona needs (architecture design, module summaries, etc.).
   - If there's a NOTION_TASK_SCHEMA.md: it must include the Database ID, workspace, and a full table of all Notion Properties (name, type, options/select values) — the agent reads this to build "properties" in real Notion API shape (e.g. {"Name": {"title": [...]}}).
   - Also add a "## Required fields (task creation)" section — a \`Property | Rule\` table listing properties that MUST be set on every new task. For rows whose value must be asked from the user (not auto/default/hardcoded), spell the rule out clearly (e.g. "assignee — ask if not given", "only if user gives one explicit — no invent"). This is what makes the app show an interactive picker (buttons / date-picker) in chat when that property is still missing — see the full example at ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md.

4. .claude/settings.json (only if this project's agent is also run directly via Claude Code, not only through the orchestrator app, and it queries Notion using Bash + curl + $NOTION_API_KEY)
   - Add a permissions.allow rule scoped as narrowly as possible to curl against that one database ID, e.g.: {"permissions":{"allow":["Bash(curl -s https://api.notion.com/v1/databases/<database_id>*)"]}}
   - Commit this file (not settings.local.json) so the permission applies for everyone, not just you.

5. "Known people" table (Programmer/Reviewer) in NOTION_TASK_SCHEMA.md — only if there's a people-type property
   - Do NOT use GET /v1/users to resolve names to person-ids. The integration token can only see identities already connected to that integration (usually just the workspace owner + its own bot), not the whole workspace membership.
   - Correct approach: POST https://api.notion.com/v1/databases/<database_id>/query with {"page_size": 100}, paginate via has_more + start_cursor/next_cursor until exhausted. From each page, collect distinct ids in properties.Programmer.people[] and properties.Reviewer.people[].
   - Try/catch each request:
     - fails (403/404) -> the database hasn't been "Connected to" the integration via the database page's ••• menu in the Notion UI. Tell the user, ask them to connect it, then retry.
     - succeeds but results is empty & has_more:false -> brand-new project, no prior tasks to fetch from. Ask the user to manually assign one dummy task via the Notion UI first (anyone), then retry this query.
   - For each person id: if the response's "name" field is set, write it to the Known people table. If null/empty, mark it *(unresolved)* — a guest/removed member outside the integration's read scope; can't be filled automatically, must be resolved manually in the Notion UI.
   - Never guess or hardcode a person-id. Write the final result in the exact Name | Person ID | Email table format — full example at ~/qc_apps/.claude/docs/NOTION_TASK_SCHEMA.md, "Known people" section.

Your task now:
1. Read this repo's structure (README, existing docs) to understand the project's domain.
2. Ask me about anything unclear: name & purpose of the agent(s) to create, whether Notion integration is needed (if so ask for database ID + property list, or help me fetch it via API), any specific tasking rules to follow.
3. Generate all files above with content tailored to this project, not empty templates.
4. If there's a NOTION_TASK_SCHEMA.md with a people-type property: actually run the procedure in point 5 above to bootstrap its Known people table, don't just write an empty section.
5. Tell me the row to add to workflow/projects.md in the orchestrator repo: "| <id> | <label> | <absolute path to this project> |".`,
  },
};

export const dictionaries = { id, en } as const;
