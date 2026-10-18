import dataDaerah from "./data/daerah.json";
import { type HariSurya, type TanpaBayangan, hariSurya, hariTanpaBayangan, tanpaBayanganBerikutnya } from "./matahari";

export type Daerah = (typeof dataDaerah.daerah)[number];
export const DAERAH: readonly Daerah[] = dataDaerah.daerah;

/* ---------- zona waktu ---------- */
const WITA = new Set([
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Gorontalo",
  "Sulawesi Tengah",
  "Sulawesi Barat",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
]);
const WIT = new Set(["Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan", "Papua Selatan"]);

/** Selisih jam dari UTC menurut provinsi. */
export const zona = (d: Daerah) => (WIT.has(d.prov) ? 9 : WITA.has(d.prov) ? 8 : 7);
export const namaZona = (z: number) => (z === 9 ? "WIT" : z === 8 ? "WITA" : "WIB");

export const lat = (d: Daerah) => d.titik[1];
export const lon = (d: Daerah) => d.titik[0];

/* ---------- tanggal ---------- */
export type Tanggal = { tahun: number; bulan: number; hari: number };

/** Tanggal hari ini di zona tertentu. */
export function hariIni(z: number, ms = Date.now()): Tanggal {
  const d = new Date(ms + z * 3_600_000);
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
}

/** Tanggal dari nomor hari dalam tahun (0 = 1 Januari). */
export function dariUrutan(tahun: number, n: number): Tanggal {
  const d = new Date(Date.UTC(tahun, 0, 1 + n));
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
}
export const urutanHari = (t: Tanggal) => Math.round((Date.UTC(t.tahun, t.bulan - 1, t.hari) - Date.UTC(t.tahun, 0, 1)) / 86_400_000);
export const jumlahHari = (tahun: number) => (Date.UTC(tahun + 1, 0, 1) - Date.UTC(tahun, 0, 1)) / 86_400_000;

/* ---------- perhitungan per daerah ---------- */
export const suryaDaerah = (d: Daerah, t: Tanggal): HariSurya => hariSurya(t.tahun, t.bulan, t.hari, lat(d), lon(d), zona(d));
export const tanpaBayanganDaerah = (d: Daerah, tahun: number): TanpaBayangan[] => hariTanpaBayangan(tahun, lat(d), lon(d), zona(d));
export const berikutnyaDaerah = (d: Daerah, dari: Tanggal): TanpaBayangan => tanpaBayanganBerikutnya(dari, lat(d), lon(d), zona(d));

/* ---------- teks ---------- */
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const teksTanggal = (t: Tanggal, tahun = true) => `${t.hari} ${BULAN[t.bulan - 1]}${tahun ? ` ${t.tahun}` : ""}`;
export const teksTanggalPendek = (t: Tanggal) => `${t.hari} ${BULAN_PENDEK[t.bulan - 1]}`;

/** Menit sejak tengah malam → "11.52" (pembulatan ke menit terdekat). */
export function teksJam(menit: number): string {
  const m = Math.round(menit);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;
}
/** Durasi dalam menit → "12 jam 7 menit". */
export function teksDurasi(menit: number): string {
  const m = Math.round(menit);
  return `${Math.floor(m / 60)} jam ${m % 60} menit`;
}
export const teksLintang = (l: number) => `${Math.abs(l).toFixed(2).replace(".", ",")}° ${l < 0 ? "LS" : "LU"}`;

export const ARAH = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
export const arahDariAzimut = (az: number) => ARAH[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/* ---------- cari ---------- */
export const normal = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(kabupaten|kab\.?|kota)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function cariDaerah(q: string, batas = 8): Daerah[] {
  const k = normal(q);
  if (!k) return [];
  const nilai = (d: Daerah) => {
    const n = normal(d.nama);
    return n === k ? 0 : n.startsWith(k) ? 1 : n.includes(k) ? 2 : normal(d.prov).includes(k) ? 3 : 9;
  };
  return DAERAH.map((d) => [d, nilai(d)] as const)
    .filter(([, v]) => v < 9)
    .sort((a, b) => a[1] - b[1] || a[0].nama.localeCompare(b[0].nama))
    .slice(0, batas)
    .map(([d]) => d);
}
