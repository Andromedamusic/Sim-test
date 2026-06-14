/* Meter profiles — input impedance sets artifact (phantom-voltage) interpretation. */
export const METERS: Record<string, { z: number; cat: string; rms: boolean }> = {
  "Fluke 117": { z: 10e6, cat: "III 600V", rms: true },
  "Fluke 87V": { z: 10e6, cat: "IV 600V / III 1000V", rms: true },
  "Klein MM600": { z: 10e6, cat: "IV 600V / III 1000V", rms: true },
  "Analog (20kΩ/V)": { z: 200e3, cat: "II", rms: false },
  "Lo-Z (LoZ mode)": { z: 3e3, cat: "III/IV", rms: true },
};
export const METER_NAMES = Object.keys(METERS);
