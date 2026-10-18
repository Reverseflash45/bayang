/**
 * Posisi matahari dengan algoritma NOAA Solar Calculator (berbasis Meeus, "Astronomical Algorithms").
 * Ketelitian sekitar satu menit untuk waktu terbit/terbenam di lintang Indonesia.
 */

const rad = (d: number) => (d * Math.PI) / 180;
const der = (r: number) => (r * 180) / Math.PI;
const MENIT_HARI = 1440;

/** Hari Julian dari milidetik Unix (UTC). */
export const hariJulian = (ms: number) => ms / 86_400_000 + 2440587.5;

/** Deklinasi (derajat) dan persamaan waktu (menit) pada saat tertentu. */
export function matahari(ms: number): { dekl: number; pw: number } {
  const T = (hariJulian(ms) - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const dekl = der(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const pw =
    4 *
    der(
      y * Math.sin(2 * rad(L0)) -
        2 * e * Math.sin(rad(M)) +
        4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) -
        0.5 * y * y * Math.sin(4 * rad(L0)) -
        1.25 * e * e * Math.sin(2 * rad(M)),
    );
  return { dekl, pw };
}

/** Ketinggian (derajat di atas horizon, tanpa refraksi) dan azimut (derajat dari utara searah jarum jam). */
export function posisi(ms: number, lat: number, lon: number): { elevasi: number; azimut: number } {
  const { dekl, pw } = matahari(ms);
  const menitUtc = (((ms / 60_000) % MENIT_HARI) + MENIT_HARI) % MENIT_HARI;
  const waktuSurya = menitUtc + pw + 4 * lon;
  const H = rad(waktuSurya / 4 - 180);
  const φ = rad(lat);
  const δ = rad(dekl);
  const cosZ = Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(H);
  const elevasi = 90 - der(Math.acos(Math.max(-1, Math.min(1, cosZ))));
  const azimut = (der(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(φ) - Math.tan(δ) * Math.cos(φ))) + 180 + 360) % 360;
  return { elevasi, azimut };
}

/** Tengah malam waktu setempat (zona dalam jam dari UTC) sebagai milidetik Unix. */
export const tengahMalam = (tahun: number, bulan: number, hari: number, zona: number) => Date.UTC(tahun, bulan - 1, hari) - zona * 3_600_000;

export type HariSurya = {
  terbit: number; // menit sejak tengah malam waktu setempat
  tengah: number; // kulminasi (tengah hari surya)
  terbenam: number;
  dekl: number; // deklinasi saat kulminasi
};

// Matahari dianggap terbit/terbenam saat pusatnya 0,833° di bawah horizon (refraksi + jari-jari piringan).
const ZENIT_TERBIT = 90.833;

function sudutJam(lat: number, dekl: number): number {
  const φ = rad(lat);
  const δ = rad(dekl);
  return der(Math.acos(Math.cos(rad(ZENIT_TERBIT)) / (Math.cos(φ) * Math.cos(δ)) - Math.tan(φ) * Math.tan(δ)));
}

/** Saat kulminasi (menit waktu setempat) dan deklinasi matahari pada saat itu. */
export function kulminasi(tahun: number, bulan: number, hari: number, lon: number, zona: number): { tengah: number; dekl: number } {
  const t0 = tengahMalam(tahun, bulan, hari, zona);
  // Dua kali iterasi supaya persamaan waktu dihitung pada saat kulminasi itu sendiri.
  let tengah = 720 - 4 * lon + zona * 60;
  for (let i = 0; i < 2; i++) tengah = 720 - 4 * lon + zona * 60 - matahari(t0 + tengah * 60_000).pw;
  return { tengah, dekl: matahari(t0 + tengah * 60_000).dekl };
}

/** Waktu terbit, kulminasi, dan terbenam pada satu tanggal kalender setempat. */
export function hariSurya(tahun: number, bulan: number, hari: number, lat: number, lon: number, zona: number): HariSurya {
  const t0 = tengahMalam(tahun, bulan, hari, zona);
  const padaMenit = (m: number) => matahari(t0 + m * 60_000);
  const { tengah, dekl } = kulminasi(tahun, bulan, hari, lon, zona);
  const peristiwa = (arah: -1 | 1) => {
    let m = tengah + arah * 4 * sudutJam(lat, dekl);
    for (let i = 0; i < 2; i++) {
      const s = padaMenit(m);
      m = 720 - 4 * lon + zona * 60 - s.pw + arah * 4 * sudutJam(lat, s.dekl);
    }
    return m;
  };
  return { terbit: peristiwa(-1), tengah, terbenam: peristiwa(1), dekl };
}

/**
 * Panjang bayangan tengah hari untuk benda setinggi 1, bertanda: positif = bayangan ke utara
 * (matahari di selatan zenit), negatif = ke selatan.
 */
export const bayanganTengah = (lat: number, dekl: number) => Math.tan(rad(lat - dekl));

export type TanpaBayangan = { tahun: number; bulan: number; hari: number; jam: number; sudut: number };

const jumlahHari = (tahun: number) => (Date.UTC(tahun + 1, 0, 1) - Date.UTC(tahun, 0, 1)) / 86_400_000;
const tanggalKe = (tahun: number, n: number) => {
  const d = new Date(Date.UTC(tahun, 0, 1 + n));
  return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() };
};

/**
 * Deklinasi harian pukul 04.30 UTC, kira-kira tengah hari di Indonesia (11.30 WIB, 12.30 WITA, 13.30 WIT).
 * Disimpan per tahun karena dipakai bersama oleh 514 daerah.
 */
const tabelDeklinasi = new Map<number, number[]>();
function deklinasiHarian(tahun: number): number[] {
  let t = tabelDeklinasi.get(tahun);
  if (!t) {
    t = Array.from({ length: jumlahHari(tahun) + 1 }, (_, i) => matahari(Date.UTC(tahun, 0, 1 + i, 4, 30)).dekl);
    tabelDeklinasi.set(tahun, t);
  }
  return t;
}

/**
 * Hari tanpa bayangan dalam satu tahun: hari ketika deklinasi matahari saat kulminasi melewati
 * lintang setempat. Dipilih hari yang sudut zenitnya paling kecil di sekitar perpotongan itu.
 */
export function hariTanpaBayangan(tahun: number, lat: number, lon: number, zona: number): TanpaBayangan[] {
  const n = jumlahHari(tahun);
  const kasar = deklinasiHarian(tahun);
  const hasil: TanpaBayangan[] = [];
  for (let i = 0; i < n; i++) {
    if (kasar[i] - lat !== 0 && Math.sign(kasar[i] - lat) === Math.sign(kasar[i + 1] - lat)) continue;
    // Hitung teliti di sekitar perpotongan (satu hari lebih di kiri-kanan karena tabel kasar memakai
    // jam yang sama untuk seluruh Indonesia), lalu pilih hari yang sudut zenitnya paling kecil.
    let p: TanpaBayangan | null = null;
    for (let k = Math.max(0, i - 1); k <= Math.min(n, i + 2); k++) {
      const t = tanggalKe(tahun, k);
      const s = kulminasi(t.tahun, t.bulan, t.hari, lon, zona);
      const sudut = Math.abs(s.dekl - lat);
      if (!p || sudut < p.sudut) p = { ...t, jam: s.tengah, sudut };
    }
    if (p && p.tahun === tahun && !hasil.some((h) => h.bulan === p!.bulan && h.hari === p!.hari)) hasil.push(p);
  }
  return hasil;
}

/** Kejadian berikutnya mulai tanggal tertentu (termasuk hari itu), mencari sampai tahun depan. */
export function tanpaBayanganBerikutnya(dari: { tahun: number; bulan: number; hari: number }, lat: number, lon: number, zona: number): TanpaBayangan {
  const kunci = (t: { tahun: number; bulan: number; hari: number }) => t.tahun * 10000 + t.bulan * 100 + t.hari;
  for (const th of [dari.tahun, dari.tahun + 1, dari.tahun + 2]) {
    const k = hariTanpaBayangan(th, lat, lon, zona).find((t) => kunci(t) >= kunci(dari));
    if (k) return k;
  }
  throw new Error("Tidak ditemukan hari tanpa bayangan");
}

/** Selisih hari antara dua tanggal kalender. */
export const selisihHari = (a: { tahun: number; bulan: number; hari: number }, b: { tahun: number; bulan: number; hari: number }) =>
  Math.round((Date.UTC(b.tahun, b.bulan - 1, b.hari) - Date.UTC(a.tahun, a.bulan - 1, a.hari)) / 86_400_000);
