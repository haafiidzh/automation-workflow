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
    create: string;
    creating: string;
    generating: string;
    open: string;
    retry: string;
    preview: string;
    previewTitle: string;
    previewEmpty: string;
  };
  missingFields: {
    confirm: string;
    pickDate: string;
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
    create: "Buat di Notion",
    creating: "Membuat…",
    generating: "Membuat ticket notion ...",
    open: "Buka di Notion ↗",
    retry: "Coba lagi",
    preview: "Preview",
    previewTitle: "Preview ticket Notion",
    previewEmpty: "Empty",
  },
  missingFields: {
    confirm: "Konfirmasi",
    pickDate: "Pilih tanggal",
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

Tugas kamu sekarang:
1. Baca struktur repo ini (README, docs yang ada) buat ngerti domain project-nya.
2. Tanya aku hal yang belum jelas: nama & tujuan agent yang mau dibuat, apakah butuh integrasi Notion (kalau ya minta database ID + property list, atau bantu aku fetch via API), aturan tasking spesifik apa yang harus dipatuhi.
3. Generate semua file di atas dengan isi yang sudah disesuaikan ke project ini, bukan template kosong.
4. Kasih tau aku baris yang harus ditambahkan ke workflow/projects.md di repo orchestrator: "| <id> | <label> | <path absolut project ini> |".`,
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
    create: "Create in Notion",
    creating: "Creating…",
    generating: "Creating Notion ticket…",
    open: "Open in Notion ↗",
    retry: "Retry",
    preview: "Preview",
    previewTitle: "Notion ticket preview",
    previewEmpty: "Empty",
  },
  missingFields: {
    confirm: "Confirm",
    pickDate: "Pick a date",
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

Your task now:
1. Read this repo's structure (README, existing docs) to understand the project's domain.
2. Ask me about anything unclear: name & purpose of the agent(s) to create, whether Notion integration is needed (if so ask for database ID + property list, or help me fetch it via API), any specific tasking rules to follow.
3. Generate all files above with content tailored to this project, not empty templates.
4. Tell me the row to add to workflow/projects.md in the orchestrator repo: "| <id> | <label> | <absolute path to this project> |".`,
  },
};

export const dictionaries = { id, en } as const;
