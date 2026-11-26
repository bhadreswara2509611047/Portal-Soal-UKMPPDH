/* Mesin Tema Adaptif Gelap & Terang untuk Portal & Seluruh Paket Soal UKMPPDH */
(function () {
  'use strict';

  const THEME_STORAGE_KEY = 'portal_ukmppdh_theme';

  const EXAM_THEME_CSS = `
    /* ==================== DASAR KENYAMANAN BACA ==================== */
    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    body, header, main, section, article, aside, nav, footer,
    .bg-white, .bg-slate-50, .bg-slate-100, button, label, input, select, textarea {
      transition: background-color 0.2s ease, color 0.16s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    ::-webkit-scrollbar, .custom-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
    ::-webkit-scrollbar-thumb, .custom-scroll::-webkit-scrollbar-thumb { border-radius: 9999px; }

    /* ==================== MODE TERANG (SOFT DAYLIGHT) ==================== */
    html.portal-light {
      color-scheme: light;
    }
    html.portal-light,
    html.portal-light body {
      background-color: #f3f6fb !important;
      color: #1e293b !important;
    }
    html.portal-light ::-webkit-scrollbar-track,
    html.portal-light .custom-scroll::-webkit-scrollbar-track { background: #e8eef6 !important; }
    html.portal-light ::-webkit-scrollbar-thumb,
    html.portal-light .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1 !important; }
    html.portal-light ::-webkit-scrollbar-thumb:hover,
    html.portal-light .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8 !important; }

    html.portal-light header.sticky.bg-white,
    html.portal-light header.fixed.bg-white {
      background-color: rgba(255, 255, 255, 0.92) !important;
      backdrop-filter: blur(10px);
    }
    html.portal-light .shadow-sm,
    html.portal-light .shadow,
    html.portal-light .shadow-md {
      box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04) !important;
    }

    /* ==================== MODE GELAP (DEEP SLATE — RAMAH MATA) ==================== */
    html.portal-dark {
      color-scheme: dark;
      --p-bg: #0b1120;
      --p-surface: #111827;
      --p-elevated: #172033;
      --p-subtle: #1e293b;
      --p-hover: #26354d;
      --p-border: #283548;
      --p-border-strong: #3b4c66;
      --p-text: #e2e8f0;
      --p-text-sub: #cbd5e1;
      --p-text-muted: #94a3b8;
    }

    html.portal-dark,
    html.portal-dark body {
      background-color: var(--p-bg) !important;
      color: var(--p-text) !important;
    }
    html.portal-dark ::-webkit-scrollbar-track,
    html.portal-dark .custom-scroll::-webkit-scrollbar-track { background: #0f172a !important; }
    html.portal-dark ::-webkit-scrollbar-thumb,
    html.portal-dark .custom-scroll::-webkit-scrollbar-thumb { background: #334155 !important; }
    html.portal-dark ::-webkit-scrollbar-thumb:hover,
    html.portal-dark .custom-scroll::-webkit-scrollbar-thumb:hover { background: #475569 !important; }

    /* Permukaan utama & netral (menjaga bg-white/5..20 pada header gradien tetap transparan) */
    html.portal-dark .bg-white,
    html.portal-dark .bg-white\\/95,
    html.portal-dark .bg-white\\/90,
    html.portal-dark .bg-white\\/80,
    html.portal-dark .bg-white\\/70,
    html.portal-dark .bg-white\\/60 {
      background-color: var(--p-surface) !important;
    }
    html.portal-dark header.sticky.bg-white,
    html.portal-dark header.sticky.bg-white\\/95,
    html.portal-dark header.sticky.bg-white\\/90,
    html.portal-dark header.fixed.bg-white {
      background-color: rgba(15, 23, 42, 0.92) !important;
      backdrop-filter: blur(12px);
    }

    html.portal-dark .bg-slate-50,
    html.portal-dark .bg-slate-50\\/40,
    html.portal-dark .bg-slate-50\\/50,
    html.portal-dark .bg-slate-50\\/60,
    html.portal-dark .bg-slate-50\\/70,
    html.portal-dark .bg-slate-50\\/80,
    html.portal-dark .bg-gray-50,
    html.portal-dark .bg-zinc-50,
    html.portal-dark .bg-\\[\\#f8fafc\\],
    html.portal-dark .bg-\\[\\#f0f6fb\\] {
      background-color: var(--p-elevated) !important;
    }
    html.portal-dark .bg-slate-100,
    html.portal-dark .bg-slate-100\\/80,
    html.portal-dark .bg-gray-100,
    html.portal-dark .bg-zinc-100,
    html.portal-dark .bg-\\[\\#0f2942\\]\\/\\[0\\.05\\] {
      background-color: var(--p-subtle) !important;
    }
    html.portal-dark .bg-slate-200,
    html.portal-dark .bg-slate-200\\/60,
    html.portal-dark .bg-slate-200\\/70,
    html.portal-dark .bg-slate-200\\/80,
    html.portal-dark .bg-slate-300,
    html.portal-dark .bg-gray-200,
    html.portal-dark .bg-zinc-200 {
      background-color: var(--p-hover) !important;
    }

    /* Teks netral (kontras lembut tanpa silau) */
    html.portal-dark .text-black,
    html.portal-dark .text-slate-950,
    html.portal-dark .text-slate-900,
    html.portal-dark .text-slate-800,
    html.portal-dark .text-gray-900,
    html.portal-dark .text-gray-800,
    html.portal-dark .text-zinc-900,
    html.portal-dark .text-zinc-800,
    html.portal-dark .text-\\[\\#1e293b\\] {
      color: var(--p-text) !important;
    }
    html.portal-dark .text-slate-700,
    html.portal-dark .text-slate-600,
    html.portal-dark .text-gray-700,
    html.portal-dark .text-gray-600,
    html.portal-dark .text-zinc-700,
    html.portal-dark .text-zinc-600 {
      color: var(--p-text-sub) !important;
    }
    html.portal-dark .text-slate-500,
    html.portal-dark .text-slate-400,
    html.portal-dark .text-gray-500,
    html.portal-dark .text-zinc-500 {
      color: var(--p-text-muted) !important;
    }

    /* Teks gelap kustom (navy, undana, unud, ipb, vetnavy, medteal, hex gelap) */
    html.portal-dark .text-navy-950,
    html.portal-dark .text-navy-900,
    html.portal-dark .text-navy-800,
    html.portal-dark .text-navy-700,
    html.portal-dark .text-vetnavy-900,
    html.portal-dark .text-vetnavy-800,
    html.portal-dark .text-vetnavy-700,
    html.portal-dark .text-vetnavy-600,
    html.portal-dark .text-ipb-navy,
    html.portal-dark .text-ipb-royal,
    html.portal-dark .text-blue-950,
    html.portal-dark .text-blue-900,
    html.portal-dark .text-blue-800,
    html.portal-dark .text-blue-700,
    html.portal-dark .text-blue-600,
    html.portal-dark .text-sky-900,
    html.portal-dark .text-sky-800,
    html.portal-dark .text-sky-700,
    html.portal-dark .text-sky-600,
    html.portal-dark .text-\\[\\#082c4b\\],
    html.portal-dark .text-\\[\\#0f2942\\],
    html.portal-dark .text-\\[\\#0f4c81\\],
    html.portal-dark .text-\\[\\#172554\\],
    html.portal-dark .text-\\[\\#1e3a8a\\],
    html.portal-dark .text-\\[\\#1d4ed8\\],
    html.portal-dark .text-\\[\\#2563eb\\] {
      color: #93c5fd !important;
    }

    html.portal-dark .text-indigo-900,
    html.portal-dark .text-indigo-800,
    html.portal-dark .text-indigo-700,
    html.portal-dark .text-indigo-600 {
      color: #a5b4fc !important;
    }

    html.portal-dark .text-emerald-950,
    html.portal-dark .text-emerald-900,
    html.portal-dark .text-emerald-800,
    html.portal-dark .text-emerald-700,
    html.portal-dark .text-emerald-600,
    html.portal-dark .text-green-950,
    html.portal-dark .text-green-900,
    html.portal-dark .text-green-800,
    html.portal-dark .text-green-700,
    html.portal-dark .text-green-600,
    html.portal-dark .text-\\[\\#16a34a\\] {
      color: #6ee7b7 !important;
    }

    html.portal-dark .text-teal-950,
    html.portal-dark .text-teal-900,
    html.portal-dark .text-teal-800,
    html.portal-dark .text-teal-700,
    html.portal-dark .text-teal-600,
    html.portal-dark .text-medteal-700,
    html.portal-dark .text-medteal-600,
    html.portal-dark .text-vetteal-700,
    html.portal-dark .text-vet-900,
    html.portal-dark .text-vet-800,
    html.portal-dark .text-vet-700,
    html.portal-dark .text-vet-600,
    html.portal-dark .text-undana-950,
    html.portal-dark .text-undana-900,
    html.portal-dark .text-undana-800,
    html.portal-dark .text-unud-950,
    html.portal-dark .text-unud-900,
    html.portal-dark .text-unud-800,
    html.portal-dark .text-unud-700,
    html.portal-dark .text-cyan-800,
    html.portal-dark .text-cyan-700,
    html.portal-dark .text-\\[\\#093833\\],
    html.portal-dark .text-\\[\\#0f5c54\\],
    html.portal-dark .text-\\[\\#0f766e\\],
    html.portal-dark .text-\\[\\#134e4a\\],
    html.portal-dark .text-\\[\\#0d9488\\] {
      color: #5eead4 !important;
    }

    html.portal-dark .text-amber-950,
    html.portal-dark .text-amber-900,
    html.portal-dark .text-amber-800,
    html.portal-dark .text-amber-700,
    html.portal-dark .text-amber-600,
    html.portal-dark .text-gold-600,
    html.portal-dark .text-orange-800 {
      color: #fcd34d !important;
    }

    html.portal-dark .text-rose-950,
    html.portal-dark .text-rose-900,
    html.portal-dark .text-rose-800,
    html.portal-dark .text-rose-700,
    html.portal-dark .text-rose-600,
    html.portal-dark .text-red-950,
    html.portal-dark .text-red-900,
    html.portal-dark .text-red-800,
    html.portal-dark .text-red-700,
    html.portal-dark .text-red-600,
    html.portal-dark .text-\\[\\#881337\\],
    html.portal-dark .text-\\[\\#9f1239\\],
    html.portal-dark .text-\\[\\#dc2626\\] {
      color: #fda4af !important;
    }

    html.portal-dark .text-purple-800,
    html.portal-dark .text-purple-700,
    html.portal-dark .text-purple-600 {
      color: #d8b4fe !important;
    }

    /* Proteksi kontras teks gelap di atas tombol/badge kuning-emas terang */
    html.portal-dark .bg-amber-400,
    html.portal-dark .bg-amber-400 *,
    html.portal-dark .bg-gold-400,
    html.portal-dark .bg-gold-400 *,
    html.portal-dark .bg-gold-500,
    html.portal-dark .bg-gold-500 *,
    html.portal-dark .bg-ipb-gold,
    html.portal-dark .bg-ipb-gold *,
    html.portal-dark .bg-\\[\\#eab308\\],
    html.portal-dark .bg-\\[\\#eab308\\] * {
      color: #0f172a !important;
    }

    /* Latar semantik pastel (Benar, Salah, Ragu, Info, Pembahasan) */
    html.portal-dark .bg-emerald-50, html.portal-dark .bg-emerald-50\\/50, html.portal-dark .bg-emerald-50\\/60,
    html.portal-dark .bg-emerald-50\\/70, html.portal-dark .bg-emerald-50\\/80, html.portal-dark .bg-emerald-50\\/85,
    html.portal-dark .bg-emerald-50\\/90, html.portal-dark .bg-green-50, html.portal-dark .bg-green-50\\/80 {
      background-color: rgba(16, 185, 129, 0.14) !important;
    }
    html.portal-dark .bg-emerald-100, html.portal-dark .bg-emerald-200, html.portal-dark .bg-green-100 {
      background-color: rgba(16, 185, 129, 0.22) !important;
    }

    html.portal-dark .bg-teal-50, html.portal-dark .bg-teal-50\\/40, html.portal-dark .bg-teal-50\\/60,
    html.portal-dark .bg-teal-50\\/70, html.portal-dark .bg-teal-50\\/80,
    html.portal-dark .bg-medteal-50, html.portal-dark .bg-medteal-50\\/80,
    html.portal-dark .bg-vet-50, html.portal-dark .bg-vet-50\\/70,
    html.portal-dark .bg-vetteal-50, html.portal-dark .bg-unud-50, html.portal-dark .bg-unud-50\\/80,
    html.portal-dark .bg-cyan-50,
    html.portal-dark .bg-\\[\\#0f5c54\\]\\/10,
    html.portal-dark .bg-\\[\\#e6f4f1\\], html.portal-dark .bg-\\[\\#e6f4f1\\]\\/50,
    html.portal-dark .bg-\\[\\#e6f4f1\\]\\/55, html.portal-dark .bg-\\[\\#e6f4f1\\]\\/60,
    html.portal-dark .bg-\\[\\#e6f4f1\\]\\/65, html.portal-dark .bg-\\[\\#e6f4f1\\]\\/70 {
      background-color: rgba(20, 184, 166, 0.14) !important;
    }
    html.portal-dark .bg-teal-100, html.portal-dark .bg-teal-200,
    html.portal-dark .bg-vet-100, html.portal-dark .bg-vet-200,
    html.portal-dark .bg-vetteal-100, html.portal-dark .bg-unud-100 {
      background-color: rgba(20, 184, 166, 0.22) !important;
    }

    html.portal-dark .bg-blue-50, html.portal-dark .bg-blue-50\\/40, html.portal-dark .bg-blue-50\\/50,
    html.portal-dark .bg-blue-50\\/60, html.portal-dark .bg-blue-50\\/70, html.portal-dark .bg-blue-50\\/80,
    html.portal-dark .bg-sky-50, html.portal-dark .bg-sky-50\\/50, html.portal-dark .bg-sky-50\\/70, html.portal-dark .bg-sky-50\\/80,
    html.portal-dark .bg-navy-50, html.portal-dark .bg-navy-50\\/70, html.portal-dark .bg-navy-50\\/80,
    html.portal-dark .bg-vetnavy-50, html.portal-dark .bg-vetnavy-50\\/50, html.portal-dark .bg-vetnavy-50\\/70 {
      background-color: rgba(59, 130, 246, 0.14) !important;
    }
    html.portal-dark .bg-blue-100, html.portal-dark .bg-blue-200,
    html.portal-dark .bg-sky-100, html.portal-dark .bg-sky-100\\/60,
    html.portal-dark .bg-navy-100, html.portal-dark .bg-vetnavy-100 {
      background-color: rgba(59, 130, 246, 0.22) !important;
    }

    html.portal-dark .bg-indigo-50, html.portal-dark .bg-indigo-50\\/50,
    html.portal-dark .bg-indigo-50\\/70, html.portal-dark .bg-indigo-50\\/80 {
      background-color: rgba(99, 102, 241, 0.15) !important;
    }
    html.portal-dark .bg-indigo-100 {
      background-color: rgba(99, 102, 241, 0.24) !important;
    }

    html.portal-dark .bg-amber-50, html.portal-dark .bg-amber-50\\/40,
    html.portal-dark .bg-amber-50\\/60, html.portal-dark .bg-amber-50\\/70,
    html.portal-dark .bg-orange-50 {
      background-color: rgba(245, 158, 11, 0.15) !important;
    }
    html.portal-dark .bg-amber-100, html.portal-dark .bg-amber-200 {
      background-color: rgba(245, 158, 11, 0.24) !important;
    }

    html.portal-dark .bg-rose-50, html.portal-dark .bg-rose-50\\/50, html.portal-dark .bg-rose-50\\/60,
    html.portal-dark .bg-rose-50\\/70, html.portal-dark .bg-rose-50\\/80, html.portal-dark .bg-rose-50\\/85,
    html.portal-dark .bg-rose-50\\/90, html.portal-dark .bg-red-50, html.portal-dark .bg-red-50\\/60,
    html.portal-dark .bg-red-50\\/80, html.portal-dark .bg-red-50\\/90 {
      background-color: rgba(244, 63, 94, 0.15) !important;
    }
    html.portal-dark .bg-rose-100, html.portal-dark .bg-rose-200, html.portal-dark .bg-red-100 {
      background-color: rgba(244, 63, 94, 0.24) !important;
    }

    html.portal-dark .bg-purple-50 {
      background-color: rgba(168, 85, 247, 0.15) !important;
    }

    /* Border & divider */
    html.portal-dark .border-slate-100,
    html.portal-dark .border-slate-200,
    html.portal-dark .border-slate-200\\/60,
    html.portal-dark .border-slate-200\\/70,
    html.portal-dark .border-slate-200\\/80,
    html.portal-dark .border-slate-200\\/90,
    html.portal-dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]),
    html.portal-dark .divide-slate-200 > :not([hidden]) ~ :not([hidden]),
    html.portal-dark hr {
      border-color: var(--p-border) !important;
    }
    html.portal-dark .border-slate-300,
    html.portal-dark .border-slate-400 {
      border-color: var(--p-border-strong) !important;
    }
    html.portal-dark .border-emerald-100, html.portal-dark .border-emerald-200, html.portal-dark .border-emerald-200\\/80,
    html.portal-dark .border-emerald-300, html.portal-dark .border-green-200, html.portal-dark .border-green-300 {
      border-color: rgba(52, 211, 153, 0.36) !important;
    }
    html.portal-dark .border-teal-200, html.portal-dark .border-teal-200\\/60, html.portal-dark .border-teal-200\\/70,
    html.portal-dark .border-teal-200\\/80, html.portal-dark .border-teal-300, html.portal-dark .border-cyan-200,
    html.portal-dark .border-vet-200, html.portal-dark .border-vet-200\\/80,
    html.portal-dark .border-vetteal-200\\/70, html.portal-dark .border-unud-100,
    html.portal-dark .border-\\[\\#0f5c54\\]\\/15, html.portal-dark .border-\\[\\#0f5c54\\]\\/20, html.portal-dark .border-\\[\\#0f5c54\\]\\/25 {
      border-color: rgba(45, 212, 191, 0.35) !important;
    }
    html.portal-dark .border-blue-100, html.portal-dark .border-blue-200, html.portal-dark .border-sky-200,
    html.portal-dark .border-sky-200\\/50, html.portal-dark .border-sky-200\\/80, html.portal-dark .border-sky-300,
    html.portal-dark .border-indigo-200, html.portal-dark .border-navy-100, html.portal-dark .border-navy-200,
    html.portal-dark .border-navy-200\\/60, html.portal-dark .border-navy-200\\/80, html.portal-dark .border-vetnavy-100 {
      border-color: rgba(96, 165, 250, 0.36) !important;
    }
    html.portal-dark .border-amber-200, html.portal-dark .border-amber-200\\/70, html.portal-dark .border-amber-200\\/80,
    html.portal-dark .border-amber-300, html.portal-dark .border-amber-300\\/60, html.portal-dark .border-orange-200 {
      border-color: rgba(251, 191, 36, 0.4) !important;
    }
    html.portal-dark .border-rose-100, html.portal-dark .border-rose-200, html.portal-dark .border-rose-200\\/80,
    html.portal-dark .border-rose-300, html.portal-dark .border-red-200, html.portal-dark .border-red-300 {
      border-color: rgba(251, 113, 133, 0.4) !important;
    }
    html.portal-dark .border-purple-200 {
      border-color: rgba(192, 132, 252, 0.36) !important;
    }

    /* Status Hover */
    html.portal-dark .hover\\:bg-white:hover,
    html.portal-dark .hover\\:bg-white\\/80:hover,
    html.portal-dark .hover\\:bg-slate-50:hover,
    html.portal-dark .hover\\:bg-slate-50\\/50:hover,
    html.portal-dark .hover\\:bg-slate-50\\/80:hover,
    html.portal-dark .hover\\:bg-slate-50\\/90:hover,
    html.portal-dark .hover\\:bg-slate-100:hover,
    html.portal-dark .hover\\:bg-slate-100\\/70:hover,
    html.portal-dark .hover\\:bg-slate-200:hover,
    html.portal-dark .hover\\:bg-slate-300:hover {
      background-color: var(--p-hover) !important;
    }
    html.portal-dark .hover\\:bg-blue-50:hover,
    html.portal-dark .hover\\:bg-blue-50\\/30:hover,
    html.portal-dark .hover\\:bg-navy-50\\/40:hover,
    html.portal-dark .hover\\:bg-vetnavy-50:hover,
    html.portal-dark .hover\\:bg-vetnavy-50\\/40:hover,
    html.portal-dark .hover\\:bg-indigo-50\\/30:hover,
    html.portal-dark .hover\\:bg-indigo-100:hover {
      background-color: rgba(59, 130, 246, 0.22) !important;
    }
    html.portal-dark .hover\\:bg-teal-50:hover,
    html.portal-dark .hover\\:bg-teal-50\\/30:hover,
    html.portal-dark .hover\\:bg-teal-100:hover,
    html.portal-dark .hover\\:bg-emerald-50:hover,
    html.portal-dark .hover\\:bg-emerald-100:hover {
      background-color: rgba(20, 184, 166, 0.22) !important;
    }
    html.portal-dark .hover\\:bg-amber-50:hover,
    html.portal-dark .hover\\:bg-amber-100:hover,
    html.portal-dark .hover\\:bg-amber-200:hover,
    html.portal-dark .hover\\:bg-amber-200\\/60:hover {
      background-color: rgba(245, 158, 11, 0.26) !important;
    }
    html.portal-dark .hover\\:bg-rose-50:hover,
    html.portal-dark .hover\\:bg-red-100:hover {
      background-color: rgba(244, 63, 94, 0.24) !important;
    }
    html.portal-dark .hover\\:text-\\[\\#0b4640\\]:hover,
    html.portal-dark .hover\\:text-\\[\\#0d9488\\]:hover,
    html.portal-dark .hover\\:text-\\[\\#134e4a\\]:hover {
      color: #5eead4 !important;
    }

    /* Status Peer-Checked (Kartu Pilihan Paket / Opsi Radio Aktif) */
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-blue-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-blue-50\\/60,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-sky-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-navy-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-navy-50\\/70,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-\\[\\#0f2942\\]\\/\\[0\\.03\\] {
      background-color: rgba(59, 130, 246, 0.22) !important;
      border-color: #60a5fa !important;
    }
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-emerald-50\\/40,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-emerald-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-emerald-50\\/60,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-teal-50\\/40,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-teal-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-teal-50\\/60,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-medteal-50\\/70,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-unud-50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-vet-50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-vet-50\\/50,
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-vet-50\\/70 {
      background-color: rgba(20, 184, 166, 0.22) !important;
      border-color: #2dd4bf !important;
    }
    html.portal-dark .peer:checked ~ .peer-checked\\:bg-amber-50\\/50 {
      background-color: rgba(245, 158, 11, 0.22) !important;
      border-color: #fbbf24 !important;
    }

    /* Perbaikan header & banner gradien terang di Mode Gelap (Sukses 1.0, Batch 47, Batch 49) */
    html.portal-dark #setupScreen .bg-gradient-to-br,
    html.portal-dark .bg-gradient-to-br.from-vetnavy-50,
    html.portal-dark .from-vetnavy-50,
    html.portal-dark .via-white,
    html.portal-dark .to-vetteal-50,
    html.portal-dark .from-slate-50,
    html.portal-dark .to-teal-50\\/50,
    html.portal-dark [class*="from-vetnavy-50"],
    html.portal-dark [class*="via-white"],
    html.portal-dark [class*="to-vetteal-50"],
    html.portal-dark [class*="from-slate-50"][class*="to-teal-50"] {
      --tw-gradient-from: #132238 !important;
      --tw-gradient-via: #111827 !important;
      --tw-gradient-to: #0f292e !important;
      --tw-gradient-stops: #132238, #111827, #0f292e !important;
      background: linear-gradient(135deg, #132238 0%, #111827 55%, #0f292e 100%) !important;
      background-image: linear-gradient(135deg, #132238 0%, #111827 55%, #0f292e 100%) !important;
      background-color: #111827 !important;
    }
    html.portal-dark .from-amber-50,
    html.portal-dark .to-orange-50,
    html.portal-dark [class*="from-amber-50"][class*="to-orange-50"] {
      --tw-gradient-from: rgba(245, 158, 11, 0.18) !important;
      --tw-gradient-to: rgba(234, 88, 12, 0.14) !important;
      --tw-gradient-stops: rgba(245, 158, 11, 0.18), rgba(234, 88, 12, 0.14) !important;
      background: linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(234, 88, 12, 0.14)) !important;
      background-image: linear-gradient(90deg, rgba(245, 158, 11, 0.18), rgba(234, 88, 12, 0.14)) !important;
      background-color: var(--p-elevated) !important;
    }
    html.portal-dark header.from-vetnavy-900,
    html.portal-dark .from-vetnavy-900.to-vetteal-700 {
      background-image: linear-gradient(90deg, #0a1e3a 0%, #102d54 50%, #0f766e 100%) !important;
      background-color: #0a1e3a !important;
    }
    html.portal-dark .bg-vetnavy-50,
    html.portal-dark .bg-vetnavy-50\\/40,
    html.portal-dark .bg-vetnavy-50\\/50,
    html.portal-dark .bg-vetnavy-50\\/70,
    html.portal-dark .bg-vetnavy-100 {
      background-color: rgba(59, 130, 246, 0.16) !important;
    }
    html.portal-dark .bg-vetteal-50,
    html.portal-dark .bg-vetteal-100 {
      background-color: rgba(20, 184, 166, 0.16) !important;
    }
    html.portal-dark .text-vetnavy-900,
    html.portal-dark .text-vetnavy-800 {
      color: #f1f5f9 !important;
    }
    html.portal-dark .text-vetnavy-700,
    html.portal-dark .text-vetnavy-600 {
      color: #93c5fd !important;
    }
    html.portal-dark .text-vetteal-700,
    html.portal-dark .text-vetteal-600 {
      color: #5eead4 !important;
    }
    html.portal-dark .ring-offset-1 {
      --tw-ring-offset-color: #111827 !important;
    }

    /* Input, Select, Tabel, Bayangan & Gambar Klinis */
    html.portal-dark input:not([type="checkbox"]):not([type="radio"]),
    html.portal-dark select,
    html.portal-dark textarea {
      background-color: var(--p-subtle) !important;
      color: var(--p-text) !important;
      border-color: var(--p-border-strong) !important;
    }
    html.portal-dark input::placeholder,
    html.portal-dark textarea::placeholder {
      color: var(--p-text-muted) !important;
    }
    html.portal-dark table,
    html.portal-dark th,
    html.portal-dark td {
      border-color: var(--p-border) !important;
    }
    html.portal-dark thead,
    html.portal-dark th {
      background-color: var(--p-subtle) !important;
      color: var(--p-text) !important;
    }
    html.portal-dark td {
      color: var(--p-text-sub) !important;
    }
    html.portal-dark tbody tr:nth-child(even) {
      background-color: rgba(255, 255, 255, 0.02);
    }
    html.portal-dark .shadow-sm,
    html.portal-dark .shadow,
    html.portal-dark .shadow-md,
    html.portal-dark .shadow-lg,
    html.portal-dark .shadow-xl {
      box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.08) !important;
    }
    html.portal-dark img {
      filter: brightness(0.92) contrast(1.04);
      border-radius: 0.5rem;
    }

    /* Kembalikan tampilan terang bersih saat mencetak hasil (Print) */
    @media print {
      html.portal-dark, html.portal-dark body {
        background-color: #ffffff !important;
        color: #0f172a !important;
      }
      html.portal-dark .bg-white, html.portal-dark .bg-slate-50 {
        background-color: #ffffff !important;
      }
    }
  `;

  function updateAllThemeButtons(isDark) {
    document.querySelectorAll('.theme-toggle-btn, [onclick="togglePortalTheme()"]').forEach((btn) => {
      const sun = btn.querySelector('.theme-icon-sun');
      const moon = btn.querySelector('.theme-icon-moon');
      const txt = btn.querySelector('.theme-toggle-text');
      if (sun) sun.classList.toggle('hidden', !isDark);
      if (moon) moon.classList.toggle('hidden', isDark);
      if (txt) txt.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
    });
  }

  function syncExamFrameTheme(isDark) {
    ['exam-frame', 'gh-runner-frame'].forEach((id) => {
      const frame = document.getElementById(id);
      if (!frame) return;
      frame.style.filter = '';
      frame.style.backgroundColor = isDark ? '#0b1120' : '#f3f6fb';
      try {
        const doc = frame.contentDocument;
        if (!doc || !doc.head) return;

        const oldStyle = doc.getElementById('portal-injected-dark-theme');
        if (oldStyle) oldStyle.remove();

        let styleEl = doc.getElementById('portal-adaptive-exam-theme');
        if (!styleEl) {
          styleEl = doc.createElement('style');
          styleEl.id = 'portal-adaptive-exam-theme';
          styleEl.textContent = EXAM_THEME_CSS;
        }
        // Selalu tempatkan di akhir <head> agar menang atas <style> dinamis Tailwind CDN
        doc.head.appendChild(styleEl);

        if (!doc.__portalThemeObserver) {
          doc.__portalThemeObserver = new MutationObserver(() => {
            const el = doc.getElementById('portal-adaptive-exam-theme');
            if (el && doc.head.lastElementChild !== el) {
              doc.head.appendChild(el);
            }
          });
          doc.__portalThemeObserver.observe(doc.head, { childList: true });
        }

        doc.documentElement.classList.toggle('portal-dark', isDark);
        doc.documentElement.classList.toggle('dark', isDark);
        doc.documentElement.classList.toggle('portal-light', !isDark);
      } catch (e) {}
    });
  }

  window.PORTAL_EXAM_THEME_CSS = EXAM_THEME_CSS;
  window.syncThemeButtons = () => updateAllThemeButtons(document.documentElement.classList.contains('dark'));
  window.syncExamTheme = () => syncExamFrameTheme(document.documentElement.classList.contains('dark'));

  window.togglePortalTheme = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch (e) {}
    updateAllThemeButtons(isDark);
    syncExamFrameTheme(isDark);
  };

  window.addEventListener('DOMContentLoaded', () => {
    const isDark = document.documentElement.classList.contains('dark');
    updateAllThemeButtons(isDark);
  });
})();
