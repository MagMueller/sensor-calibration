import { AmendmentAction, AmendmentRecord, TestBench } from '../types';
import { builtInTestBenches } from './testBenches';

export const LOCAL_BENCH_KEY = 'sensor-calibration-test-benches-v1';

export const loadLocalBenches = (): TestBench[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_BENCH_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveLocalBenches = (benches: TestBench[]) => {
  localStorage.setItem(LOCAL_BENCH_KEY, JSON.stringify(benches));
};

const LEGACY_GERMAN = /(?:prüf|mess|druck|temperatur|kraft|durchfluss|winkel|drehmoment|drehzahl|kalibrier|referenz|verstärker|kanal|direkt|frequenz|impuls|entwurf|internalal|temperaturee|uncertaintys|test benchs)/i;

export const englishFallback = (value: string | undefined, fallback: string) =>
  !value || LEGACY_GERMAN.test(value) ? fallback : value;

export const createAmendmentRecord = (
  author: string,
  action: AmendmentAction,
  note: string,
  issue: string,
  timestamp = new Date()
): AmendmentRecord => ({
  id: `amendment-${timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: timestamp.toISOString(),
  author: author.trim() || 'Unassigned',
  action,
  note: note.trim(),
  issue: issue.trim() || 'Unspecified'
});

const hydrateSavedBench = (saved: TestBench, builtIn: TestBench): TestBench => ({
  ...saved,
  locked: saved.locked ?? false,
  amendmentHistory: Array.isArray(saved.amendmentHistory) ? saved.amendmentHistory : [],
  name: englishFallback(saved.name, builtIn.name),
  revision: /^entwurf\b/i.test(saved.revision) ? saved.revision.replace(/^entwurf/i, 'Draft') : saved.revision,
  description: englishFallback(saved.description, builtIn.description),
  measurementPaths: saved.measurementPaths.map(path => {
    const template = builtIn.measurementPaths.find(candidate => candidate.id === path.id)
      ?? builtInTestBenches.flatMap(candidate => candidate.measurementPaths).find(candidate => candidate.sensorId === path.sensorId);
    if (!template) return path;
    return {
      ...path,
      name: englishFallback(path.name, template.name),
      physicalSensorName: path.physicalSensorName
        ? englishFallback(path.physicalSensorName, template.physicalSensorName ?? path.physicalSensorName)
        : template.physicalSensorName,
      sensorModel: englishFallback(path.sensorModel, template.sensorModel),
      amplifierModel: englishFallback(path.amplifierModel, template.amplifierModel),
      referenceModel: englishFallback(path.referenceModel, template.referenceModel),
      dataAcquisitionModel: englishFallback(path.dataAcquisitionModel, template.dataAcquisitionModel),
      amplifierChannel: path.amplifierChannel === 'direkt' ? 'direct' : path.amplifierChannel,
      conversion: {
        ...path.conversion,
        description: englishFallback(path.conversion.description, template.conversion.description)
      }
    };
  })
});

/** Applies locally edited built-in benches by id, while migrating legacy German labels, and appends new benches. */
export const mergeBenchCatalog = (builtIn: TestBench[], saved: TestBench[]) => [
  ...builtIn.map(bench => {
    const override = saved.find(candidate => candidate.id === bench.id);
    return override ? hydrateSavedBench(override, bench) : bench;
  }),
  ...saved
    .filter(bench => !builtIn.some(candidate => candidate.id === bench.id))
    .map(bench => hydrateSavedBench(bench, builtInTestBenches[1]))
];

export const savePcSettingsForPath = (benchId: string, pathId: string, pcGain: number, pcOffset: number) => {
  const saved = loadLocalBenches();
  const base = saved.find(bench => bench.id === benchId) ?? builtInTestBenches.find(bench => bench.id === benchId);
  if (!base || !base.measurementPaths.some(path => path.id === pathId)) return false;
  const updated: TestBench = {
    ...base,
    measurementPaths: base.measurementPaths.map(path => path.id === pathId ? { ...path, pcGain, pcOffset } : path)
  };
  saveLocalBenches(saved.some(bench => bench.id === benchId)
    ? saved.map(bench => bench.id === benchId ? updated : bench)
    : [...saved, updated]);
  return true;
};
