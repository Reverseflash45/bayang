import type { FeatureCollection, Geometry, MultiLineString } from "geojson";
import { geoMercator, geoPath } from "d3-geo";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { BULAN_PENDEK, type Daerah, type Tanggal, arahDariAzimut, dariUrutan, jumlahHari, lat, lon, teksJam, teksTanggalPendek, zona, namaZona, urutanHari } from "./data";
import { bayanganTengah, hariSurya, kulminasi, matahari, posisi, tengahMalam, type TanpaBayangan } from "./matahari";

/* ---------- umum ---------- */
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const desimal = (n: number, d = 2) => n.toFixed(d).replace(".", ",");
const rad = (d: number) => (d * Math.PI) / 180;

export function buatTip(wadah: HTMLElement) {
  const el = document.createElement("div");
  el.className = "tip";
  el.hidden = true;
  wadah.append(el);
  return {
    tampil(x: number, y: number, html: string) {
      el.innerHTML = html;
      el.hidden = false;
      const w = el.offsetWidth;
      const kiri = x + 14 + w > wadah.clientWidth ? x - 14 - w : x + 14;
      el.style.left = `${Math.max(0, kiri)}px`;
      el.style.top = `${Math.max(0, y - el.offsetHeight - 10)}px`;
    },
    sembunyi() {
      el.hidden = true;
    },
  };
}

/** Sumbu bulan: garis pada tanggal 1 tiap bulan, label di tengah bulan. */
function sumbuBulan(x: (n: number) => number, tahun: number, y0: number, y1: number, hp: boolean): string {
  let s = "";
  for (let b = 0; b < 12; b++) {
    const awal = urutanHari({ tahun, bulan: b + 1, hari: 1 });
    const akhir = b === 11 ? jumlahHari(tahun) : urutanHari({ tahun, bulan: b + 2, hari: 1 });
    s += `<line class="kisi" x1="${x(awal)}" x2="${x(awal)}" y1="${y0}" y2="${y1}"/>`;
    if (!hp || b % 2 === 0) s += `<text class="sumbu" x="${(x(awal) + x(akhir)) / 2}" y="${y1 + 16}" text-anchor="middle">${BULAN_PENDEK[b]}</text>`;
  }
  return s;
}

/* ---------- bayangan tengah hari sepanjang tahun ---------- */
type TitikTahun = { n: number; t: Tanggal; dekl: number; bayang: number; tengah: number };

export function dataTahun(d: Daerah, tahun: number): TitikTahun[] {
  return Array.from({ length: jumlahHari(tahun) }, (_, n) => {
    const t = dariUrutan(tahun, n);
    const k = kulminasi(t.tahun, t.bulan, t.hari, lon(d), zona(d));
    return { n, t, dekl: k.dekl, bayang: bayanganTengah(lat(d), k.dekl), tengah: k.tengah };
  });
}

export function grafikBayangan(wadah: HTMLElement, d: Daerah, tahun: number, kejadian: TanpaBayangan[], hariIni: Tanggal | null): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const hp = lebar < 560;
  const tinggi = hp ? 230 : 270;
  const m = { atas: 26, kanan: 12, bawah: 28, kiri: hp ? 54 : 60 };
  const data = dataTahun(d, tahun);
  const maks = Math.max(0.35, ...data.map((p) => Math.abs(p.bayang))) * 1.12;
  const x = scaleLinear().domain([0, data.length]).range([m.kiri, lebar - m.kanan]);
  const y = scaleLinear().domain([-maks, maks]).range([tinggi - m.bawah, m.atas]);
  const garis = line<TitikTahun>()
    .x((p) => x(p.n + 0.5))
    .y((p) => y(p.bayang))
    .curve(curveMonotoneX);
  const luas = area<TitikTahun>()
    .x((p) => x(p.n + 0.5))
    .y0(y(0))
    .y1((p) => y(p.bayang))
    .curve(curveMonotoneX);
  const tick = [-0.5, -0.25, 0.25, 0.5].filter((v) => Math.abs(v) < maks);
  const tanda = kejadian
    .map((k) => {
      const cx = x(urutanHari(k) + 0.5);
      return `<g class="tanda-nol"><circle cx="${cx}" cy="${y(0)}" r="7"/><circle class="inti" cx="${cx}" cy="${y(0)}" r="3"/>
        <text x="${cx}" y="${m.atas - 8}" text-anchor="middle">${teksTanggalPendek(k)}</text>
        <line x1="${cx}" x2="${cx}" y1="${m.atas - 4}" y2="${y(0) - 9}"/></g>`;
    })
    .join("");
  const ini = hariIni && hariIni.tahun === tahun ? data[urutanHari(hariIni)] : null;
  const penandaIni = ini
    ? `<g class="hari-ini"><line x1="${x(ini.n + 0.5)}" x2="${x(ini.n + 0.5)}" y1="${m.atas}" y2="${tinggi - m.bawah}"/><circle cx="${x(ini.n + 0.5)}" cy="${y(ini.bayang)}" r="4.5"/>
       <text x="${x(ini.n + 0.5) + (x(ini.n) > lebar - 80 ? -6 : 6)}" y="${tinggi - m.bawah - 6}" text-anchor="${x(ini.n) > lebar - 80 ? "end" : "start"}">hari ini</text></g>`
    : "";
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}">
    ${sumbuBulan(x, tahun, m.atas, tinggi - m.bawah, hp)}
    ${tick.map((v) => `<line class="kisi datar" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(v)}" y2="${y(v)}"/><text class="sumbu" x="${m.kiri - 8}" y="${y(v) + 4}" text-anchor="end">${desimal(Math.abs(v))}×</text>`).join("")}
    <text class="sumbu arah" x="${m.kiri - 8}" y="${m.atas + 4}" text-anchor="end">utara</text>
    <text class="sumbu arah" x="${m.kiri - 8}" y="${tinggi - m.bawah}" text-anchor="end">selatan</text>
    <path class="luas-bayang" d="${luas(data) ?? ""}"/>
    <line class="garis-nol" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(0)}" y2="${y(0)}"/>
    <path class="garis-bayang" d="${garis(data) ?? ""}"/>
    ${penandaIni}${tanda}
    <line class="silang" y1="${m.atas}" y2="${tinggi - m.bawah}" x1="-10" x2="-10"/>
    <circle class="titik-silang" r="4" cx="-10" cy="-10"/>
  </svg>`;
  wadah.setAttribute(
    "aria-label",
    `Panjang bayangan tengah hari di ${d.nama} sepanjang ${tahun}, dalam kelipatan tinggi benda. Bayangan nol pada ${kejadian.map((k) => teksTanggalPendek(k)).join(" dan ")}.`,
  );

  const svg = wadah.querySelector("svg")!;
  const silang = svg.querySelector<SVGLineElement>(".silang")!;
  const titik = svg.querySelector<SVGCircleElement>(".titik-silang")!;
  const tip = buatTip(wadah);
  svg.addEventListener("pointermove", (e) => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    const n = Math.max(0, Math.min(data.length - 1, Math.floor(x.invert(px))));
    const p = data[n];
    silang.setAttribute("x1", String(x(n + 0.5)));
    silang.setAttribute("x2", String(x(n + 0.5)));
    titik.setAttribute("cx", String(x(n + 0.5)));
    titik.setAttribute("cy", String(y(p.bayang)));
    const tinggiMatahari = 90 - Math.abs(lat(d) - p.dekl);
    const arah = Math.abs(p.bayang) < 0.005 ? "hampir tanpa bayangan" : `bayangan ${desimal(Math.abs(p.bayang))}× tinggi benda, ke ${p.bayang > 0 ? "utara" : "selatan"}`;
    tip.tampil(x(n + 0.5), y(p.bayang), `<b>${teksTanggalPendek(p.t)}</b> · ${teksJam(p.tengah)} ${namaZona(zona(d))}<br>${arah}<br><span class="redup">matahari ${desimal(tinggiMatahari, 1)}° di atas horizon</span>`);
  });
  svg.addEventListener("pointerleave", () => {
    silang.setAttribute("x1", "-10");
    silang.setAttribute("x2", "-10");
    titik.setAttribute("cx", "-10");
    tip.sembunyi();
  });
}

/* ---------- jam matahari (tampak atas) ---------- */
export type KeadaanSim = { tanggal: Tanggal; menit: number };

export function gambarJamSurya(wadah: HTMLElement, d: Daerah, k: KeadaanSim): { elevasi: number; azimut: number; panjang: number; terbit: number; terbenam: number } {
  const ukuran = Math.min(Math.max(280, wadah.clientWidth), 460);
  const R = ukuran / 2 - 30;
  const c = ukuran / 2;
  const z = zona(d);
  const t0 = tengahMalam(k.tanggal.tahun, k.tanggal.bulan, k.tanggal.hari, z);
  const s = hariSurya(k.tanggal.tahun, k.tanggal.bulan, k.tanggal.hari, lat(d), lon(d), z);
  // Jarak dari pusat sebanding dengan sudut zenit: 0 di kaki tongkat, R di horizon.
  const titikBayang = (az: number, el: number) => {
    const r = (R * (90 - Math.max(0, el))) / 90;
    const a = rad(az + 180);
    return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  const titikSurya = (az: number, el: number) => {
    const r = (R * (90 - Math.max(0, el))) / 90;
    const a = rad(az);
    return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  // Lintasan ujung bayangan dari terbit sampai terbenam.
  const lintasan: string[] = [];
  const jamBulat: string[] = [];
  for (let mnt = Math.ceil(s.terbit + 8); mnt <= s.terbenam - 8; mnt += 4) {
    const p = posisi(t0 + mnt * 60_000, lat(d), lon(d));
    if (p.elevasi < 4) continue;
    const [bx, by] = titikBayang(p.azimut, p.elevasi);
    lintasan.push(`${bx.toFixed(1)},${by.toFixed(1)}`);
  }
  for (let j = Math.ceil(s.terbit / 60); j * 60 < s.terbenam; j++) {
    const p = posisi(t0 + j * 3_600_000, lat(d), lon(d));
    if (p.elevasi < 6) continue;
    const [bx, by] = titikBayang(p.azimut, p.elevasi);
    jamBulat.push(`<circle class="jam-titik" cx="${bx}" cy="${by}" r="2.5"/><text class="jam-label" x="${bx}" y="${by - 7}" text-anchor="middle">${String(j).padStart(2, "0")}</text>`);
  }
  const p = posisi(t0 + k.menit * 60_000, lat(d), lon(d));
  const naik = p.elevasi > 0;
  const [bx, by] = titikBayang(p.azimut, p.elevasi);
  const [sx, sy] = titikSurya(p.azimut, p.elevasi);
  const cincin = [
    [1 / Math.sqrt(3), "0,58×"], // zenit 30°
    [1, "1×"], // zenit 45°
    [Math.sqrt(3), "1,7×"], // zenit 60°
  ] as const;
  const mataAngin = ["U", "T", "S", "B"]
    .map((h, i) => {
      const a = rad(i * 90);
      return `<text class="mata-angin" x="${c + (R + 16) * Math.sin(a)}" y="${c - (R + 16) * Math.cos(a) + 5}" text-anchor="middle">${h}</text>`;
    })
    .join("");
  const garisDerajat = Array.from({ length: 24 }, (_, i) => {
    const a = rad(i * 15);
    const r0 = i % 6 === 0 ? R - 10 : R - 5;
    return `<line class="derajat" x1="${c + r0 * Math.sin(a)}" y1="${c - r0 * Math.cos(a)}" x2="${c + R * Math.sin(a)}" y2="${c - R * Math.cos(a)}"/>`;
  }).join("");
  wadah.innerHTML = `<svg viewBox="0 0 ${ukuran} ${ukuran}" width="${ukuran}" height="${ukuran}" role="img" aria-label="Jam matahari tampak atas: arah dan panjang bayangan tongkat">
    <circle class="tanah" cx="${c}" cy="${c}" r="${R}"/>
    ${cincin.map(([L, t]) => { const r = (R * (Math.atan(L) * 180) / Math.PI) / 90; return `<circle class="cincin" cx="${c}" cy="${c}" r="${r}"/><text class="cincin-label" x="${c + 4}" y="${c - r + 12}">${t}</text>`; }).join("")}
    ${garisDerajat}${mataAngin}
    <polyline class="lintasan" points="${lintasan.join(" ")}"/>
    ${jamBulat.join("")}
    ${naik ? `<g class="surya"><circle cx="${sx}" cy="${sy}" r="11"/><circle class="sinar" cx="${sx}" cy="${sy}" r="17"/></g>` : ""}
    ${naik ? `<line class="bayang" x1="${c}" y1="${c}" x2="${bx}" y2="${by}"/><circle class="ujung" cx="${bx}" cy="${by}" r="3.5"/>` : ""}
    <circle class="tongkat" cx="${c}" cy="${c}" r="5"/>
  </svg>`;
  const panjang = naik ? 1 / Math.tan(rad(Math.max(0.01, p.elevasi))) : Infinity;
  return { ...p, panjang, terbit: s.terbit, terbenam: s.terbenam };
}

export const teksBacaan = (b: { elevasi: number; azimut: number; panjang: number }) =>
  b.elevasi <= 0
    ? { matahari: "di bawah horizon", bayangan: "tidak ada matahari" }
    : {
        matahari: `${desimal(b.elevasi, 1)}° di atas horizon, arah ${arahDariAzimut(b.azimut)}`,
        bayangan: b.panjang < 0.02 ? "hampir tidak ada" : `${b.panjang > 20 ? "lebih dari 20" : desimal(b.panjang)}× tinggi benda, ke ${arahDariAzimut(b.azimut + 180)}`,
      };

/* ---------- peta ---------- */
type Prop = { id: string };
export type Peta = { darat: FeatureCollection<Geometry, Prop>; batas: MultiLineString };

export async function muatPeta(): Promise<Peta> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/peta.json`);
  const topo = (await r.json()) as Topology<{ daerah: GeometryCollection<Prop> }>;
  return {
    darat: feature(topo, topo.objects.daerah) as FeatureCollection<Geometry, Prop>,
    batas: mesh(topo, topo.objects.daerah, (a, b) => a !== b) as MultiLineString,
  };
}

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const warnaSkala = () => ["--skala-1", "--skala-2", "--skala-3", "--skala-4"].map(cssVar);

export function gambarPeta(
  wadah: HTMLElement,
  peta: Peta,
  nilai: Map<string, number>,
  teks: (id: string) => string,
  terpilih: string,
  pilih: (id: string) => void,
): { min: number; maks: number } {
  const lebar = Math.max(300, wadah.clientWidth);
  const tepi = lebar < 560 ? 8 : 16;
  const proyeksi = geoMercator().fitWidth(lebar - 2 * tepi, peta.darat);
  const [[x0, y0], [, y1]] = geoPath(proyeksi).bounds(peta.darat);
  const [tx, ty] = proyeksi.translate();
  proyeksi.translate([tx - x0 + tepi, ty - y0 + tepi]);
  const tinggi = Math.ceil(y1 - y0 + 2 * tepi);
  const jalur = geoPath(proyeksi);
  const angka = [...nilai.values()];
  const min = Math.min(...angka);
  const maks = Math.max(...angka);
  const warna = warnaSkala();
  const skala = scaleLinear<string>()
    .domain([0, 1 / 3, 2 / 3, 1].map((f) => min + f * (maks - min)))
    .range(warna);
  const pilihan = peta.darat.features.find((f) => f.properties.id === terpilih);
  // Kota kecil hampir tak terlihat di peta nasional, jadi beri titik di pusat wilayahnya.
  const pusat = pilihan ? jalur.centroid(pilihan) : null;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}">
    <g>${peta.darat.features.map((f) => `<path class="wilayah" data-id="${f.properties.id}" d="${jalur(f) ?? ""}" fill="${nilai.has(f.properties.id) ? skala(nilai.get(f.properties.id)!) : "var(--darat)"}"/>`).join("")}</g>
    <path class="batas" d="${jalur(peta.batas) ?? ""}"/>
    ${pilihan ? `<path class="terpilih" d="${jalur(pilihan) ?? ""}"/>` : ""}
    ${pusat ? `<circle class="penanda" cx="${pusat[0]}" cy="${pusat[1]}" r="5"/>` : ""}
  </svg>`;
  const svg = wadah.querySelector("svg")!;
  const tip = buatTip(wadah);
  svg.addEventListener("pointermove", (e) => {
    const el = (e.target as Element).closest<SVGPathElement>("path.wilayah");
    if (!el) return tip.sembunyi();
    const kotak = svg.getBoundingClientRect();
    tip.tampil(e.clientX - kotak.left, e.clientY - kotak.top, teks(el.dataset.id!));
  });
  svg.addEventListener("pointerleave", () => tip.sembunyi());
  svg.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<SVGPathElement>("path.wilayah");
    if (el) pilih(el.dataset.id!);
  });
  return { min, maks };
}

/* ---------- deklinasi matahari vs lintang Indonesia ---------- */
export function grafikDeklinasi(wadah: HTMLElement, d: Daerah, tahun: number, kejadian: TanpaBayangan[]): void {
  const lebar = Math.max(300, wadah.clientWidth);
  const hp = lebar < 560;
  const tinggi = hp ? 260 : 300;
  const m = { atas: 14, kanan: hp ? 12 : 150, bawah: 28, kiri: 64 };
  const n = jumlahHari(tahun);
  const data = Array.from({ length: n }, (_, i) => ({ i, dekl: matahari(Date.UTC(tahun, 0, 1 + i, 4, 30)).dekl }));
  const x = scaleLinear().domain([0, n]).range([m.kiri, lebar - m.kanan]);
  const y = scaleLinear().domain([-26, 26]).range([tinggi - m.bawah, m.atas]);
  const garis = line<{ i: number; dekl: number }>()
    .x((p) => x(p.i + 0.5))
    .y((p) => y(p.dekl))
    .curve(curveMonotoneX);
  const l = lat(d);
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}">
    <rect class="pita-indonesia" x="${m.kiri}" width="${lebar - m.kanan - m.kiri}" y="${y(6)}" height="${y(-11) - y(6)}"/>
    ${sumbuBulan(x, tahun, m.atas, tinggi - m.bawah, hp)}
    ${[-23.44, 0, 23.44].map((v) => `<line class="kisi datar${v === 0 ? " khatulistiwa" : ""}" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(v)}" y2="${y(v)}"/><text class="sumbu" x="${m.kiri - 8}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? "0°" : `${desimal(Math.abs(v), 1)}° ${v > 0 ? "LU" : "LS"}`}</text>`).join("")}
    ${hp ? "" : `<text class="label-pita" x="${lebar - m.kanan + 10}" y="${y(6) + 14}">Indonesia</text><text class="label-pita kecil" x="${lebar - m.kanan + 10}" y="${y(6) + 29}">11° LS – 6° LU</text>`}
    <line class="garis-lintang" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(l)}" y2="${y(l)}"/>
    <path class="garis-deklinasi" d="${garis(data) ?? ""}"/>
    ${kejadian.map((k) => `<circle class="potong" cx="${x(urutanHari(k) + 0.5)}" cy="${y(l)}" r="5"/>`).join("")}
    <text class="label-lintang" x="${hp ? lebar - m.kanan - 4 : lebar - m.kanan + 10}" y="${hp ? y(l) - 6 : Math.max(y(l) + 4, y(6) + 48)}" text-anchor="${hp ? "end" : "start"}">${esc(d.nama)}</text>
  </svg>`;
  wadah.setAttribute("aria-label", `Deklinasi matahari sepanjang ${tahun} dibandingkan lintang ${d.nama}; kedua garis berpotongan pada ${kejadian.map((k) => teksTanggalPendek(k)).join(" dan ")}.`);
}

/* ---------- terbit & terbenam ---------- */
export function grafikWaktu(wadah: HTMLElement, d: Daerah, tahun: number, jenis: "terbit" | "terbenam", rentang: [number, number]): void {
  const lebar = Math.max(260, wadah.clientWidth);
  const hp = lebar < 400;
  const tinggi = 200;
  const m = { atas: 18, kanan: 10, bawah: 28, kiri: 46 };
  const z = zona(d);
  const n = jumlahHari(tahun);
  const data = Array.from({ length: n }, (_, i) => {
    const t = dariUrutan(tahun, i);
    return { i, t, v: hariSurya(t.tahun, t.bulan, t.hari, lat(d), lon(d), z)[jenis] };
  });
  const x = scaleLinear().domain([0, n]).range([m.kiri, lebar - m.kanan]);
  const y = scaleLinear().domain(rentang).range([tinggi - m.bawah, m.atas]);
  const garis = line<{ i: number; v: number }>()
    .x((p) => x(p.i + 0.5))
    .y((p) => y(p.v));
  const tick: number[] = [];
  for (let v = Math.ceil(rentang[0] / 15) * 15; v <= rentang[1]; v += 15) tick.push(v);
  const awal = data.reduce((a, b) => (b.v < a.v ? b : a));
  const akhir = data.reduce((a, b) => (b.v > a.v ? b : a));
  const label = (p: (typeof data)[number], atas: boolean) =>
    `<circle class="ekstrem" cx="${x(p.i + 0.5)}" cy="${y(p.v)}" r="3.5"/><text class="label-ekstrem" x="${Math.min(lebar - 60, Math.max(m.kiri + 30, x(p.i + 0.5)))}" y="${y(p.v) + (atas ? -9 : 17)}" text-anchor="middle">${teksJam(p.v)}</text>`;
  wadah.innerHTML = `<svg viewBox="0 0 ${lebar} ${tinggi}" width="${lebar}" height="${tinggi}">
    ${sumbuBulan(x, tahun, m.atas, tinggi - m.bawah, hp)}
    ${tick.map((v) => `<line class="kisi datar" x1="${m.kiri}" x2="${lebar - m.kanan}" y1="${y(v)}" y2="${y(v)}"/><text class="sumbu" x="${m.kiri - 8}" y="${y(v) + 4}" text-anchor="end">${teksJam(v)}</text>`).join("")}
    <path class="garis-waktu" d="${garis(data) ?? ""}"/>
    ${label(awal, false)}${label(akhir, true)}
    <line class="silang" y1="${m.atas}" y2="${tinggi - m.bawah}" x1="-10" x2="-10"/>
  </svg>`;
  wadah.setAttribute("aria-label", `Jam matahari ${jenis} di ${d.nama} sepanjang ${tahun}: paling awal ${teksJam(awal.v)} (${teksTanggalPendek(awal.t)}), paling akhir ${teksJam(akhir.v)} (${teksTanggalPendek(akhir.t)}) ${namaZona(z)}.`);
  const svg = wadah.querySelector("svg")!;
  const silang = svg.querySelector<SVGLineElement>(".silang")!;
  const tip = buatTip(wadah);
  svg.addEventListener("pointermove", (e) => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    const p = data[Math.max(0, Math.min(n - 1, Math.floor(x.invert(px))))];
    silang.setAttribute("x1", String(x(p.i + 0.5)));
    silang.setAttribute("x2", String(x(p.i + 0.5)));
    tip.tampil(x(p.i + 0.5), y(p.v), `<b>${teksJam(p.v)}</b> ${namaZona(z)}<br><span class="redup">${teksTanggalPendek(p.t)}</span>`);
  });
  svg.addEventListener("pointerleave", () => {
    silang.setAttribute("x1", "-10");
    silang.setAttribute("x2", "-10");
    tip.sembunyi();
  });
}
