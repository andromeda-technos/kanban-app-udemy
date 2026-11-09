# 📋 KanbanFlow - Modern Kanban Task Manager

Aplikasi manajemen tugas (Kanban Task Manager) interaktif, responsif, dan kaya fitur yang dibangun menggunakan **React 19**, **TypeScript**, **Tailwind CSS v4**, dan **Vite**.

---

## ✨ Fitur Utama

1. **Multi-Board Management**: Buat, ganti, dan kelola beberapa papan proyek secara independen (misal: *Sprint E-Commerce*, *Mobile App Launch*, *Personal Todo*).
2. **Interactive Drag & Drop**:
   - Drag kartu tugas antar kolom dengan indikator posisi drop yang dinamis.
   - Reorder tugas di dalam kolom yang sama.
   - Tombol geser cepat (Quick Move) untuk perangkat layar sentuh / mobile.
3. **Kustomisasi Kolom & WIP Limit**:
   - Tambah, ubah nama, ganti warna aksen kolom, dan atur posisi kolom.
   - Dukungan **WIP (Work In Progress) Limit** dengan peringatan visual saat kapasitas tugas terlampaui.
4. **Detail Tugas Mendalam**:
   - Prioritas tugas: *Mendesak (Urgent)*, *Tinggi (High)*, *Sedang (Medium)*, dan *Rendah (Low)*.
   - Indikator Tenggat Waktu (Overdue warning warna merah, Due Today warna kuning, dsb).
   - Label/Tags kustom & preset.
   - Checklist / Subtugas dengan bilah persentase progres penyelesaian.
   - Penugasan (Assignee) dengan avatar inisial warna.
5. **Pencarian, Filter & Sorting**:
   - Pencarian instan (judul, deskripsi, tag, nama orang).
   - Filter multiselect berdasarkan prioritas, tag, penanggung jawab, dan status tanggal.
   - Pengurutan manual, berdasarkan tanggal tenggat, prioritas tertinggi, abjad, atau tanggal dibuat.
6. **Statistik & Metrik Produktivitas**: Modal analitik dengan visualisasi tingkat penyelesaian proyek, progres subtugas, dan distribusi tugas.
7. **Riwayat Aktivitas & Perayaan (Confetti)**: Log perubahan aktivitas dan animasi kembang api confetti saat tugas dipindahkan ke kolom *Done* / *Selesai*.
8. **Penyimpanan Lokal & Backup**: Auto-save ke `localStorage`, fitur ekspor/impor cadangan format `.json`, serta tombol pemulihan data contoh.
9. **Mode Gelap / Terang (Dark Mode)** dan Pintasan Keyboard (`N` untuk tugas baru, `/` untuk pencarian, `Esc` untuk menutup).

---

## 🚀 Cara Menjalankan di Komputer Lokal (Local Development)

### 1. Masuk ke direktori proyek
Buka terminal (PowerShell / Command Prompt / Git Bash) lalu arahkan ke folder:
```bash
cd "d:\Udemy Project\kanban-app-udemy"
```

### 2. Jalankan Development Server
```bash
npm run dev
```
Setelah dijalankan, Vite akan menampilkan URL lokal:
```text
  VITE v8.3.6  ready in 150 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```
Buka browser (Google Chrome, Edge, dll) dan akses: **`http://localhost:5173/`**

---

## 🛠️ Cara Build untuk Produksi

Untuk menghasilkan file statis siap produksi:
```bash
npm run build
```
File hasil kompilasi yang dioptimasi dan diminifikasi akan berada di dalam folder `dist/`.

Anda dapat menguji hasil build secara lokal dengan perintah:
```bash
npm run preview
```

---

## 🌐 Cara Deploy ke Internet (Gratis)

### Opsi 1: Vercel (Paling Direkomendasikan & Sangat Cepat)
1. Buat akun di [Vercel](https://vercel.com).
2. Hubungkan repositori GitHub Anda (`kanban-app-udemy`).
3. Vercel akan otomatis mendeteksi konfigurasi:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Klik **Deploy**. Dalam ~1 menit aplikasi Anda sudah tayang dengan URL seperti `https://kanban-app-udemy.vercel.app`.

*Atau menggunakan Vercel CLI:*
```bash
npm i -g vercel
vercel
```

---

### Opsi 2: Netlify
1. Buka [Netlify](https://www.netlify.com).
2. Pilih **"Add new site"** > **"Import an existing project"** dan pilih repositori GitHub Anda.
3. Konfigurasi build:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Klik **Deploy site**.

*Atau Drag & Drop Manual:*
Jalankan `npm run build`, lalu buka halaman Netlify Drop dan seret (drag-and-drop) folder `dist` langsung ke browser!

---

### Opsi 3: GitHub Pages
1. Pastikan di `vite.config.ts` ditambahkan properti `base` jika menggunakan repository subpath:
   ```ts
   export default defineConfig({
     base: '/kanban-app-udemy/',
     plugins: [react(), tailwindcss()],
   });
   ```
2. Pasang package `gh-pages`:
   ```bash
   npm i -D gh-pages
   ```
3. Tambahkan script di `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
4. Jalankan:
   ```bash
   npm run deploy
   ```

---

## ⌨️ Pintasan Keyboard (Shortcuts)

| Tombol | Fungsi |
| :--- | :--- |
| `N` | Buka modal untuk membuat tugas baru |
| `/` | Fokus ke kotak pencarian |
| `Esc` | Menutup modal atau drawer yang sedang aktif |
| `?` | Menampilkan panduan pintasan keyboard |
