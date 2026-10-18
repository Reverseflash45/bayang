import "@fontsource/young-serif";
import "@fontsource-variable/manrope";
import "@fontsource-variable/spline-sans-mono";
import "./gaya.css";
import {
  DAERAH,
  type Daerah,
  type Tanggal,
  berikutnyaDaerah,
  cariDaerah,
  dariUrutan,
  hariIni,
  jumlahHari,
  lat,
  namaZona,
  suryaDaerah,
  tanpaBayanganDaerah,
  teksDurasi,
  teksJam,
  teksLintang,
  teksTanggal,
  teksTanggalPendek,
  urutanHari,
  zona,
} from "./data";
import { selisihHari } from "./matahari";
import { esc, gambarJamSurya, gambarPeta, grafikBayangan, grafikDeklinasi, grafikWaktu, muatPeta, teksBacaan, warnaSkala, type Peta } from "./vis";

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

/* ---------- keadaan ---------- */
const hash = new URLSearchParams(location.hash.slice(1));
let pilihan: Daerah = DAERAH.find((d) => d.id === hash.get("daerah")) ?? DAERAH.find((d) => d.id === "kota-jakarta-pusat")!;
let peta: Peta | null = null;
type Ukuran = "awal" | "akhir" | "terbit";
let ukuran: Ukuran = "awal";
let sim: { tanggal: Tanggal; menit: number } = { tanggal: hariIni(zona(pilihan)), menit: 720 };

const tahunIni = () => hariIni(zona(pilihan)).tahun;
const kejadianTahun = (d: Daerah, tahun: number) => tanpaBayanganDaerah(d, tahun);

/* ---------- pembuka ---------- */
function gambarPembuka() {
  const z = zona(pilihan);
  const ini = hariIni(z);
  const k = berikutnyaDaerah(pilihan, ini);
  const n = selisihHari(ini, k);
  const tahunK = kejadianTahun(pilihan, k.tahun);
  $("[data-label-berikutnya]").textContent = `Berikutnya di ${pilihan.nama}`;
  $("[data-tanggal]").textContent = teksTanggal(k);
  $("[data-jam]").textContent = `pukul ${teksJam(k.jam)} ${namaZona(z)}`;
  $("[data-hitung]").textContent = n === 0 ? "hari ini!" : n === 1 ? "besok" : `${n.toLocaleString("id-ID")} hari lagi`;
  $("[data-lainnya]").innerHTML =
    `Sepanjang ${k.tahun}: <strong>${tahunK.map((t) => `${teksTanggal(t, false)} ${teksJam(t.jam)}`).join("</strong> dan <strong>")}</strong> ${namaZona(z)}. ` +
    `<span class="redup">Titik tengah wilayah ${teksLintang(lat(pilihan))}.</span>`;
  const th = ini.tahun;
  $("[data-judul-grafik]").textContent = `Panjang bayangan tengah hari di ${pilihan.nama}, ${th}`;
  grafikBayangan($("#grafik-bayangan"), pilihan, th, kejadianTahun(pilihan, th), ini);
}

/* ---------- simulasi ---------- */
const geserTanggal = $<HTMLInputElement>("#geser-tanggal");
const geserJam = $<HTMLInputElement>("#geser-jam");
let putar = 0;

function gambarSimulasi() {
  const z = zona(pilihan);
  const b = gambarJamSurya($("#jam-surya"), pilihan, sim);
  geserTanggal.max = String(jumlahHari(sim.tanggal.tahun) - 1);
  geserTanggal.value = String(urutanHari(sim.tanggal));
  geserJam.value = String(Math.round(sim.menit));
  $("[data-out-tanggal]").textContent = teksTanggal(sim.tanggal);
  $("[data-out-jam]").textContent = `${teksJam(sim.menit)} ${namaZona(z)}`;
  $("[data-nama-sim]").textContent = pilihan.nama;
  const t = teksBacaan(b);
  const s = suryaDaerah(pilihan, sim.tanggal);
  const kejadian = kejadianTahun(pilihan, sim.tanggal.tahun);
  const tanpa = kejadian.some((k) => k.bulan === sim.tanggal.bulan && k.hari === sim.tanggal.hari);
  const isi: [string, string][] = [
    ["Matahari", t.matahari],
    ["Bayangan", t.bayangan],
    ["Terbit · kulminasi · terbenam", `${teksJam(s.terbit)} · ${teksJam(s.tengah)} · ${teksJam(s.terbenam)}`],
  ];
  $("[data-bacaan]").innerHTML =
    isi.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("") +
    (tanpa ? `<p class="sorot">${teksTanggal(sim.tanggal)} adalah hari tanpa bayangan di ${esc(pilihan.nama)}. Geser jam ke ${teksJam(s.tengah)}.</p>` : "");
}

function hentikanPutar() {
  cancelAnimationFrame(putar);
  putar = 0;
  $("#putar").setAttribute("aria-pressed", "false");
  $("#putar").textContent = "▶ Putar sehari";
}

geserTanggal.addEventListener("input", () => {
  sim.tanggal = dariUrutan(sim.tanggal.tahun, Number(geserTanggal.value));
  gambarSimulasi();
});
geserJam.addEventListener("input", () => {
  hentikanPutar();
  sim.menit = Number(geserJam.value);
  gambarSimulasi();
});
$("#putar").addEventListener("click", () => {
  if (putar) return hentikanPutar();
  const s = suryaDaerah(pilihan, sim.tanggal);
  const mulai = performance.now();
  const lama = 9000;
  $("#putar").setAttribute("aria-pressed", "true");
  $("#putar").textContent = "❚❚ Berhenti";
  const langkah = (kini: number) => {
    const f = Math.min(1, (kini - mulai) / lama);
    sim.menit = s.terbit + f * (s.terbenam - s.terbit);
    gambarSimulasi();
    if (f < 1) putar = requestAnimationFrame(langkah);
    else hentikanPutar();
  };
  putar = requestAnimationFrame(langkah);
});
$("#ke-hari-ini").addEventListener("click", () => {
  hentikanPutar();
  const z = zona(pilihan);
  const sekarang = new Date(Date.now() + z * 3_600_000);
  sim = { tanggal: hariIni(z), menit: sekarang.getUTCHours() * 60 + sekarang.getUTCMinutes() };
  gambarSimulasi();
});
$("#ke-tanpa").addEventListener("click", () => {
  hentikanPutar();
  const k = berikutnyaDaerah(pilihan, hariIni(zona(pilihan)));
  sim = { tanggal: k, menit: k.jam };
  gambarSimulasi();
});

/** Awal simulasi: sekarang kalau matahari sedang di atas, selain itu saat kulminasi hari ini. */
function simAwal() {
  const z = zona(pilihan);
  const t = hariIni(z);
  const sekarang = new Date(Date.now() + z * 3_600_000);
  const menit = sekarang.getUTCHours() * 60 + sekarang.getUTCMinutes();
  const s = suryaDaerah(pilihan, t);
  sim = { tanggal: t, menit: menit > s.terbit + 20 && menit < s.terbenam - 20 ? menit : s.tengah };
}

/* ---------- peta ---------- */
function nilaiPeta(): { nilai: Map<string, number>; teks: (id: string) => string; ket: (v: number) => string } {
  const th = tahunIni();
  const nilai = new Map<string, number>();
  const rinci = new Map<string, string>();
  for (const d of DAERAH) {
    const z = namaZona(zona(d));
    if (ukuran === "terbit") {
      const s = suryaDaerah(d, hariIni(zona(d)));
      nilai.set(d.id, s.terbit);
      rinci.set(d.id, `terbit ${teksJam(s.terbit)} ${z}, terbenam ${teksJam(s.terbenam)} ${z}`);
    } else {
      const k = kejadianTahun(d, th).find((t) => (ukuran === "awal" ? t.bulan <= 6 : t.bulan > 6));
      if (!k) continue;
      nilai.set(d.id, urutanHari(k));
      rinci.set(d.id, `${teksTanggal(k, false)}, pukul ${teksJam(k.jam)} ${z}`);
    }
  }
  const nama = new Map(DAERAH.map((d) => [d.id, d] as const));
  return {
    nilai,
    teks: (id) => `<b>${esc(nama.get(id)!.nama)}</b><br>${rinci.get(id) ?? "—"}`,
    ket: (v) => (ukuran === "terbit" ? teksJam(v) : teksTanggalPendek(dariUrutan(th, Math.round(v)))),
  };
}

function gambarPetaIndonesia() {
  if (!peta) return;
  const { nilai, teks, ket } = nilaiPeta();
  const { min, maks } = gambarPeta($("#peta-indonesia"), peta, nilai, teks, pilihan.id, (id) => pilihDaerah(DAERAH.find((d) => d.id === id)!, true));
  const w = warnaSkala();
  $("[data-legenda]").innerHTML = `<span>${ket(min)}</span><i style="background:linear-gradient(90deg,${w.join(",")})"></i><span>${ket(maks)}</span>`;
  // Kalau tanggalnya sama, ambil yang lintangnya paling ujung supaya urutan selatan-utara terbaca.
  const keUtara = ukuran === "awal" ? 1 : -1;
  const kunci = (d: Daerah) => [nilai.get(d.id)!, keUtara * lat(d)] as const;
  const banding = (p: Daerah, q: Daerah) => kunci(p)[0] - kunci(q)[0] || kunci(p)[1] - kunci(q)[1];
  const ada = DAERAH.filter((d) => nilai.has(d.id));
  const a = ada.reduce((p, q) => (banding(q, p) < 0 ? q : p));
  const b = ada.reduce((p, q) => (banding(q, p) > 0 ? q : p));
  const th = tahunIni();
  const isi =
    ukuran === "awal"
      ? `Saat matahari bergerak ke utara, bayangan hilang lebih dulu di ${esc(a.nama)} (${ket(min)}), lalu menyapu Indonesia sampai ${esc(b.nama)} (${ket(maks)}). Tanggal untuk tahun ${th}.`
      : ukuran === "akhir"
        ? `Dalam perjalanan kembali ke selatan urutannya terbalik: ${esc(a.nama)} lebih dulu (${ket(min)}), ${esc(b.nama)} paling akhir (${ket(maks)}). Tanggal untuk tahun ${th}.`
        : `Hari ini matahari terbit paling awal di ${esc(a.nama)}, pukul ${ket(min)} ${namaZona(zona(a))}, dan paling siang di ${esc(b.nama)}, pukul ${ket(maks)} ${namaZona(zona(b))}. Jamnya melompat di perbatasan zona waktu; di dalam satu zona, makin ke barat makin siang matahari terbit.`;
  $("[data-pengantar-peta]").innerHTML = isi;
  $("[data-catatan-peta]").textContent = "Ketuk sebuah daerah untuk memilihnya.";
  $$<HTMLButtonElement>("[data-ukuran]").forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.ukuran === ukuran)));
}
$$<HTMLButtonElement>("[data-ukuran]").forEach((t) =>
  t.addEventListener("click", () => {
    ukuran = t.dataset.ukuran as Ukuran;
    gambarPetaIndonesia();
  }),
);

/* ---------- kenapa & terbit ---------- */
function gambarKenapa() {
  const th = tahunIni();
  grafikDeklinasi($("#grafik-deklinasi"), pilihan, th, kejadianTahun(pilihan, th));
}

function gambarTerbit() {
  const th = tahunIni();
  const z = namaZona(zona(pilihan));
  const hari = Array.from({ length: jumlahHari(th) }, (_, i) => {
    const t = dariUrutan(th, i);
    return { t, ...suryaDaerah(pilihan, t) };
  });
  const rentang = (k: "terbit" | "terbenam") => [Math.min(...hari.map((h) => h[k])), Math.max(...hari.map((h) => h[k]))] as const;
  const [t0, t1] = rentang("terbit");
  const [b0, b1] = rentang("terbenam");
  // Kedua grafik memakai rentang menit yang sama supaya kemiringannya bisa dibandingkan.
  const lebarRentang = Math.max(t1 - t0, b1 - b0) + 20;
  const pusat = (a: number, b: number): [number, number] => [(a + b) / 2 - lebarRentang / 2, (a + b) / 2 + lebarRentang / 2];
  grafikWaktu($("#grafik-terbit"), pilihan, th, "terbit", pusat(t0, t1));
  grafikWaktu($("#grafik-terbenam"), pilihan, th, "terbenam", pusat(b0, b1));
  const siang = hari.map((h) => ({ t: h.t, d: h.terbenam - h.terbit }));
  const panjang = siang.reduce((a, b) => (b.d > a.d ? b : a));
  const pendek = siang.reduce((a, b) => (b.d < a.d ? b : a));
  $("[data-pengantar-terbit]").innerHTML =
    `Di ${esc(pilihan.nama)}, matahari terbit antara pukul ${teksJam(t0)} dan ${teksJam(t1)} ${z}, dan terbenam antara ${teksJam(b0)} dan ${teksJam(b1)} ${z}. ` +
    `Siang terpanjang ${teksDurasi(panjang.d)} (${teksTanggalPendek(panjang.t)}), terpendek ${teksDurasi(pendek.d)} (${teksTanggalPendek(pendek.t)}): selisihnya hanya ${Math.round(panjang.d) - Math.round(pendek.d)} menit. ` +
    `Terbit paling pagi dan terbenam paling sore tidak jatuh pada hari yang sama, dan tidak pada hari siang terpanjang, karena orbit Bumi yang lonjong dan sumbunya yang miring membuat tengah hari surya maju-mundur sampai seperempat jam sepanjang tahun.`;
}

/* ---------- pilih daerah ---------- */
function gambarSemua() {
  gambarPembuka();
  gambarSimulasi();
  gambarPetaIndonesia();
  gambarKenapa();
  gambarTerbit();
}

function pilihDaerah(d: Daerah, gulir = false) {
  pilihan = d;
  history.replaceState(null, "", `#daerah=${d.id}`);
  tutupSaran();
  masuk.value = d.nama;
  hentikanPutar();
  simAwal();
  gambarSemua();
  if (gulir) $(".pembuka").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/* ---------- combobox ---------- */
const masuk = $<HTMLInputElement>("#daerah");
const daftarSaran = $<HTMLUListElement>("#saran");
let saran: Daerah[] = [];
let aktif = -1;

function tutupSaran() {
  daftarSaran.hidden = true;
  masuk.setAttribute("aria-expanded", "false");
  masuk.removeAttribute("aria-activedescendant");
}
function sorot() {
  $$("#saran [role=option]").forEach((li, i) => li.setAttribute("aria-selected", String(i === aktif)));
  if (aktif >= 0) masuk.setAttribute("aria-activedescendant", `saran-${aktif}`);
}
masuk.addEventListener("focus", () => masuk.select());
masuk.addEventListener("input", () => {
  saran = cariDaerah(masuk.value);
  aktif = saran.length ? 0 : -1;
  daftarSaran.innerHTML = saran.length
    ? saran.map((d, i) => `<li role="option" id="saran-${i}" data-i="${i}" aria-selected="${i === aktif}"><span>${esc(d.nama)}</span><small>${esc(d.prov)}</small></li>`).join("")
    : `<li aria-disabled="true">Tidak ada yang cocok</li>`;
  daftarSaran.hidden = !masuk.value.trim();
  masuk.setAttribute("aria-expanded", String(!daftarSaran.hidden));
  sorot();
});
masuk.addEventListener("keydown", (e) => {
  if (daftarSaran.hidden || !saran.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    aktif = (aktif + (e.key === "ArrowDown" ? 1 : -1) + saran.length) % saran.length;
    sorot();
    e.preventDefault();
  } else if (e.key === "Escape") tutupSaran();
});
masuk.addEventListener("blur", () =>
  setTimeout(() => {
    tutupSaran();
    masuk.value = pilihan.nama;
  }, 150),
);
daftarSaran.addEventListener("mousedown", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
  if (!li) return;
  e.preventDefault();
  pilihDaerah(saran[Number(li.dataset.i)]);
  masuk.blur();
});
$("#cari").addEventListener("submit", (e) => {
  e.preventDefault();
  if (aktif >= 0 && saran[aktif]) {
    pilihDaerah(saran[aktif]);
    masuk.blur();
  }
});

/* ---------- ukuran layar & tema ---------- */
let lebarTerakhir = 0;
let tunda = 0;
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width);
  if (!lebarTerakhir) {
    lebarTerakhir = w;
    return;
  }
  if (w === lebarTerakhir) return;
  lebarTerakhir = w;
  cancelAnimationFrame(tunda);
  tunda = requestAnimationFrame(gambarSemua);
}).observe(document.querySelector("main")!);
// Warna peta diambil dari variabel CSS, jadi gambar ulang saat tema sistem berganti.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", gambarPetaIndonesia);

/* ---------- mulai ---------- */
masuk.value = pilihan.nama;
simAwal();
gambarPembuka();
gambarSimulasi();
gambarKenapa();
gambarTerbit();
muatPeta()
  .then((p) => {
    peta = p;
    gambarPetaIndonesia();
  })
  .catch(() => {
    $("#peta-indonesia").innerHTML = `<p class="gagal">Peta gagal dimuat. Muat ulang halaman.</p>`;
  });

