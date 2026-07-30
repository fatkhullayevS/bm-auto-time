# BM Auto Time

O‘quv markazi (avtomaktab / kurs) uchun **boshqaruv va to‘lovlar tizimi**.  
Frontend: **React + Vite + Tailwind**. Backend / DB / Auth: **Supabase**.

---

## Vazifa nima?

BM Auto Time — o‘quvchilar, guruhlar, ma’sullar (agentlar), to‘lovlar va hisobotlarni bitta panelda boshqarish uchun admin panel.

Asosiy ishlar:
- O‘quvchilarni qo‘shish / ko‘rish / o‘chirish
- Guruhlarni boshqarish
- Ma’sullar (agentlar) bilan ishlash
- **Ma’sullar uchun alohida login** (Supabase Auth emas — custom Edge Function)
- To‘lov qabul qilish va tarixini saqlash
- Qarz / tushum hisobotlari
- Ma’sullar bo‘yicha to‘lov hisobotlari
- Arxiv (guruh + o‘quvchilarni o‘chirish)
- Admin / rollar boshqaruvi (faqat boss)

---

## Stack

| Qism | Texnologiya |
|------|-------------|
| UI | React 19 |
| Build | Vite 8 |
| Routing (ichki) | state asosida sahifa almashtirish (`Dashboard.jsx`) |
| Styling | Tailwind + inline styles |
| Auth | Supabase Auth (xodimlar) + custom JWT (ma’sullar) |
| Database | Supabase (PostgreSQL) |
| Server logic | Supabase Edge Functions (Deno) |
| Client | `@supabase/supabase-js` |

---

## Ishga tushirish

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

### Environment

`.env` faylida:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Client: `src/lib/supabase.js`

---

## Rollar

`profiles.role` bo‘yicha:

| Role | Ma’nosi | Huquq |
|------|---------|--------|
| `boss` | Rahbar | To‘liq: arxiv, adminlar, summalarni parol bilan ochish, o‘chirish |
| `kassir` / boshqa | Oddiy xodim | Asosiy CRUD (boss-only sahifalarsiz) |
| `viewer` | Kuzatuvchi | Ko‘rish (UI da "Kuzatuvchi") |
| *(agent session)* | Ma’sul | Faqat o‘z o‘quvchilari + to‘lov (custom login) |

Boss-only sahifalar:
- **Arxiv**
- **Adminlar**

Ma’sullarni yaratish / parol berish: **boss** va **kassir** (`Agents.jsx`).

Moliyaviy summalar (dashboard / hisobotlar) boss uchun `view_password` bilan himoyalangan.

O‘chirish amallari `delete_password` bilan himoyalangan (`src/lib/checkPassword.js`).

---

## Sahifalar (funksiyalar)

| Sahifa | Fayl | Nima qiladi |
|--------|------|-------------|
| Login | `src/pages/Login.jsx` | Supabase email/password login |
| Dashboard | `src/pages/DashboardHome.jsx` | Statistika: o‘quvchilar, guruhlar, tushum, qarz, so‘nggi to‘lovlar |
| O‘quvchilar | `src/pages/Students.jsx` | Ro‘yxat, qo‘shish, o‘chirish; guruh/agent bog‘lash |
| O‘quvchi detal | `src/pages/StudentDetail.jsx` | Bitta o‘quvchi + to‘lovlari |
| Guruhlar | `src/pages/Groups.jsx` | Guruh CRUD + o‘quvchilar soni |
| Ma’sullar | `src/pages/Agents.jsx` | Agent CRUD |
| To‘lovlar | `src/pages/Payments.jsx` | To‘lov qo‘shish / o‘chirish |
| Hisobotlar | `src/pages/Reports.jsx` | To‘lov va qarz hisobotlari |
| Ma’sullar hisoboti | `src/pages/AgentReports.jsx` | Agent bo‘yicha to‘lov loglari |
| Qidiruv | `src/pages/Search.jsx` | O‘quvchi qidirish |
| Arxiv | `src/pages/Archive.jsx` | Guruh + bog‘langan o‘quvchi/to‘lovlarni o‘chirish (boss) |
| Adminlar | `src/pages/Admins.jsx` | `profiles` boshqaruvi (boss) |
| O‘qituvchilar | `src/pages/Teachers.jsx` | Teachers CRUD (hozir asosiy navigatsiyada yo‘q, kod mavjud) |

Layout / navigatsiya: `src/components/Layout.jsx`  
App auth gate: `src/App.jsx` → session bo‘lsa `Dashboard`, bo‘lmasa `Login`.

---

## Loyiha strukturasi

```
bm-auto-time/
├── .env                      # Supabase URL + anon key
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
└── src/
    ├── main.jsx              # React entry
    ├── App.jsx               # Auth session → Login | Dashboard
    ├── index.css / App.css
    ├── lib/
    │   ├── supabase.js       # Supabase client
    │   └── checkPassword.js  # delete_password tekshiruv
    ├── components/
    │   └── Layout.jsx        # Sidebar, header, "+ To'lov" tugma
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx     # Sahifa router (state)
    │   ├── DashboardHome.jsx
    │   ├── Students.jsx
    │   ├── StudentDetail.jsx
    │   ├── Groups.jsx
    │   ├── Agents.jsx
    │   ├── Payments.jsx
    │   ├── Reports.jsx
    │   ├── AgentReports.jsx
    │   ├── Search.jsx
    │   ├── Archive.jsx
    │   ├── Admins.jsx
    │   └── Teachers.jsx
    └── assets/
```

---

## Supabase jadvallar (koddan ko‘rinadigan schema)

| Jadval | Maqsad | Asosiy maydonlar (ishlatiladi) |
|--------|--------|--------------------------------|
| `profiles` | Foydalanuvchi profili / rol | `id`, `full_name`, `role`, `created_at` |
| `students` | O‘quvchilar | `id`, `full_name`, `course_price`, `group_id`, `agent_id`, `created_at` |
| `groups` | Guruhlar | `id`, `name`, `status` (`active` va boshqalar) |
| `agents` | Ma’sullar | `id`, `full_name`, `phone`, `login`, `password_hash`, `is_active` |
| `teachers` | O‘qituvchilar | `id`, ... |
| `payments` | To‘lovlar | `id`, `student_id`, `amount`, `paid_at`, `method`, kim qo‘shgani (`profiles`) |
| `agent_payments_log` | Agent to‘lov logi | `id`, `payment_id`, agent bog‘lanishi |
| `settings` | Sozlamalar (key-value) | `key`, `value` |

### `settings` kalitlari

| key | Nima uchun |
|-----|------------|
| `view_password` | Moliyaviy summalarni ochish |
| `delete_password` | O‘chirish amallarini tasdiqlash |
| `course_price` | Default kurs narxi (o‘quvchi qo‘shishda) |

### Relatsiyalar (taxminiy)

```
groups 1───* students
agents 1───* students
students 1───* payments
payments ─── profiles (kim kiritgan)
agent_payments_log ─── payments / agents
auth.users 1───1 profiles (id)
```

---

## Ma'sul (Agent) custom auth

Ma’sullar `auth.users` / `profiles` da emas — `agents` jadvalida. Login alohida.

### Deploy

Batafsil: [`supabase/AGENT_AUTH.md`](supabase/AGENT_AUTH.md)

Qisqa:
1. SQL migration: `supabase/migrations/20260730120000_agent_auth.sql`
2. Secret: `npx supabase secrets set AGENT_JWT_SECRET="..."`
3. Deploy: `npx supabase functions deploy`

### Edge Functions

| Function | Vazifa |
|----------|--------|
| `agent-login` | login+parol → JWT (`localStorage.agent_session`) |
| `agent-set-password` | boss/kassir parol o‘rnatadi (bcrypt) |
| `agent-get-students` | faqat shu agentning o‘quvchilari |
| `agent-add-payment` | faqat o‘z o‘quvchisiga to‘lov |

### Frontend fayllar

- `src/lib/agentSession.js` — localStorage session
- `src/lib/agentApi.js` — Edge Function chaqiriqlari
- `src/pages/AgentDashboard.jsx` / `AgentStudents.jsx` — cheklangan panel
- `src/components/AgentLayout.jsx` — sodda sidebar
- `Login.jsx` — **Xodim** / **Ma'sul** tablar

---

## Auth oqimi

1. `App.jsx` — `supabase.auth.getSession()` + `localStorage.agent_session`
2. Staff session → `Dashboard` (to‘liq)
3. Agent session → `AgentDashboard` (faqat o‘quvchilarim)
4. Hech qanday session → `Login` (Xodim | Ma'sul)
5. Chiqish → `signOut()` yoki `clearAgentSession()`

---

## Muhim UI xususiyatlar

- Til: **O‘zbekcha**
- Brand: **BM Auto Time** (qizil `#DC2626` + dark sidebar `#1A1D2E`)
- Fontlar: Manrope / Nunito
- Headerda tezkor **"+ To'lov"** → Payments sahifasiga o‘tib modal ochadi
- Mobile: hamburger sidebar
- Summalar format: `uz-UZ` + `so'm`

---

## Claude / AI uchun qisqa kontekst

Bu loyiha **o‘quv markazi CRM + billing admin paneli**.  
React SPA, backend yo‘q — hammasi **Supabase** orqali.  
Sahifalar React Router emas, `Dashboard.jsx` ichidagi `currentPage` state bilan almashtiriladi.  
Huquqlar `profiles.role` (`boss` max huquq).  
Sezgir amallar `settings` dagi `view_password` / `delete_password` bilan himoyalangan.  
O‘zgartirish qilganda: mavjud stil (inline + Tailwind), o‘zbek UI matnlari va Supabase jadval nomlarini saqlash kerak.

---

## Skriptlar

| Buyruq | Vazifa |
|--------|--------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run preview` | Buildni ko‘rish |
| `npm run lint` | ESLint |

---

## Eslatma

`.env` dagi kalitlarni GitHub’ga commit qilmang. Anon key public bo‘lishi mumkin, lekin Supabase RLS (Row Level Security) to‘g‘ri sozlangan bo‘lishi shart.
