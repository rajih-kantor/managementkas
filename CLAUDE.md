# CLAUDE.md — Website Kas Kantor

Context file untuk Claude Code / AI assistant saat lanjutkan development project ini.

---

## 📌 Project Overview

**Nama**: Kas Kantor (Website Management Uang Kas)
**Owner**: Rajih Kharissuha (QA Engineer)
**Tujuan**: Web app untuk track pemasukan & pengeluaran kas kantor + landing page transparansi publik.
**Model**: Single admin (bendahara) + public viewer (read-only via view publik).

---

## 🛠 Tech Stack

- **Framework**: Next.js 15+ (App Router) + TypeScript
- **Styling**: Tailwind CSS (dark mode, pure gray palette)
- **Database**: Supabase Postgres (project name: `kas`)
- **Auth**: Supabase Auth SSR (`@supabase/ssr`)
- **Storage**: Supabase Storage (bucket: `bukit-transaksi`, private)
- **Charts**: `recharts`
- **Icons**: `lucide-react`

**⚠️ Tidak boleh tambah library/framework baru tanpa diskusi dulu.**

---

## 🎨 Design Principles (STRICT)

- **Dark mode only**, pure gray palette (no accent color like blue/emerald)
- Primary bg: `bg-gray-950`, cards: `bg-gray-900`, borders: `border-gray-800`
- **Highlight pattern**: inverted card `bg-gray-100 text-gray-900` sebagai visual anchor
- **Typography**: `font-mono tabular-nums` untuk SEMUA nominal Rp
- **No heavy shadows**, pakai border subtle
- **Format Indonesia**:
  - Rupiah: `Rp 150.000` (separator titik)
  - Tanggal: `DD/MM/YYYY`
  - Error message: Bahasa Indonesia, clear & actionable

---

## 💬 Communication Rules (saat chat dengan AI)

- Ringkas & langsung ke poin, **max 2000 char per response**
- Confidence label untuk klaim penting: `[High/Medium/Low confidence]`
- **Explain reasoning dulu, baru code**
- **Jangan suggest fitur di luar scope** tanpa approval
- **Jangan mixing Bahasa Indonesia & English di code** (konsisten)
- Security concerns = **blocker**, jangan di-ignore
- Ask reproduction steps untuk bug reports

---

## 🗄️ Database Schema

### Tables (all with RLS enabled, admin-only via `is_admin()`)

```
public.users (id FK auth.users, nama, role enum['admin','public'], created_at)
jabatan (id, nama UNIQUE, iuran_bulanan BIGINT, created_at)
pegawai (id, nama, jabatan_id FK, user_id nullable, aktif BOOL, created_at)
kategori (id, nama, jenis enum['pemasukan','pengeluaran'], created_at, UNIQUE(nama,jenis))
transaksi (
  id, jenis enum, kategori_id FK, pegawai_id FK nullable,
  nominal BIGINT, tanggal DATE, periode DATE (always day=1),
  catatan, bukti_path, created_by FK, created_at
)
```

### Enums

- `jenis_transaksi`: `pemasukan` | `pengeluaran`
- `user_role`: `admin` | `public`

### Views Publik (grant to `anon`)

- `transaksi_publik` — transaksi tanpa field sensitif (no bukti_path, no catatan internal)
- `saldo_summary` — aggregate: total_pemasukan, total_pengeluaran, saldo

### RPC Functions

- `is_admin()` — security definer, helper RLS
- `transaksi_per_bulan(months_back INT)` — aggregate bulanan untuk chart dashboard

### Storage

- Bucket `bukit-transaksi` — PRIVATE, admin-only upload/read via signed URL (60s expiry)
- Path convention: `{transaksi_id}/bukti.{ext}`

### Indexes

- `transaksi(tanggal DESC)`, `transaksi(jenis, tanggal DESC)`
- `transaksi(pegawai_id)`, `transaksi(periode)`, `pegawai(jabatan_id)`

### ⚠️ Critical Grants (sering lupa, bikin error 42501)

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant ... (lihat decisions file)
```

---

## 📁 Project Structure

```
app/
├── (auth)/login/page.tsx
├── (public)/
│   ├── page.tsx                    [TODO: landing page]
│   └── transparansi/page.tsx       [TODO: public dashboard]
├── dashboard/
│   ├── layout.tsx                  [Auth guard + sidebar wrapper]
│   ├── page.tsx                    [Dashboard dengan real API]
│   ├── pemasukan/page.tsx          [CRUD + upload bukti]
│   ├── pengeluaran/page.tsx        [CRUD + upload bukti + filter kategori]
│   └── master/
│       ├── jabatan/page.tsx        [CRUD jabatan + iuran]
│       └── pegawai/page.tsx        [CRUD + toggle aktif]
├── layout.tsx, page.tsx, globals.css
components/
├── dashboard/sidebar.tsx           [Dark mode, lucide icons]
└── ui/                             [reusable]
lib/supabase/
├── client.ts                       [browser client]
└── server.ts                       [server client with cookies]
```

---

## ✅ Fitur Done

- [x] Auth & protected routes via middleware
- [x] Sidebar dark mode (Dashboard, Pemasukan, Pengeluaran, Jabatan, Pegawai, Reports)
- [x] Dashboard: 3 stat cards + area chart 6 bulan + donut kategori + recent 5 tx
- [x] Pemasukan CRUD + upload bukti transfer
- [x] Pengeluaran CRUD + upload bukti + catatan WAJIB (audit)
- [x] Master Jabatan CRUD
- [x] Master Pegawai CRUD + soft delete via `aktif` toggle

---

## 🎯 TODO / Backlog

### Priority Tinggi

- [ ] Landing page publik `/transparansi` — konsumsi `saldo_summary` + `transaksi_publik`
- [ ] Landing page utama `/` — hero + link ke transparansi + login
- [ ] Hapus menu "Allocation" dari sidebar (belum ada scope)
- [ ] Hapus menu "Reports" atau tentukan use case (belum jelas)

### Priority Medium

- [ ] Hapus folder `app/api/pemasukan/` (redundant, pakai direct Supabase client)
- [ ] Halaman Master Kategori CRUD
- [ ] Generate Supabase types: `supabase gen types typescript` (hilangkan `@ts-expect-error`)

### Priority Low

- [ ] Replace `alert/confirm` dengan toast library (opsional)
- [ ] Input mask untuk nominal (auto-format saat ketik)
- [ ] Fitur rekap iuran pegawai (siapa nunggak bulan X)
- [ ] Export PDF laporan bulanan
- [ ] Pagination table (kalau data >100 rows)

---

## 🔑 Key Patterns & Conventions

### Supabase Client Usage

- **Direct client call dari page** (RLS sudah proteksi, no need API routes)
- Fetch pattern: `createClient()` → `.from('table').select(...)`
- Join: `kategori:kategori_id (nama)` syntax

### Form Pattern

- `const [form, setForm] = useState({...})` dengan single object
- `<Field label="X">` component untuk konsistensi label
- `.input` class di `globals.css` untuk styling input
- Modal: overlay `bg-black/60 backdrop-blur-sm`, card `bg-gray-900 border border-gray-800`

### Upload Bukti (2-step)

1. Insert row → dapat `id`
2. Upload file ke path `{id}/bukti.{ext}` dengan `upsert: true`
3. Update row dengan `bukti_path`

### Format Helpers

```ts
const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const formatTgl = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
```

### Error Handling

- Postgres code `23505` → unique violation
- Postgres code `23503` → FK violation (bikin pesan user-friendly)
- Code `42501` → permission denied (cek grant schema)

---

## ⚠️ Known Issues / Gotchas

1. **Type join Supabase** masih pakai `@ts-expect-error` — fix: generate types
2. **`alert/confirm` native** — UX kurang, tapi konsisten untuk MVP
3. **No optimistic update** — selalu refetch after mutation (~200ms delay)
4. **Trend calculation edge case** — kalau bulan lalu = 0, trend = 0% (bukan infinity)
5. **Client-side aggregation** kategori breakdown — lambat kalau >1000 rows
6. **Admin dibuat manual** via Supabase Dashboard (no register page)

---

## 🚫 Jangan Lakukan

- ❌ Tambah library baru tanpa diskusi
- ❌ Suggest fitur di luar priorities tanpa approval
- ❌ Mixing Bahasa Indonesia & English di code
- ❌ Pakai API routes untuk CRUD biasa (direct Supabase client cukup)
- ❌ Simpan password di table (pakai Supabase Auth)
- ❌ Public bucket untuk bukti transfer (sensitif, pakai signed URL)
- ❌ Ignore security concerns (treat as blocker)
- ❌ Response > 2000 characters

---

## 📞 Context untuk AI (saat start session baru)

Kalau session baru, baca file ini + check memory:

- `/projects/01a0602c-4895-7325-929e-3686ee546a35/overview.md`
- `/projects/01a0602c-4895-7325-929e-3686ee546a35/decisions-and-learnings.md`
- `/projects/01a0602c-4895-7325-929e-3686ee546a35/index.md`

User (Rajih) prefer **critical & evidence-aware feedback**, no empty validation. Pakai confidence labels untuk klaim penting.
