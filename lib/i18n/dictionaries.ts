export type Locale = "id" | "en";

export const locales: Locale[] = ["id", "en"];

/** One numbered step in the setup tabs; every `code` block gets a copy button. */
export type SetupStep = {
  title: string;
  body?: string;
  code?: string;
  note?: string;
};

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
    noProjectsFound: string;
    noNotionFound: string;
    noAgentsFound: string;
    attachTitle: string;
    attachTooBig: (maxMb: number) => string;
    attachUnsupported: string;
    attachUploading: string;
    attachRemove: string;
  };
  errors: {
    configLoad: string;
    scanProject: string;
    chatFailed: string;
    sessionError: string;
    notionCreate: string;
    notionTimeout: string;
    uploadFailed: string;
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
  disturb: {
    button: string;
    addNote: string;
    addDoc: string;
    notePlaceholder: string;
    remove: string;
    docListTitle: string;
  };
  sidebar: {
    collapse: string;
    expand: string;
    empty: string;
    selectProject: string;
    loadError: string;
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    loginButton: string;
    loggingIn: string;
    loginFailed: string;
    unknownUser: string;
    passwordNotSupported: string;
    insecureNotice: string;
    logout: string;
    loggedInAs: (label: string) => string;
  };
  localAgent: {
    title: string;
    connect: string;
    statusChecking: string;
    statusConnected: (roots: number) => string;
    statusUnpaired: string;
    statusDisconnected: string;
    dialogTitle: string;
    intro: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    tokenLabel: string;
    tokenPlaceholder: string;
    showToken: string;
    hideToken: string;
    pair: string;
    disconnect: string;
    recheck: string;
    errorNotRunning: string;
    errorPortConflict: string;
    errorInvalidToken: string;
    downloadLink: string;
    close: string;
    rootsTitle: string;
    rootsEmpty: string;
    rootsError: string;
    rootRead: string;
    rootWrite: string;
    writeWarning: string;
    writeHint: string;
  };
  onboarding: {
    triggerTitle: string;
    dialogTitle: string;
    tabAgent: string;
    tabFolders: string;
    tabNotion: string;
    tabGuide: string;
    tabPrompt: string;
    /** Numbered setup steps; every `code` block is rendered with a copy button. */
    agentSteps: SetupStep[];
    folderSteps: SetupStep[];
    notionSteps: SetupStep[];
    setupDocLink: string;
    platformNote: string;
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
    noProjectsFound: "Project tidak ditemukan",
    noNotionFound: "Akun Notion tidak ditemukan",
    noAgentsFound: "Agent tidak ditemukan",
    attachTitle: "Lampirkan gambar, PDF, atau Excel (maks 10MB)",
    attachTooBig: (maxMb) => `File melebihi batas ${maxMb}MB`,
    attachUnsupported: "Tipe file tidak didukung (hanya gambar, PDF, Excel .xlsx)",
    attachUploading: "Mengunggah…",
    attachRemove: "Hapus lampiran",
  },
  errors: {
    configLoad: "Gagal memuat /api/config",
    scanProject: "Gagal scan project",
    chatFailed: "Request gagal",
    sessionError: "Sesi berakhir dengan error.",
    notionCreate: "Gagal membuat page Notion",
    notionTimeout: "Waktu tunggu habis — server tidak merespons, coba lagi",
    uploadFailed: "Gagal mengunggah file",
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
  disturb: {
    button: "Tambah konteks",
    addNote: "Tambah catatan",
    addDoc: "Tambah dokumen",
    notePlaceholder: "Ketik catatan atau constraint…",
    remove: "Hapus",
    docListTitle: "Pilih dokumen project",
  },
  sidebar: {
    collapse: "Sembunyikan riwayat sesi",
    expand: "Tampilkan riwayat sesi",
    empty: "Belum ada sesi tersimpan",
    selectProject: "Pilih project dulu",
    loadError: "Gagal memuat daftar sesi",
  },
  auth: {
    loginTitle: "Masuk",
    loginSubtitle: "Pilih identitas kamu untuk melanjutkan.",
    usernameLabel: "Username",
    usernamePlaceholder: "mis. hafidz",
    loginButton: "Masuk",
    loggingIn: "Memproses…",
    loginFailed: "Gagal masuk",
    unknownUser: "Username tidak dikenal",
    passwordNotSupported: "Login berpassword belum didukung",
    insecureNotice:
      "Mode ini tanpa password — siapa pun yang bisa menjangkau server dan tahu username kamu bisa masuk sebagai kamu. Pakai hanya di jaringan lokal.",
    logout: "Keluar",
    loggedInAs: (label: string) => `Masuk sebagai ${label}`,
  },
  localAgent: {
    title: "Akses folder lokal",
    connect: "Sambungkan akses folder lokal",
    statusChecking: "Mengecek local agent…",
    statusConnected: (roots: number) => `Local agent tersambung (${roots} folder diizinkan)`,
    statusUnpaired: "Local agent jalan, tapi belum dipasangkan (token belum diisi)",
    statusDisconnected: "Local agent tidak terdeteksi",
    dialogTitle: "Sambungkan akses folder lokal",
    intro:
      "Agent jalan di server, jadi tidak bisa baca file di komputer kamu. Install local agent untuk memberi akses baca ke folder yang kamu pilih sendiri.",
    step1Title: "1. Download & jalankan local agent",
    step1Body: "Download binary Linux, lalu jalankan: orchestrator-agent run",
    step2Title: "2. Izinkan folder yang boleh dibaca",
    step2Body:
      "Jalankan: orchestrator-agent allow /path/ke/project, dan orchestrator-agent allow-origin <origin Orchestrator ini>",
    step3Title: "3. Tempel token pemasangan",
    step3Body: "Ambil token dengan: orchestrator-agent token",
    tokenLabel: "Token pemasangan",
    tokenPlaceholder: "Tempel token dari orchestrator-agent token",
    showToken: "Tampilkan token",
    hideToken: "Sembunyikan token",
    pair: "Pasangkan",
    disconnect: "Putuskan",
    recheck: "Cek ulang",
    errorNotRunning:
      "Local agent tidak jalan di komputer ini. Jalankan orchestrator-agent run lalu cek ulang.",
    errorPortConflict:
      "Port 47821-47830 terpakai semua. Tutup aplikasi yang memakai port itu lalu jalankan ulang local agent.",
    errorInvalidToken: "Token ditolak local agent. Ambil token terbaru dengan orchestrator-agent token.",
    downloadLink: "Petunjuk download & instalasi",
    close: "Tutup",
    rootsTitle: "Folder yang diizinkan",
    rootsEmpty:
      "Belum ada folder yang diizinkan. Jalankan orchestrator-agent allow <folder> lalu tekan tombol cek ulang.",
    rootsError: "Gagal membaca daftar folder dari local agent.",
    rootRead: "baca",
    rootWrite: "baca+tulis",
    writeWarning:
      "Agent bisa membuat dan mengubah file di folder bertanda baca+tulis. Cabut izinnya dengan orchestrator-agent revoke-write <folder>.",
    writeHint:
      "Izin tulis harus diminta per folder: orchestrator-agent allow-write <folder>. Defaultnya baca saja.",
  },
  onboarding: {
    triggerTitle: "Cara daftarkan project baru",
    dialogTitle: "Daftarkan project baru",
    tabAgent: "Local Agent",
    tabFolders: "Folder Project",
    tabNotion: "Notion",
    tabGuide: "Struktur .claude/",
    tabPrompt: "Prompt AI setup",
    setupDocLink: "Panduan lengkap: docs/setup.md",
    platformNote:
      "Local agent baru tersedia untuk Linux x86_64. Windows dan macOS belum didukung.",
    agentSteps: [
      {
        title: "1. Pasang binary",
        body: "Unduh atau build binary, taruh di ~/.local/bin, dan beri bit eksekusi.",
        code: `mkdir -p ~/.local/bin
curl -fsSL https://<host-orchestrator>/local-agent/orchestrator-agent-linux-amd64 \\
  -o ~/.local/bin/orchestrator-agent
chmod +x ~/.local/bin/orchestrator-agent`,
        note: "Kalau build sendiri: cd local-agent && ./build.sh lalu salin hasil di dist/.",
      },
      {
        title: "2. Izinkan halaman ini menghubungi agent",
        body: "Tanpa ini browser memblokir semua request ke agent (CORS).",
        code: "orchestrator-agent allow-origin __ORIGIN__",
      },
      {
        title: "3. Jalankan agent",
        body: "Biarkan jalan selama kamu memakai Orchestrator.",
        code: "orchestrator-agent run",
        note: "Port default 47821; kalau terpakai, agent naik sampai 47830 dan halaman ini ikut mencari di rentang itu.",
      },
      {
        title: "4. Jalankan otomatis saat login (opsional)",
        code: `mkdir -p ~/.config/systemd/user
cp orchestrator-agent.service ~/.config/systemd/user/
systemctl --user enable --now orchestrator-agent`,
      },
      {
        title: "5. Ambil token lalu pasangkan",
        body: "Salin hasilnya ke dialog ikon hard disk di kanan atas. Titik indikator berubah hijau kalau berhasil.",
        code: "orchestrator-agent token",
      },
    ],
    folderSteps: [
      {
        title: "1. Daftarkan folder project",
        body: "Daftar project di Orchestrator datang dari mesin kamu, bukan dari server. Folder yang tidak didaftarkan di sini akan ditolak dengan 403 — itu memang perilaku yang diinginkan.",
        code: 'orchestrator-agent allow ~/projects/app-x --id app-x --label "App X"',
        note: "Tanpa --id dan --label, keduanya diambil dari nama folder. id harus unik dan cocok ^[a-z0-9][a-z0-9_-]*$.",
      },
      {
        title: "2. Beri izin tulis kalau perlu",
        body: "Defaultnya baca saja. Izin tulis diminta per folder, dan agent baru bisa membuat atau mengubah file setelah ini.",
        code: "orchestrator-agent allow-write ~/projects/app-x",
        note: "Mencabutnya: orchestrator-agent revoke-write ~/projects/app-x",
      },
      {
        title: "3. Verifikasi",
        body: "status menampilkan id, label, mode dan path tiap folder.",
        code: "orchestrator-agent status",
      },
      {
        title: "4. Tiap komputer punya daftarnya sendiri",
        body: "Kalau kamu memakai dua komputer, daftarkan foldernya di masing-masing. Daftar project adalah properti mesin, jadi tidak ikut berpindah.",
      },
    ],
    notionSteps: [
      {
        title: "1. Buat internal integration",
        body: "Buka notion.so/my-integrations, buat internal integration, lalu salin Internal Integration Secret-nya.",
      },
      {
        title: "2. Share database ke integration itu",
        body: "Buka database target di Notion → menu ⋯ → Connections → pilih integration tadi. Langkah ini paling sering terlewat; gejalanya Notion membalas 404 (bukan 403) saat membuat ticket.",
      },
      {
        title: "3. Isi token ke env var di server",
        body: "Token disimpan di server, tidak pernah ditampilkan di UI ini. Jangan tempel token ke chat.",
        code: "NOTION_TOKEN_PERSONAL=secret_xxx",
      },
      {
        title: "4. Daftarkan barisnya",
        body: "Di workflow/notion-accounts.md. Kolom env berisi NAMA env var, bukan isinya. Kolom user diisi id user pemilik akun, atau dikosongkan kalau akun dipakai bersama.",
        code: `| id | label | env | workspace | user |
|---|---|---|---|---|
| jarvis | Jarvis | NOTION_TOKEN_PERSONAL | Digitamaze | u_hafidz |`,
      },
      {
        title: "5. Cocokkan dengan skema ticket",
        body: "Struktur properti database dijelaskan di .claude/docs/NOTION_TASK_SCHEMA.md project (lihat tab Struktur .claude/). Agent membaca file itu untuk tahu field apa yang harus diisi.",
      },
    ],

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
    guideStepPeopleCode: `# token di .claude/notion.curlrc (gitignored), BUKAN env var — command
# yang pakai $NOTION_API_KEY kena permission prompt tiap kali walau prefix-nya
# sudah di-allow, karena variable expansion di Bash selalu dianggap butuh
# approval terpisah. Isi file itu cuma 1 baris:
#   header = "Authorization: Bearer <token-mentah>"
#
# 1) query database, page_size 100, paginate pakai has_more + next_cursor
curl -s -K .claude/notion.curlrc -X POST "https://api.notion.com/v1/databases/<database_id>/query" \\
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
      "Kalau agent project ini dijalankan langsung lewat Claude Code (bukan lewat app orchestrator ini) dan query Notion pakai Bash + curl sendiri (bukan tool query_database bawaan app), buat .claude/notion.curlrc (gitignored, isi satu baris header Authorization — lihat contoh di atas) lalu tambah .claude/settings.json biar tidak muncul permission prompt tiap query. Command WAJIB pakai -K .claude/notion.curlrc, JANGAN taruh token lewat -H \"Authorization: Bearer $NOTION_API_KEY\" — command yang punya variable expansion ($VAR / $(...)) tetap kena approval manual walau prefix-nya sudah masuk allow list. Scope izinnya sesempit mungkin — curl ke database ID spesifik, bukan curl secara umum:",
    guideStepSettingsCode: `{
  "permissions": {
    "allow": [
      "Bash(curl -s -K .claude/notion.curlrc -X POST https://api.notion.com/v1/databases/<database_id>*)"
    ]
  }
}`,
    guideStepSettingsNote:
      "Commit settings.json (bukan settings.local.json) supaya izinnya berlaku buat semua orang yang jalanin agent ini. Commit juga .gitignore yang exclude .claude/notion.curlrc — file itu isi token mentah, jangan pernah ikut ke-commit.",
    guideStep3: [
      'Paling gampang: pakai tab "Prompt AI setup" — copy, tempel ke Claude Code (atau agent lain) yang jalan di folder project barumu. Dia akan wawancara singkat lalu generate semua file di atas.',
    ],
    guideStep4Title: "Kalau TIDAK memakai local agent, tambah satu baris ke ",
    guideStep4Rest:
      " di repo orchestrator ini. Dengan local agent ter-pair, file ini tidak dibaca sama sekali — daftar project datang dari tab Folder Project.",
    guideStep4Code: "| <id> | <label> | <path absolut project> |",
    guideStep4Note1: "Path harus di dalam ",
    guideStep4Note2:
      " (lihat .env) untuk mode tanpa local agent, kalau tidak project muncul disabled di dropdown. Saat ter-pair, batas itu tidak berlaku dan yang menentukan adalah allow-list local agent.",
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

4. .claude/settings.json + .claude/notion.curlrc (cuma kalau agent project ini juga dipakai langsung lewat Claude Code, bukan cuma lewat orchestrator app, dan dia query Notion pakai Bash + curl)
   - Taruh token di .claude/notion.curlrc (gitignored), isi satu baris: header = "Authorization: Bearer <token-mentah>". JANGAN pakai $NOTION_API_KEY inline di command curl — command dengan variable expansion tetap kena permission prompt manual walau prefix-nya sudah di-allow.
   - Command curl WAJIB pakai -K .claude/notion.curlrc, bukan -H "Authorization: ...".
   - Tambah permissions.allow discope sesempit mungkin, contoh: {"permissions":{"allow":["Bash(curl -s -K .claude/notion.curlrc -X POST https://api.notion.com/v1/databases/<database_id>*)"]}}
   - Commit settings.json (bukan settings.local.json) biar izinnya kepakai buat semua orang, bukan cuma kamu. Pastikan .claude/notion.curlrc masuk .gitignore.

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
    noProjectsFound: "No project found",
    noNotionFound: "No Notion account found",
    noAgentsFound: "No agent found",
    attachTitle: "Attach an image, PDF, or Excel file (max 10MB)",
    attachTooBig: (maxMb) => `File exceeds the ${maxMb}MB limit`,
    attachUnsupported: "Unsupported file type (only images, PDF, Excel .xlsx)",
    attachUploading: "Uploading…",
    attachRemove: "Remove attachment",
  },
  errors: {
    configLoad: "Failed to load /api/config",
    scanProject: "Failed to scan project",
    chatFailed: "Request failed",
    sessionError: "Session ended with an error.",
    notionCreate: "Failed to create Notion page",
    notionTimeout: "Request timed out — server did not respond, try again",
    uploadFailed: "Failed to upload file",
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
  disturb: {
    button: "Add context",
    addNote: "Add note",
    addDoc: "Add doc",
    notePlaceholder: "Type a note or constraint…",
    remove: "Remove",
    docListTitle: "Pick project doc",
  },
  sidebar: {
    collapse: "Hide session history",
    expand: "Show session history",
    empty: "No saved sessions yet",
    selectProject: "Pick a project first",
    loadError: "Failed to load session list",
  },
  auth: {
    loginTitle: "Sign in",
    loginSubtitle: "Pick your identity to continue.",
    usernameLabel: "Username",
    usernamePlaceholder: "e.g. hafidz",
    loginButton: "Sign in",
    loggingIn: "Working…",
    loginFailed: "Sign-in failed",
    unknownUser: "Unknown username",
    passwordNotSupported: "Password login is not supported yet",
    insecureNotice:
      "This mode has no password — anyone who can reach the server and knows your username can sign in as you. Use it on a local network only.",
    logout: "Sign out",
    loggedInAs: (label: string) => `Signed in as ${label}`,
  },
  localAgent: {
    title: "Local folder access",
    connect: "Connect local folder access",
    statusChecking: "Checking local agent…",
    statusConnected: (roots: number) => `Local agent connected (${roots} folder(s) allowed)`,
    statusUnpaired: "Local agent is running but not paired yet (token missing)",
    statusDisconnected: "No local agent detected",
    dialogTitle: "Connect local folder access",
    intro:
      "The agent runs on the server, so it cannot read files on your machine. Install the local agent to grant read access to folders you pick yourself.",
    step1Title: "1. Download & run the local agent",
    step1Body: "Download the Linux binary, then run: orchestrator-agent run",
    step2Title: "2. Allow the folders it may read",
    step2Body:
      "Run: orchestrator-agent allow /path/to/project, and orchestrator-agent allow-origin <this Orchestrator origin>",
    step3Title: "3. Paste the pairing token",
    step3Body: "Get the token with: orchestrator-agent token",
    tokenLabel: "Pairing token",
    tokenPlaceholder: "Paste the token from orchestrator-agent token",
    showToken: "Show token",
    hideToken: "Hide token",
    pair: "Pair",
    disconnect: "Disconnect",
    recheck: "Re-check",
    errorNotRunning: "The local agent is not running on this machine. Run orchestrator-agent run, then re-check.",
    errorPortConflict:
      "Ports 47821-47830 are all taken. Close whatever uses them and restart the local agent.",
    errorInvalidToken: "The local agent rejected this token. Get a fresh one with orchestrator-agent token.",
    downloadLink: "Download & install instructions",
    close: "Close",
    rootsTitle: "Allowed folders",
    rootsEmpty:
      "No folder is allow-listed yet. Run orchestrator-agent allow <folder>, then press re-check.",
    rootsError: "Could not read the folder list from the local agent.",
    rootRead: "read",
    rootWrite: "read+write",
    writeWarning:
      "The agent can create and change files in folders marked read+write. Take it back with orchestrator-agent revoke-write <folder>.",
    writeHint:
      "Write access is granted per folder: orchestrator-agent allow-write <folder>. The default is read-only.",
  },
  onboarding: {
    triggerTitle: "How to register a new project",
    dialogTitle: "Register a new project",
    tabAgent: "Local Agent",
    tabFolders: "Project folders",
    tabNotion: "Notion",
    tabGuide: ".claude/ structure",
    tabPrompt: "AI setup prompt",
    setupDocLink: "Full guide: docs/setup.md",
    platformNote:
      "The local agent is Linux x86_64 only for now. Windows and macOS are not supported yet.",
    agentSteps: [
      {
        title: "1. Install the binary",
        body: "Download or build it, put it in ~/.local/bin and make it executable.",
        code: `mkdir -p ~/.local/bin
curl -fsSL https://<orchestrator-host>/local-agent/orchestrator-agent-linux-amd64 \\
  -o ~/.local/bin/orchestrator-agent
chmod +x ~/.local/bin/orchestrator-agent`,
        note: "Building it yourself: cd local-agent && ./build.sh, then copy the file from dist/.",
      },
      {
        title: "2. Let this page talk to the agent",
        body: "Without this the browser blocks every request to the agent (CORS).",
        code: "orchestrator-agent allow-origin __ORIGIN__",
      },
      {
        title: "3. Start the agent",
        body: "Leave it running while you use Orchestrator.",
        code: "orchestrator-agent run",
        note: "The default port is 47821; if it is taken the agent walks up to 47830, and this page probes the same range.",
      },
      {
        title: "4. Start it at login (optional)",
        code: `mkdir -p ~/.config/systemd/user
cp orchestrator-agent.service ~/.config/systemd/user/
systemctl --user enable --now orchestrator-agent`,
      },
      {
        title: "5. Get the token and pair",
        body: "Paste the output into the hard-drive icon dialog in the top bar. The dot turns green once it works.",
        code: "orchestrator-agent token",
      },
    ],
    folderSteps: [
      {
        title: "1. Register a project folder",
        body: "The project list in Orchestrator comes from your machine, not from the server. A folder that is not registered here is refused with 403 — that is the intended behaviour.",
        code: 'orchestrator-agent allow ~/projects/app-x --id app-x --label "App X"',
        note: "Without --id and --label both are derived from the folder name. The id must be unique and match ^[a-z0-9][a-z0-9_-]*$.",
      },
      {
        title: "2. Grant write access if you need it",
        body: "Read-only is the default. Write access is granted per folder, and the agent can only create or change files after this.",
        code: "orchestrator-agent allow-write ~/projects/app-x",
        note: "Take it back with: orchestrator-agent revoke-write ~/projects/app-x",
      },
      {
        title: "3. Verify",
        body: "status prints the id, label, mode and path of every folder.",
        code: "orchestrator-agent status",
      },
      {
        title: "4. Every machine keeps its own list",
        body: "If you work on two computers, register the folders on each one. The project list is a property of the machine, so it does not travel with your account.",
      },
    ],
    notionSteps: [
      {
        title: "1. Create an internal integration",
        body: "Open notion.so/my-integrations, create an internal integration and copy its Internal Integration Secret.",
      },
      {
        title: "2. Share the database with that integration",
        body: "Open the target database in Notion → ⋯ menu → Connections → pick the integration. This is the step people miss most often; the symptom is Notion answering 404 (not 403) when a ticket is created.",
      },
      {
        title: "3. Put the token in a server env var",
        body: "The token lives on the server and is never shown in this UI. Never paste a token into the chat.",
        code: "NOTION_TOKEN_PERSONAL=secret_xxx",
      },
      {
        title: "4. Register the row",
        body: "In workflow/notion-accounts.md. The env column holds the NAME of the env var, not its value. The user column holds the owning user id, or stays empty for a shared account.",
        code: `| id | label | env | workspace | user |
|---|---|---|---|---|
| jarvis | Jarvis | NOTION_TOKEN_PERSONAL | Digitamaze | u_hafidz |`,
      },
      {
        title: "5. Match it to the ticket schema",
        body: "The database property layout is documented in the project's .claude/docs/NOTION_TASK_SCHEMA.md (see the .claude/ structure tab). The agent reads that file to know which fields to fill.",
      },
    ],

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
    guideStepPeopleCode: `# token lives in .claude/notion.curlrc (gitignored), NOT an env var — a
# command using $NOTION_API_KEY hits a permission prompt every time even if
# its prefix is already allow-listed, because variable expansion in Bash
# always requires separate approval. That file is one line:
#   header = "Authorization: Bearer <raw-token>"
#
# 1) query the database, page_size 100, paginate via has_more + next_cursor
curl -s -K .claude/notion.curlrc -X POST "https://api.notion.com/v1/databases/<database_id>/query" \\
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
      "If this project's agent runs directly via Claude Code (not through this orchestrator app) and queries Notion using Bash + curl itself (instead of the app's built-in query_database tool), create .claude/notion.curlrc (gitignored, one-line Authorization header — see example above) then add .claude/settings.json so query calls don't hit a permission prompt every time. The command MUST use -K .claude/notion.curlrc — do NOT pass the token via -H \"Authorization: Bearer $NOTION_API_KEY\", since any command with variable expansion ($VAR / $(...)) still requires manual approval even once its prefix is allow-listed. Scope the rule as narrowly as possible — curl to that specific database ID, not curl in general:",
    guideStepSettingsCode: `{
  "permissions": {
    "allow": [
      "Bash(curl -s -K .claude/notion.curlrc -X POST https://api.notion.com/v1/databases/<database_id>*)"
    ]
  }
}`,
    guideStepSettingsNote:
      "Commit settings.json (not settings.local.json) so the permission applies to everyone running this agent. Also commit a .gitignore entry excluding .claude/notion.curlrc — it holds the raw token, never let it get committed.",
    guideStep3: [
      'Easiest: use the "AI setup prompt" tab — copy it, paste into Claude Code (or another agent) running in your new project\'s folder. It will interview you briefly then generate all files above.',
    ],
    guideStep4Title: "If you are NOT using the local agent, add one row to ",
    guideStep4Rest:
      " in this orchestrator repo. With a local agent paired this file is not read at all — the project list comes from the Project folders tab.",
    guideStep4Code: "| <id> | <label> | <absolute project path> |",
    guideStep4Note1: "Path must be inside ",
    guideStep4Note2:
      " (see .env) in the no-agent mode, otherwise the project shows disabled in the dropdown. Once paired that limit does not apply and the local agent's allow-list decides instead.",
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

4. .claude/settings.json + .claude/notion.curlrc (only if this project's agent is also run directly via Claude Code, not only through the orchestrator app, and it queries Notion using Bash + curl)
   - Put the token in .claude/notion.curlrc (gitignored), one line: header = "Authorization: Bearer <raw-token>". Do NOT inline $NOTION_API_KEY in the curl command — a command with variable expansion still needs manual approval even once its prefix is allow-listed.
   - The curl command MUST use -K .claude/notion.curlrc, not -H "Authorization: ...".
   - Add a permissions.allow rule scoped as narrowly as possible, e.g.: {"permissions":{"allow":["Bash(curl -s -K .claude/notion.curlrc -X POST https://api.notion.com/v1/databases/<database_id>*)"]}}
   - Commit settings.json (not settings.local.json) so the permission applies for everyone, not just you. Make sure .claude/notion.curlrc is in .gitignore.

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
