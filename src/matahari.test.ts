import { describe, expect, it } from "vitest";
import { bayanganTengah, hariSurya, hariTanpaBayangan, matahari, posisi, selisihHari, tanpaBayanganBerikutnya, tengahMalam } from "./matahari";

const JAKARTA = { lat: -6.1754, lon: 106.8272, zona: 7 }; // Monas
const PONTIANAK = { lat: -0.0251, lon: 109.3311, zona: 7 };

describe("posisi matahari", () => {
  it("persamaan waktu sesuai nilai almanak (±0,5 menit)", () => {
    // Nilai rujukan: sekitar +16,4 menit awal November, sekitar −14,2 menit pertengahan Februari.
    expect(matahari(Date.UTC(2026, 10, 3, 12)).pw).toBeCloseTo(16.4, 0);
    expect(matahari(Date.UTC(2026, 1, 11, 12)).pw).toBeCloseTo(-14.2, 0);
  });

  it("deklinasi pada titik balik dan ekuinoks", () => {
    expect(matahari(Date.UTC(2026, 5, 21, 12)).dekl).toBeCloseTo(23.44, 1);
    expect(matahari(Date.UTC(2026, 11, 21, 12)).dekl).toBeCloseTo(-23.44, 1);
    expect(Math.abs(matahari(Date.UTC(2026, 2, 20, 15)).dekl)).toBeLessThan(0.1);
  });

  it("matahari di Jakarta saat kulminasi tinggi di langit dan di utara pada bulan Juni", () => {
    const s = hariSurya(2026, 6, 21, JAKARTA.lat, JAKARTA.lon, JAKARTA.zona);
    const p = posisi(tengahMalam(2026, 6, 21, 7) + s.tengah * 60_000, JAKARTA.lat, JAKARTA.lon);
    expect(p.elevasi).toBeCloseTo(90 - (23.44 + 6.1754), 0);
    expect(p.azimut < 2 || p.azimut > 358).toBe(true); // tepat di utara
  });

  it("pagi hari matahari di timur, sore di barat", () => {
    expect(posisi(Date.UTC(2026, 2, 21, 1), JAKARTA.lat, JAKARTA.lon).azimut).toBeGreaterThan(60);
    expect(posisi(Date.UTC(2026, 2, 21, 1), JAKARTA.lat, JAKARTA.lon).azimut).toBeLessThan(120);
    expect(posisi(Date.UTC(2026, 2, 21, 9), JAKARTA.lat, JAKARTA.lon).azimut).toBeGreaterThan(240);
  });
});

describe("terbit dan terbenam", () => {
  const jam = (m: number) => m / 60;

  it("Jakarta: terbit antara 05.25 dan 06.10 WIB, terbenam antara 17.40 dan 18.25 WIB sepanjang tahun", () => {
    for (let b = 1; b <= 12; b++) {
      const s = hariSurya(2026, b, 15, JAKARTA.lat, JAKARTA.lon, 7);
      expect(jam(s.terbit)).toBeGreaterThan(5 + 25 / 60);
      expect(jam(s.terbit)).toBeLessThan(6 + 10 / 60);
      expect(jam(s.terbenam)).toBeGreaterThan(17 + 40 / 60);
      expect(jam(s.terbenam)).toBeLessThan(18 + 25 / 60);
    }
  });

  it("Jakarta 21 Juni 2026: terbit sekitar 06.02, terbenam sekitar 17.47 WIB (±3 menit)", () => {
    const s = hariSurya(2026, 6, 21, JAKARTA.lat, JAKARTA.lon, 7);
    expect(Math.abs(s.terbit - (6 * 60 + 2))).toBeLessThan(3);
    expect(Math.abs(s.terbenam - (17 * 60 + 47))).toBeLessThan(3);
  });

  it("panjang siang di khatulistiwa hampir tetap 12 jam lebih sedikit", () => {
    for (const b of [3, 6, 9, 12]) {
      const s = hariSurya(2026, b, 21, PONTIANAK.lat, PONTIANAK.lon, 7);
      expect(s.terbenam - s.terbit).toBeGreaterThan(12 * 60);
      expect(s.terbenam - s.terbit).toBeLessThan(12 * 60 + 10);
    }
  });
});

describe("hari tanpa bayangan", () => {
  it("Pontianak, tepat di khatulistiwa: sekitar ekuinoks (20–23 Maret, 22–24 September)", () => {
    const [a, b] = hariTanpaBayangan(2026, PONTIANAK.lat, PONTIANAK.lon, 7);
    expect(a.bulan).toBe(3);
    expect(a.hari).toBeGreaterThanOrEqual(20);
    expect(a.hari).toBeLessThanOrEqual(23);
    expect(b.bulan).toBe(9);
    expect(b.hari).toBeGreaterThanOrEqual(22);
    expect(b.hari).toBeLessThanOrEqual(24);
    // Kulminasi Pontianak sekitar pukul 11.50 WIB.
    expect(a.jam / 60).toBeGreaterThan(11.6);
    expect(a.jam / 60).toBeLessThan(12.1);
  });

  it("Jakarta: awal Maret dan awal Oktober", () => {
    const [a, b] = hariTanpaBayangan(2026, JAKARTA.lat, JAKARTA.lon, 7);
    expect([a.bulan, b.bulan]).toEqual([3, 10]);
    expect(a.hari).toBeGreaterThanOrEqual(2);
    expect(a.hari).toBeLessThanOrEqual(7);
    expect(b.hari).toBeGreaterThanOrEqual(6);
    expect(b.hari).toBeLessThanOrEqual(11);
    expect(a.sudut).toBeLessThan(0.4);
  });

  it("belahan utara (Sabang): April dan September", () => {
    const [a, b] = hariTanpaBayangan(2026, 5.89, 95.32, 7);
    expect([a.bulan, b.bulan]).toEqual([4, 9]);
  });

  it("kejadian berikutnya melompat ke tahun depan bila tahun ini sudah lewat", () => {
    const k = tanpaBayanganBerikutnya({ tahun: 2026, bulan: 10, hari: 18 }, JAKARTA.lat, JAKARTA.lon, 7);
    expect(k.tahun).toBe(2027);
    expect(k.bulan).toBe(3);
    expect(selisihHari({ tahun: 2026, bulan: 10, hari: 18 }, k)).toBeGreaterThan(130);
  });

  it("bayangan tengah hari menunjuk ke selatan saat matahari di utara", () => {
    expect(bayanganTengah(-6, 20)).toBeLessThan(0);
    expect(bayanganTengah(-6, -20)).toBeGreaterThan(0);
    expect(bayanganTengah(-6, -6)).toBeCloseTo(0);
  });
});
