import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { createAmendmentRecord, loadLocalBenches, mergeBenchCatalog, saveLocalBenches } from '../data/benchStorage';
import { DataLoader } from '../data/dataLoader';
import { AdditionalUncertainty, MeasurementPath, ReferenceConversion, ReferenceConversionMode, TestBench, UncertaintyDistribution } from '../types';

interface Props {
  initialBenchId?: string;
  onStartCalibration: (setups: import('../types').CalibrationSetup[]) => void;
}

const cloneBench = (bench: TestBench): TestBench => JSON.parse(JSON.stringify(bench));

const CalibrationSetup = ({ initialBenchId, onStartCalibration }: Props) => {
  const builtInCatalog = useMemo(() => DataLoader.getTestBenches(), []);
  const [localBenches, setLocalBenches] = useState<TestBench[]>(loadLocalBenches);
  const catalog = useMemo(() => mergeBenchCatalog(builtInCatalog, localBenches), [builtInCatalog, localBenches]);
  const sensors = useMemo(() => DataLoader.getSensors(), []);
  const amplifiers = useMemo(() => DataLoader.getAmplifiers(), []);
  const references = useMemo(() => DataLoader.getReferenceSensors(), []);
  const daqs = useMemo(() => DataLoader.getDataAcquisitionDevices(), []);
  const [bench, setBench] = useState<TestBench>();
  const [pathId, setPathId] = useState('');
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [runMode, setRunMode] = useState<'calibration' | 'simulation'>('calibration');
  const [distribution, setDistribution] = useState<UncertaintyDistribution>('normal');
  const [sensorAgeYears, setSensorAgeYears] = useState(0);
  const [temperatureDeltaK, setTemperatureDeltaK] = useState(0);
  const [equipmentSerials, setEquipmentSerials] = useState<Record<string, string>>({});
  const [technician, setTechnician] = useState('');
  const [amendmentNote, setAmendmentNote] = useState('');
  const [governanceError, setGovernanceError] = useState('');
  const [draftBenchName, setDraftBenchName] = useState('');
  const [pathTemplateId, setPathTemplateId] = useState('');
  const [pendingDeletePathId, setPendingDeletePathId] = useState('');

  useEffect(() => { saveLocalBenches(localBenches); }, [localBenches]);
  useEffect(() => {
    if (!bench) return;
    setLocalBenches(current => current.some(item => item.id === bench.id) ? current.map(item => item.id === bench.id ? bench : item) : [...current, bench]);
  }, [bench]);
  useEffect(() => { setPendingDeletePathId(''); }, [pathId]);

  const path = bench?.measurementPaths.find(item => item.id === pathId);
  const serialFor = (kind: EquipmentSerialKind) => path ? equipmentSerials[equipmentSerialKey(kind, path)] ?? '' : '';
  const setSerialFor = (kind: EquipmentSerialKind, value: string) => {
    if (!path) return;
    setEquipmentSerials(current => ({ ...current, [equipmentSerialKey(kind, path)]: value }));
  };
  const sensorSerial = serialFor('sensor');
  const amplifierSerial = serialFor('amplifier');
  const referenceSerial = serialFor('reference');
  const daqSerial = serialFor('daq');
  const setSensorSerial = (value: string) => setSerialFor('sensor', value);
  const setAmplifierSerial = (value: string) => setSerialFor('amplifier', value);
  const setReferenceSerial = (value: string) => setSerialFor('reference', value);
  const setDaqSerial = (value: string) => setSerialFor('daq', value);
  const pathTemplates = useMemo(() => builtInCatalog.flatMap(item => item.measurementPaths), [builtInCatalog]);
  const selectedBenchPaths = bench?.measurementPaths.filter(item => selectedPathIds.includes(item.id)) ?? [];
  const duplicateDaqChannels = selectedBenchPaths.filter((item, index, all) => all.findIndex(candidate => candidate.dataAcquisitionId === item.dataAcquisitionId && candidate.dataAcquisitionChannel === item.dataAcquisitionChannel) !== index);
  const sensor = path ? sensors.find(item => item.id === path.sensorId) : undefined;
  const catalogRange = sensor?.ranges.find(item => item.id === path?.rangeId);
  const range = resolveRange(catalogRange, path);
  const amplifier = path ? amplifiers.find(item => item.id === path.amplifierId) : undefined;
  const reference = path ? references.find(item => item.id === path.referenceId) : undefined;
  const daq = path ? daqs.find(item => item.id === path.dataAcquisitionId) : undefined;
  const compatibleReferences = sensor && range && path ? DataLoader.getCompatibleReferences(sensor, range, path.conversion.referenceUnit) : [];

  const selectBench = useCallback((id: string) => {
    const selected = catalog.find(item => item.id === id);
    const copy = selected ? cloneBench(selected) : undefined;
    setBench(copy); setPathId(copy?.measurementPaths[0]?.id ?? ''); setSelectedPathIds(copy?.measurementPaths.map(item => item.id) ?? []);
    setAmendmentNote(''); setGovernanceError(''); setPendingDeletePathId(''); setEquipmentSerials({});
  }, [catalog]);

  useEffect(() => { if (initialBenchId && !bench) selectBench(initialBenchId); }, [initialBenchId, bench, selectBench]);

  const createBench = () => {
    const template = catalog[1];
    const created = cloneBench(template);
    created.id = `local-${Date.now()}`;
    created.name = draftBenchName.trim() || 'New test bench';
    created.revision = 'Draft 1';
    created.description = 'Local draft based on the multi-quantity template. Verify equipment IDs, channels, and conversions before approval.';
    created.source = 'local';
    created.locked = false;
    created.amendmentHistory = [createAmendmentRecord(
      technician,
      'created',
      'Test bench created from the multi-quantity template.',
      created.revision
    )];
    created.measurementPaths = created.measurementPaths.map(item => ({ ...item, id: `${created.id}-${item.id}` }));
    setBench(created); setPathId(created.measurementPaths[0].id); setSelectedPathIds(created.measurementPaths.map(item => item.id)); setDraftBenchName('');
  };

  const appendAmendment = (target: TestBench, action: Parameters<typeof createAmendmentRecord>[1], note: string): TestBench => ({
    ...target,
    amendmentHistory: [
      createAmendmentRecord(technician, action, note, target.revision),
      ...(target.amendmentHistory ?? [])
    ]
  });
  const validateGovernanceInput = (requireNote = false) => {
    if (!technician.trim()) { setGovernanceError('Enter the responsible technician before changing or approving the template.'); return false; }
    if (requireNote && !amendmentNote.trim()) { setGovernanceError('Describe the reason for this change before recording it.'); return false; }
    setGovernanceError('');
    return true;
  };
  const addManualAmendment = () => {
    if (!bench || !validateGovernanceInput(true)) return;
    setBench(appendAmendment(bench, 'configuration-changed', amendmentNote));
    setAmendmentNote('');
  };
  const toggleTemplateLock = () => {
    if (!bench || !validateGovernanceInput(true)) return;
    const locked = !bench.locked;
    setBench(appendAmendment({ ...bench, locked }, locked ? 'locked' : 'unlocked', amendmentNote));
    setAmendmentNote('');
  };

  const updateCurrentPath = (patch: Partial<MeasurementPath>) => setBench(current => current && !current.locked ? ({ ...current, measurementPaths: current.measurementPaths.map(item => item.id === pathId ? { ...item, ...patch } : item) }) : current);
  const updatePath = (field: string, value: string | number) => updateCurrentPath({ [field]: value });
  const markConversionAmendment = () => setAmendmentNote(current => current || 'Test method or reference conversion changed — review the issue and approval status.');
  const updateConversion = (field: keyof ReferenceConversion, value: string | number) => {
    setBench(current => current && !current.locked ? ({ ...current, measurementPaths: current.measurementPaths.map(item => item.id === pathId ? { ...item, conversion: { ...item.conversion, [field]: value } } : item) }) : current);
    markConversionAmendment();
  };

  const setTorqueMethod = (mode: 'torque-lever' | 'calibrated-signal') => {
    if (!path || !range || bench?.locked) return;
    markConversionAmendment();
    if (mode === 'torque-lever') {
      updateCurrentPath({
        referenceId: 'internal-deadweight-force', referenceModel: 'Deadweight force / force reference 0…400 N',
        conversion: {
          ...path.conversion, mode, referenceUnit: 'N', targetUnit: 'Nm', factor: 1, offset: 0,
          leverLengthM: path.conversion.leverLengthM ?? 0.5, leverInputKind: 'force', gravityMs2: path.conversion.gravityMs2 ?? 9.80665,
          leverAngleDeg: path.conversion.leverAngleDeg ?? 90, direction: path.conversion.direction ?? 1, tareTorqueNm: path.conversion.tareTorqueNm ?? 0,
          description: 'Mechanical full-chain test: torque = force × effective lever length × sin(angle), including direction and tare.'
        },
        referencePointValues: Array.from({ length: 11 }, (_, index) => index * 40)
      });
      return;
    }
    updateCurrentPath({
      referenceId: 'internal-voltage-calibrator', referenceModel: 'Voltage reference ±10 V',
      conversion: {
        ...path.conversion, mode, referenceUnit: 'V', targetUnit: 'Nm', factor: 1, offset: 0,
        zeroReferenceValue: path.conversion.zeroReferenceValue ?? 0, zeroTargetValue: path.conversion.zeroTargetValue ?? range.min,
        calibratedReferenceValue: path.conversion.calibratedReferenceValue ?? 10.01, nominalTargetValue: path.conversion.nominalTargetValue ?? range.max,
        description: 'Electrical signal-chain test: round simulator voltages are converted to the precise Nm target using the calibrated sensor characteristic.'
      },
      referencePointValues: Array.from({ length: 11 }, (_, index) => index)
    });
  };

  const changeConversionMode = (mode: ReferenceConversionMode) => {
    if (!path || mode === path.conversion.mode) return;
    if (mode === 'torque-lever' || mode === 'calibrated-signal') { setTorqueMethod(mode); return; }
    updateConversion('mode', mode);
  };

  const changeLeverInputKind = (kind: 'force' | 'mass') => {
    if (!path || bench?.locked) return;
    const referencePointValues = kind === 'force'
      ? Array.from({ length: 11 }, (_, index) => index * 40)
      : Array.from({ length: 11 }, (_, index) => index * 4);
    updateCurrentPath({
      referenceId: kind === 'force' ? 'internal-deadweight-force' : 'internal-mass-set',
      referenceModel: kind === 'force' ? 'Deadweight force / force reference 0…400 N' : 'Calibrated mass set 0…40 kg',
      conversion: { ...path.conversion, leverInputKind: kind, referenceUnit: kind === 'force' ? 'N' : 'kg' }, referencePointValues
    });
    markConversionAmendment();
  };
  const addPathFromTemplate = () => {
    if (!bench || bench.locked || !validateGovernanceInput()) return;
    const template = pathTemplates.find(item => item.id === pathTemplateId);
    if (!template) return;
    const added = cloneBench({ id: '', name: '', revision: '', description: '', source: 'local', measurementPaths: [template] }).measurementPaths[0];
    added.id = `${bench.id}-path-${Date.now()}`;
    added.name = `${template.name} ${bench.measurementPaths.length + 1}`;
    const note = amendmentNote.trim() || `Added measurement path “${added.name}”.`;
    setBench(appendAmendment({ ...bench, measurementPaths: [...bench.measurementPaths, added] }, 'measurement-path-added', note)); setPathId(added.id); setSelectedPathIds(current => [...current, added.id]); setPathTemplateId(''); setPendingDeletePathId(''); setAmendmentNote('');
  };
  const removePath = () => {
    if (!bench || bench.locked || !pathId || !validateGovernanceInput()) return;
    if (pendingDeletePathId !== pathId) { setPendingDeletePathId(pathId); return; }
    const removed = bench.measurementPaths.find(item => item.id === pathId);
    const remaining = bench.measurementPaths.filter(item => item.id !== pathId);
    const note = amendmentNote.trim() || `Removed measurement path “${removed?.name ?? pathId}”.`;
    setBench(appendAmendment({ ...bench, measurementPaths: remaining }, 'measurement-path-removed', note)); setPathId(remaining[0]?.id ?? ''); setSelectedPathIds(current => current.filter(id => id !== pathId)); setPendingDeletePathId(''); setAmendmentNote('');
  };

  const defaultTargetPoints = sensor && range ? DataLoader.getDefaultMeasurementPoints(sensor, range) : [];
  const activeReferencePoints = path && DataLoader.validateReferenceConversion(path.conversion)
    ? (path.referencePointValues?.length ? path.referencePointValues : defaultTargetPoints.map(target => roundReferenceValue(DataLoader.targetToReference(target, path.conversion))))
    : [];

  const updateReferencePoint = (index: number, value: number) => {
    if (!path) return;
    const updated = [...activeReferencePoints];
    updated[index] = value;
    updateCurrentPath({ referencePointValues: updated });
  };

  const addReferencePoint = () => {
    if (!path) return;
    const updated = [...activeReferencePoints];
    if (updated.length < 2) updated.push((updated[0] ?? 0) + 1);
    else updated.splice(updated.length - 1, 0, roundReferenceValue((updated[updated.length - 2] + updated[updated.length - 1]) / 2));
    updateCurrentPath({ referencePointValues: updated });
  };

  const removeReferencePoint = (index: number) => {
    if (!path || activeReferencePoints.length <= 2) return;
    updateCurrentPath({ referencePointValues: activeReferencePoints.filter((_, pointIndex) => pointIndex !== index) });
  };

  const addAdditionalUncertainty = () => {
    if (!path) return;
    const item: AdditionalUncertainty = { id: `extra-${Date.now()}`, label: 'Additional influence', expandedPercentFs: 0.01 };
    updateCurrentPath({ additionalUncertainties: [...(path.additionalUncertainties ?? []), item] });
  };

  const updateAdditionalUncertainty = (id: string, patch: Partial<AdditionalUncertainty>) => {
    if (!path) return;
    updateCurrentPath({ additionalUncertainties: (path.additionalUncertainties ?? []).map(item => item.id === id ? { ...item, ...patch } : item) });
  };

  const removeAdditionalUncertainty = (id: string) => {
    if (!path) return;
    updateCurrentPath({ additionalUncertainties: (path.additionalUncertainties ?? []).filter(item => item.id !== id) });
  };

  const resetReferencePointsForRange = () => {
    if (!path || !range || !DataLoader.validateReferenceConversion(path.conversion)) return;
    const targets = Array.from({ length: 11 }, (_, index) => roundReferenceValue(range.min + range.span * index / 10));
    updateCurrentPath({
      pointValues: targets,
      referencePointValues: targets.map(target => roundReferenceValue(DataLoader.targetToReference(target, path.conversion)))
    });
  };

  const makeSetup = (selectedPath: NonNullable<typeof path>): import('../types').CalibrationSetup | undefined => {
    const selectedSensor = sensors.find(item => item.id === selectedPath.sensorId);
    const selectedRange = resolveRange(selectedSensor?.ranges.find(item => item.id === selectedPath.rangeId), selectedPath);
    const selectedAmplifier = amplifiers.find(item => item.id === selectedPath.amplifierId);
    const selectedReference = references.find(item => item.id === selectedPath.referenceId);
    const selectedDaq = daqs.find(item => item.id === selectedPath.dataAcquisitionId);
    const referenceMatchesMethod = selectedSensor && selectedRange && DataLoader.getCompatibleReferences(selectedSensor, selectedRange, selectedPath.conversion.referenceUnit).some(item => item.id === selectedPath.referenceId);
    if (!bench || !selectedSensor || !selectedRange || !selectedAmplifier || !selectedReference || !selectedDaq || !referenceMatchesMethod || hasInvalidRangeOverride(selectedPath) || hasInvalidAdditionalUncertainty(selectedPath) || (selectedPath.displayResolution !== undefined && (!Number.isFinite(selectedPath.displayResolution) || selectedPath.displayResolution <= 0)) || (selectedPath.pcGain !== undefined && (!Number.isFinite(selectedPath.pcGain) || Math.abs(selectedPath.pcGain) <= Number.EPSILON)) || (selectedPath.pcOffset !== undefined && !Number.isFinite(selectedPath.pcOffset)) || !DataLoader.validateReferenceConversion(selectedPath.conversion)) return undefined;
    const targetDefaults = selectedPath.pointValues?.length ? [...selectedPath.pointValues] : DataLoader.getDefaultMeasurementPoints(selectedSensor, selectedRange);
    const referencePoints = selectedPath.referencePointValues?.length
      ? [...selectedPath.referencePointValues]
      : targetDefaults.map(target => roundReferenceValue(DataLoader.targetToReference(target, selectedPath.conversion)));
    const points = selectedPath.referencePointValues?.length
      ? referencePoints.map(referenceValue => DataLoader.referenceToTarget(referenceValue, selectedPath.conversion))
      : targetDefaults;
    if (!DataLoader.validateMeasurementPoints(points, selectedRange)) return undefined;
    return {
      runMode, testBenchId: bench.id, testBenchName: bench.name, measurementPathId: selectedPath.id, measurementPathName: selectedPath.name,
      sensorBmk: selectedPath.sensorBmk, connector: selectedPath.connector, amplifierBmk: selectedPath.amplifierBmk, amplifierChannel: selectedPath.amplifierChannel, dataAcquisitionBmk: selectedPath.dataAcquisitionBmk ?? '—', dataAcquisitionChannel: selectedPath.dataAcquisitionChannel,
      referenceConversion: { ...selectedPath.conversion }, sensor: selectedSensor, amplifier: selectedAmplifier, referenceSensor: selectedReference, dataAcquisition: selectedDaq,
      selectedSensorModel: selectedPath.sensorModel, selectedAmplifierModel: selectedPath.amplifierModel, selectedReferenceModel: selectedPath.referenceModel, selectedDataAcquisitionModel: selectedPath.dataAcquisitionModel,
      sensorSerial: equipmentSerials[equipmentSerialKey('sensor', selectedPath)] ?? '', amplifierSerial: equipmentSerials[equipmentSerialKey('amplifier', selectedPath)] ?? '', referenceSerial: equipmentSerials[equipmentSerialKey('reference', selectedPath)] ?? '', dataAcquisitionSerial: equipmentSerials[equipmentSerialKey('daq', selectedPath)] ?? '', selectedRange, measurementPointValues: points, referencePointValues: referencePoints, tolerancePercent: selectedPath.tolerancePercent, displayResolution: selectedPath.displayResolution ?? DataLoader.getDefaultDisplayResolution(selectedRange), pcGain: selectedPath.pcGain ?? 1, pcOffset: selectedPath.pcOffset ?? 0,
      uncertaintyDistribution: distribution, sensorAgeYears, temperatureDeltaK, additionalUncertainties: [...(selectedPath.additionalUncertainties ?? [])], protocolIssue: bench.revision, amendmentNote,
      technician: technician.trim(), templateLocked: Boolean(bench.locked), templateAmendmentHistory: [...(bench.amendmentHistory ?? [])]
    };
  };

  const start = () => {
    if (!bench || !path) return;
    const selectedPaths = bench.measurementPaths.filter(item => selectedPathIds.includes(item.id));
    const setups = selectedPaths.map(makeSetup).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (setups.length === selectedPaths.length) onStartCalibration(setups);
  };

  const selectedPaths = selectedBenchPaths;
  const governanceReady = runMode === 'simulation' || Boolean(bench?.locked);
  const canStart = Boolean(technician.trim() && governanceReady && bench && path && selectedPaths.length > 0 && duplicateDaqChannels.length === 0 && selectedPaths.every(item => makeSetup(item)));
  const activeSetup = path ? makeSetup(path) : undefined;
  const activeUncertainty = activeSetup ? DataLoader.calculateDetailedUncertainty(activeSetup) : undefined;
  const activeTur = activeSetup && activeUncertainty ? DataLoader.calculateTur(activeSetup, activeUncertainty.expandedUncertainty) : undefined;

  return <div className="space-y-6">
    <header className="workspace-hero"><div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow">Step 1 · Prepare</p><h1 className="page-title">Build today’s calibration run</h1><p className="page-subtitle">Choose the test bench, select its due measurement paths, and confirm the responsible technician.</p></div><div className="grid grid-cols-3 gap-5 border-t border-white/10 pt-4 text-xs lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><div><span className="block text-slate-400">Bench</span><strong className="mt-1 block max-w-32 truncate text-white">{bench?.name ?? 'Not selected'}</strong></div><div><span className="block text-slate-400">Paths</span><strong className="mt-1 block text-white">{selectedPathIds.length || '—'}</strong></div><div><span className="block text-slate-400">State</span><strong className="mt-1 block text-white">{bench?.locked ? 'Locked' : bench ? 'Draft' : '—'}</strong></div></div></div></header>

    <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="card-flat"><p className="eyebrow">01 · Test bench</p><h2 className="section-title">Open saved configuration</h2><label className="form-label mt-5" htmlFor="bench">Test bench</label><select id="bench" className="form-select" value={bench?.id ?? ''} onChange={event => selectBench(event.target.value)}><option value="">Select test bench …</option>{catalog.map(item => <option key={item.id} value={item.id}>{item.name} · Issue {item.revision}{item.locked ? ' · Locked' : ''}</option>)}</select>
        <label className="form-label mt-5" htmlFor="technician">Responsible technician</label><input id="technician" className="form-input" autoComplete="name" value={technician} onChange={event => { setTechnician(event.target.value); setGovernanceError(''); }} placeholder="Full name" /><p className="form-help">Required for every calibration and every template amendment.</p>
        <div className="mt-5 border-t border-slate-200 pt-5"><label className="form-label" htmlFor="new-bench">Create a test bench from a template</label><div className="flex gap-2"><input id="new-bench" className="form-input" value={draftBenchName} onChange={event => setDraftBenchName(event.target.value)} placeholder="e.g. Test bench 07" /><button type="button" className="btn-tertiary whitespace-nowrap" onClick={createBench}>Create</button></div><p className="form-help">Stored locally in this prototype; starts with five example measurement paths.</p></div>
      </div>
      <div className="card-flat">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">02 · Sensors and measurement paths</p><h2 className="section-title">Select and edit measurement paths</h2></div>{bench && <span className="status-neutral">{selectedPathIds.length}/{bench.measurementPaths.length} selected</span>}</div>
        {bench ? <>
          <p className="mt-2 text-sm text-slate-600">Checkbox = calibrate today. “Edit” opens the settings for that measurement path.</p>
          {bench.source === 'local' && <Field label="Test bench name" value={bench.name} disabled={Boolean(bench.locked)} onChange={value => setBench({ ...bench, name: value })} />}
          <div className="mt-4 flex gap-2"><button type="button" className="btn-tertiary px-3 py-2 text-xs" onClick={() => setSelectedPathIds(bench.measurementPaths.map(item => item.id))}>Select all</button><button type="button" className="btn-tertiary px-3 py-2 text-xs" onClick={() => setSelectedPathIds([])}>Select none</button></div>
          <div className="mt-4 space-y-2">{bench.measurementPaths.map(item => <MeasurementPathRow key={item.id} item={item} checked={selectedPathIds.includes(item.id)} active={pathId === item.id} onToggle={checked => { setSelectedPathIds(current => checked ? [...current, item.id] : current.filter(id => id !== item.id)); if (checked) setPathId(item.id); }} onEdit={() => setPathId(item.id)} />)}</div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Manage measurement paths</p><div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"><select aria-label="Measurement path template" className="form-select" disabled={Boolean(bench.locked)} value={pathTemplateId} onChange={event => { setPathTemplateId(event.target.value); setPendingDeletePathId(''); }}><option value="">Select another measurement path …</option>{pathTemplates.map((item, index) => <option key={`${item.id}-${index}`} value={item.id}>{item.name}</option>)}</select><button type="button" className="btn-tertiary" disabled={!pathTemplateId || Boolean(bench.locked)} onClick={addPathFromTemplate}>Add</button><button type="button" className={`btn-tertiary ${pendingDeletePathId === pathId ? 'border-rose-400 bg-rose-50 text-rose-800' : 'text-rose-700'}`} disabled={!path || Boolean(bench.locked)} onClick={removePath}>{pendingDeletePathId === pathId ? 'Confirm deletion' : 'Delete selected path'}</button></div>{bench.locked && <p className="mt-2 text-xs font-semibold text-slate-600">Unlock the template before adding or removing measurement paths.</p>}{pendingDeletePathId === pathId && <p className="mt-2 text-xs font-semibold text-rose-700">Click again to remove “{path?.name}”.</p>}</div>
          {duplicateDaqChannels.length > 0 && <p className="form-error">Duplicate DAQ channel: {duplicateDaqChannels.map(item => item.dataAcquisitionChannel).join(', ')}</p>}
        </> : <div className="empty-state mt-5">Select a test bench first.</div>}
      </div>
    </section>

    {bench && <section className="card-flat">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="eyebrow">Governance and traceability</p><h2 className="section-title">Issue control and amendment record</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Lock an approved template to prevent accidental configuration edits. Every structural change, lock, and unlock is recorded with a person, time, issue, and reason.</p></div><span className={bench.locked ? 'status-success' : 'status-warning'}>{bench.locked ? 'Template locked' : 'Editable draft'}</span></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.35fr_1fr_auto]"><Field label="Issue / revision" value={bench.revision} disabled={Boolean(bench.locked)} onChange={value => setBench({ ...bench, revision: value })} /><label className="block"><span className="form-label">Change note / reason</span><input className="form-input" value={amendmentNote} onChange={event => { setAmendmentNote(event.target.value); setGovernanceError(''); }} placeholder={bench.locked ? 'Reason for unlocking or a run-specific note' : 'What changed and why?'} /></label><div className="flex flex-wrap items-end gap-2"><button type="button" className="btn-tertiary" onClick={addManualAmendment}>Add record</button><button type="button" className={bench.locked ? 'btn-tertiary' : 'btn-primary'} onClick={toggleTemplateLock}>{bench.locked ? 'Unlock template' : 'Lock template'}</button></div></div>
      {governanceError && <p className="form-error mt-3" role="alert">{governanceError}</p>}
      <div className="mt-6 border-t border-slate-200 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-900">Amendment history</h3><span className="text-xs text-slate-500">{bench.amendmentHistory?.length ?? 0} record(s)</span></div>{bench.amendmentHistory?.length ? <div className="max-h-72 space-y-2 overflow-y-auto pr-1">{bench.amendmentHistory.map(record => <div key={record.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-[155px_150px_1fr]"><div><strong className="block text-slate-800">{formatGovernanceDate(record.timestamp)}</strong><span className="text-xs text-slate-500">Issue {record.issue}</span></div><div><span className="block font-semibold text-slate-800">{record.author}</span><span className="text-xs capitalize text-slate-500">{record.action.replace(/-/g, ' ')}</span></div><p className="text-slate-600">{record.note}</p></div>)}</div> : <div className="empty-state">No amendments recorded yet. Add the first note before locking this template.</div>}</div>
      <p className="mt-4 text-xs leading-5 text-slate-500"><strong>Approval rule:</strong> an official calibration can start only from a locked template; simulations remain available while editing. <strong>Prototype boundary:</strong> this workflow lock and history are stored in this browser. A production enterprise deployment still needs authenticated users, role-based approval, a server-side append-only audit log, and backups.</p>
    </section>}

    {bench && path && sensor && range && amplifier && reference && daq && <>
      <details className="card-flat">
        <summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">03–05 · Installation and signal chain</p><h2 className="section-title">Sensor, amplifier, and PC channels</h2><p className="mt-1 text-sm text-slate-500">Open only when the equipment ID, connector, serial number, or channel must be changed.</p></div><span className="status-neutral">Advanced</span></div></summary>
        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <DeviceCard index="03" title="Sensor / installation point"><Field label="Measurement path name" value={path.name} disabled={Boolean(bench.locked)} onChange={value => updatePath('name', value)} /><p className="mt-3 text-sm text-slate-500">{sensor.manufacturer} · {path.sensorModel}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Equipment ID" value={path.sensorBmk} disabled={Boolean(bench.locked)} onChange={value => updatePath('sensorBmk', value)} /><Field label="Connector / pins" value={path.connector} disabled={Boolean(bench.locked)} onChange={value => updatePath('connector', value)} /></div><DatabaseSpecs source={sensor.source} items={[['Base accuracy', `±${format(sensor.accuracy.standardSpanPercent)} % FS`], ['Non-linearity', sensor.accuracy.nonlinearitySpanPercentBfsl === undefined ? '—' : `±${format(sensor.accuracy.nonlinearitySpanPercentBfsl)} % FS`], ['Long-term stability', sensor.accuracy.longTermStabilityPercentSpanPerYear === undefined ? '—' : `${format(sensor.accuracy.longTermStabilityPercentSpanPerYear)} % FS/year`]]} /><SerialField label="Sensor serial number" value={sensorSerial} onChange={setSensorSerial} /></DeviceCard>
          <DeviceCard index="04" title="Measurement amplifier"><p className="font-bold">{amplifier.manufacturer} · {path.amplifierModel}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Equipment ID" value={path.amplifierBmk} disabled={Boolean(bench.locked)} onChange={value => updatePath('amplifierBmk', value)} /><Field label="Channel" value={path.amplifierChannel} disabled={Boolean(bench.locked)} onChange={value => updatePath('amplifierChannel', value)} /></div><DatabaseSpecs source={amplifier.source} items={[['Gain error', `±${format(amplifier.accuracy.gainErrorPercent)} %`], ['Temperature coefficient', amplifier.accuracy.temperatureCoefficientPercentPerK === undefined ? '—' : `${format(amplifier.accuracy.temperatureCoefficientPercentPerK)} %/K`]]} /><SerialField label="Amplifier serial number" value={amplifierSerial} onChange={setAmplifierSerial} /></DeviceCard>
          <DeviceCard index="05" title="PC measurement card"><p className="font-bold">{daq.manufacturer} · {path.dataAcquisitionModel}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Equipment ID" value={path.dataAcquisitionBmk ?? ''} disabled={Boolean(bench.locked)} onChange={value => updatePath('dataAcquisitionBmk', value)} /><Field label="DAQ channel" value={path.dataAcquisitionChannel} disabled={Boolean(bench.locked)} onChange={value => updatePath('dataAcquisitionChannel', value)} /></div><DatabaseSpecs source={daq.source} items={[['Accuracy', daq.accuracyPercentFs === undefined ? (daq.absoluteAccuracy === undefined ? '—' : `±${format(daq.absoluteAccuracy)} absolute`) : `±${format(daq.accuracyPercentFs)} % FS`], ['Resolution', `${daq.resolutionBits} bit`]]} /><SerialField label="DAQ serial number" value={daqSerial} onChange={setDaqSerial} /></DeviceCard>
        </section>
      </details>

      <section className="card-flat"><p className="eyebrow">06 · Test method and reference</p><h2 className="section-title">Reference and conversion</h2><p className="mt-2 text-sm text-slate-600">Select the reference device. Special physical conversions are available under “Advanced conversion assumptions”.</p>
          {sensor.measurand === 'torque' && <div className="mt-5"><label className="form-label">Test method</label><div className="grid gap-3 sm:grid-cols-2"><MethodButton active={path.conversion.mode === 'torque-lever'} disabled={Boolean(bench.locked)} title="Mechanical lever method" note="The sensor remains installed; tests the complete measurement chain." onClick={() => setTorqueMethod('torque-lever')} /><MethodButton active={path.conversion.mode === 'calibrated-signal'} disabled={Boolean(bench.locked)} title="Electrical simulation" note="Tests scaling and the signal chain, not the mechanical sensor." onClick={() => setTorqueMethod('calibrated-signal')} /></div></div>}

          <label className="form-label mt-5" htmlFor="reference-device">Reference device</label><select id="reference-device" className="form-select" disabled={Boolean(bench.locked)} value={path.referenceId} onChange={event => { const selected = compatibleReferences.find(item => item.id === event.target.value); if (selected) updateCurrentPath({ referenceId: selected.id, referenceModel: selected.models[0] }); }}><option value="">Select reference …</option>{compatibleReferences.map(item => <option key={item.id} value={item.id}>{item.manufacturer} · {item.models[0]}</option>)}</select><DatabaseSpecs source={reference.source} items={[['Reference accuracy', reference.accuracy.accuracyPercentFs === undefined ? (reference.accuracy.absoluteAccuracy === undefined ? '—' : `±${format(reference.accuracy.absoluteAccuracy)} absolute`) : `±${format(reference.accuracy.accuracyPercentFs)} % FS`], ['Non-linearity', reference.accuracy.nonLinearityPercentFs === undefined ? '—' : `±${format(reference.accuracy.nonLinearityPercentFs)} % FS`]]} />

          <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer font-bold text-slate-800">Advanced conversion assumptions</summary><fieldset disabled={Boolean(bench.locked)}>
            <label className="form-label mt-4" htmlFor="conversion-mode">Physical formula</label><select id="conversion-mode" className="form-select" disabled={Boolean(bench.locked)} value={path.conversion.mode} onChange={event => changeConversionMode(event.target.value as ReferenceConversionMode)}><option value="identity">Identity</option><option value="linear">Linear y = a·x + b</option><option value="load-cell">Load cell mV/V ↔ N</option><option value="pulse-flow">Frequency + pulse volume ↔ l/min</option><option value="torque-lever">Torque from force/mass × lever</option><option value="calibrated-signal">Calibrated sensor signal ↔ engineering unit</option></select>
            {path.conversion.mode === 'linear' && <div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label="Factor a" value={path.conversion.factor} disabled={Boolean(bench.locked)} onChange={value => updateConversion('factor', value)} /><NumberField label="Offset b" value={path.conversion.offset} disabled={Boolean(bench.locked)} onChange={value => updateConversion('offset', value)} /></div>}
            {path.conversion.mode === 'load-cell' && <div className="mt-4 grid gap-3 sm:grid-cols-3"><NumberField label="Rated force [N]" value={path.conversion.ratedForceN ?? 0} disabled={Boolean(bench.locked)} onChange={value => updateConversion('ratedForceN', value)} /><NumberField label="Sensitivity [mV/V]" value={path.conversion.sensitivityMvV ?? 0} disabled={Boolean(bench.locked)} onChange={value => updateConversion('sensitivityMvV', value)} /><NumberField label="Zero signal [mV/V]" value={path.conversion.zeroReferenceValue ?? 0} disabled={Boolean(bench.locked)} onChange={value => updateConversion('zeroReferenceValue', value)} /></div>}
            {path.conversion.mode === 'pulse-flow' && <NumberField className="mt-4" label="Pulse volume [cm³/pulse]" value={path.conversion.pulseVolumeCm3 ?? 0} onChange={value => updateConversion('pulseVolumeCm3', value)} />}
            {path.conversion.mode === 'torque-lever' && <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div><label className="form-label" htmlFor="lever-input">Input at reference</label><select id="lever-input" className="form-select" value={path.conversion.leverInputKind ?? 'force'} onChange={event => changeLeverInputKind(event.target.value as 'force' | 'mass')}><option value="force">Force [N]</option><option value="mass">Mass [kg]</option></select></div><NumberField label="Effective lever length [m]" value={path.conversion.leverLengthM ?? 0} onChange={value => updateConversion('leverLengthM', value)} /><NumberField label="Force/lever angle [°]" value={path.conversion.leverAngleDeg ?? 90} onChange={value => updateConversion('leverAngleDeg', value)} /><div><label className="form-label" htmlFor="direction">Direction of rotation</label><select id="direction" className="form-select" value={path.conversion.direction ?? 1} onChange={event => updateConversion('direction', Number(event.target.value))}><option value="1">Positive / clockwise</option><option value="-1">Negative / counter-clockwise</option></select></div>{path.conversion.leverInputKind === 'mass' && <NumberField label="Gravitational acceleration [m/s²]" value={path.conversion.gravityMs2 ?? 9.80665} onChange={value => updateConversion('gravityMs2', value)} />}<NumberField label="Tare / intrinsic torque [Nm]" value={path.conversion.tareTorqueNm ?? 0} onChange={value => updateConversion('tareTorqueNm', value)} /></div><p className="form-help">M = direction × reference force × lever length × sin(angle) + tare. For kg input, force is calculated first as F = m × g.</p></>}
            {path.conversion.mode === 'calibrated-signal' && <><div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label={`Zero signal [${path.conversion.referenceUnit}]`} value={path.conversion.zeroReferenceValue ?? 0} onChange={value => updateConversion('zeroReferenceValue', value)} /><NumberField label={`Target at zero signal [${path.conversion.targetUnit}]`} value={path.conversion.zeroTargetValue ?? 0} onChange={value => updateConversion('zeroTargetValue', value)} /><NumberField label={`Calibrated signal at rated value [${path.conversion.referenceUnit}]`} value={path.conversion.calibratedReferenceValue ?? 0} onChange={value => updateConversion('calibratedReferenceValue', value)} /><NumberField label={`Rated value [${path.conversion.targetUnit}]`} value={path.conversion.nominalTargetValue ?? 0} onChange={value => updateConversion('nominalTargetValue', value)} /></div><p className="form-help">The certified value remains exact. Example: 10.01 V corresponds to 200 Nm; with an easy-to-set 10.00 V input, the PC target is 199.8002 Nm.</p></>}
            {sensor.measurand === 'torque' ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><ReadOnlyValue label="Reference unit from test method" value={path.conversion.referenceUnit} /><ReadOnlyValue label="Target unit of measurement path" value={path.conversion.targetUnit} /></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Reference unit" value={path.conversion.referenceUnit} onChange={value => updateConversion('referenceUnit', value)} /><Field label="Target unit" value={path.conversion.targetUnit} onChange={value => updateConversion('targetUnit', value)} /></div>}
            <p className="mt-3 text-xs font-semibold text-amber-700">Changes to the test method or conversion are recorded as an amendment and require approval before official use.</p>
          </fieldset></details>
          <SerialField label="Reference serial number" value={referenceSerial} onChange={setReferenceSerial} />
      </section>

      <section className="card-flat"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Reference points</p><h2 className="section-title">{activeReferencePoints.length} values from top to bottom</h2></div><div className="flex flex-wrap gap-2"><button type="button" className="btn-tertiary" disabled={Boolean(bench.locked)} onClick={addReferencePoint}>Add point</button><button type="button" className="btn-tertiary" disabled={Boolean(bench.locked)} onClick={resetReferencePointsForRange}>Load default points</button></div></div><div className="mt-5 hidden grid-cols-[42px_minmax(180px,1fr)_32px_minmax(180px,1fr)_80px] gap-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400 md:grid"><span>#</span><span>Set reference</span><span></span><span>PC target value</span><span></span></div><div className="mt-2 space-y-2">{activeReferencePoints.map((value, index) => <div key={`${index}-${activeReferencePoints.length}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[42px_minmax(180px,1fr)_32px_minmax(180px,1fr)_80px] md:items-center"><strong className="text-sm text-slate-500">{index + 1}</strong><div className="relative"><label className="sr-only" htmlFor={`reference-point-${index}`}>Reference point {index + 1} in {path.conversion.referenceUnit}</label><input id={`reference-point-${index}`} type="number" step="any" className="form-input pr-16 font-mono font-bold" value={value} disabled={Boolean(bench.locked)} onChange={event => updateReferencePoint(index, Number(event.target.value))} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{path.conversion.referenceUnit}</span></div><span className="text-center text-slate-400">→</span><div className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono font-bold text-slate-800">{format(DataLoader.referenceToTarget(value, path.conversion))} <span className="text-xs font-normal text-slate-400">{path.conversion.targetUnit}</span></div><button type="button" className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:text-slate-300" disabled={activeReferencePoints.length <= 2 || Boolean(bench.locked)} onClick={() => removeReferencePoint(index)} aria-label={`Delete reference point ${index + 1}`}>Delete</button></div>)}</div></section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card-flat"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Test-bench-specific influences</p><h2 className="section-title">Additional measurement uncertainty</h2></div><button type="button" className="btn-tertiary whitespace-nowrap" disabled={Boolean(bench.locked)} onClick={addAdditionalUncertainty}>Add influence</button></div><p className="mt-2 text-sm leading-6 text-slate-600">Add only influences that are not already included in the catalog device, such as lever position, load angle, deflection, or special environmental conditions.</p><div className="mt-5 space-y-3">{(path.additionalUncertainties ?? []).map(item => <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_150px_auto]"><Field label="Label" value={item.label} disabled={Boolean(bench.locked)} onChange={value => updateAdditionalUncertainty(item.id, { label: value })} /><NumberField label="U [% FS]" value={item.expandedPercentFs} disabled={Boolean(bench.locked)} onChange={value => updateAdditionalUncertainty(item.id, { expandedPercentFs: value })} /><button type="button" className="btn-tertiary self-end text-rose-700" disabled={Boolean(bench.locked)} onClick={() => removeAdditionalUncertainty(item.id)}>Delete</button></div>)}{!(path.additionalUncertainties ?? []).length && <div className="empty-state">No additional influences. Only the fixed device and environmental contributions are used.</div>}</div></div>
        <div className="card-flat"><p className="eyebrow">Transparent calculation</p><h2 className="section-title">How the target value and uncertainty are calculated</h2><div className="mt-4 rounded-xl bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100"><div>{conversionFormula(path.conversion)}</div><div className="mt-2 text-blue-300">U = k × √(u₁² + u₂² + … + uₙ²)</div><div className="text-amber-300">TUR = UUT requirement ÷ calibration uncertainty</div></div>{activeUncertainty && activeTur && <><div className="mt-5 space-y-2">{activeUncertainty.components.map(component => <div key={component.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 pb-2 text-sm"><div><span className="font-semibold text-slate-700">{component.label}</span><span className="block text-xs text-slate-400">{component.source}</span></div><div className="text-right font-mono"><strong>±{format(component.expandedPercentFs)}%</strong><span className="block text-xs text-slate-400">u={format(component.standardPercentFs)}%</span></div></div>)}</div><div className={`mt-4 rounded-xl p-4 text-sm ${activeTur.passes ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}><div className="flex items-center justify-between gap-3"><span>UUT requirement</span><strong className="font-mono">±{format(activeTur.uutToleranceAbsolute)} {activeTur.unit}</strong></div><div className="mt-2 flex items-center justify-between gap-3"><span>Calibration uncertainty, k={activeUncertainty.coverageFactor}</span><strong className="font-mono">±{format(activeTur.calibrationUncertaintyAbsolute)} {activeTur.unit}</strong></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-current/20 pt-3"><span>TUR, required &gt; {activeTur.requiredRatio}</span><strong className="font-mono">{Number.isFinite(activeTur.ratio) ? format(activeTur.ratio) : '∞'} : 1</strong></div>{!activeTur.passes && <p className="mt-2 text-xs font-semibold">The measurement chain does not meet the required uncertainty ratio.</p>}</div><div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">{activeUncertainty.excludedNotes.map(note => <p key={note}>{note}</p>)}</div></>}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]"><div className="card-flat"><p className="eyebrow">Test plan and PC scaling</p><h2 className="section-title">{range.label}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><NumberField label={`Range from [${range.unit}]`} value={range.min} disabled={Boolean(bench.locked)} onChange={value => updateCurrentPath({ rangeMin: value })} /><NumberField label={`Range to [${range.unit}]`} value={range.max} disabled={Boolean(bench.locked)} onChange={value => updateCurrentPath({ rangeMax: value })} /><NumberField label="Tolerance [% FS]" value={path.tolerancePercent} disabled={Boolean(bench.locked)} onChange={value => updatePath('tolerancePercent', value)} /><NumberField label={`Display resolution [${range.unit}]`} value={path.displayResolution ?? DataLoader.getDefaultDisplayResolution(range)} disabled={Boolean(bench.locked)} onChange={value => updateCurrentPath({ displayResolution: value })} /><NumberField label="Current PC gain" value={path.pcGain ?? 1} disabled={Boolean(bench.locked)} onChange={value => updateCurrentPath({ pcGain: value })} /><NumberField label={`Current PC offset [${range.unit}]`} value={path.pcOffset ?? 0} disabled={Boolean(bench.locked)} onChange={value => updateCurrentPath({ pcOffset: value })} /></div><p className="form-help">PC display = raw value × gain + offset. These fields document the values currently configured in the test bench software; the results page calculates a new recommendation.</p></div><div className="card-flat"><p className="eyebrow">Operating mode and environment</p><div className="grid gap-2 sm:grid-cols-2"><ModeButton active={runMode === 'calibration'} onClick={() => setRunMode('calibration')}>Calibration</ModeButton><ModeButton active={runMode === 'simulation'} onClick={() => setRunMode('simulation')}>Simulation / test run</ModeButton></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><NumberField label="Sensor age [years]" value={sensorAgeYears} onChange={setSensorAgeYears} /><NumberField label="Ambient ΔT [K]" value={temperatureDeltaK} onChange={setTemperatureDeltaK} /><div><label className="form-label" htmlFor="distribution">Distribution</label><select id="distribution" className="form-select" value={distribution} onChange={event => setDistribution(event.target.value as UncertaintyDistribution)}><option value="normal">Normal</option><option value="rectangular">Rectangular</option></select></div></div></div></section>
    </>}

    <div className="pointer-events-none sticky bottom-4 z-10 flex justify-end"><div className="pointer-events-auto w-full rounded-xl sm:w-auto border border-slate-700 bg-slate-950 p-3 text-right shadow-2xl"><button type="button" onClick={start} disabled={!canStart} className="btn-primary w-full px-5 py-3 sm:w-auto sm:px-7">{runMode === 'simulation' ? (selectedPaths.length === 1 ? 'Simulate 1 measurement path' : `Simulate ${selectedPaths.length} measurement paths`) : (selectedPaths.length === 1 ? 'Calibrate 1 measurement path' : `Calibrate ${selectedPaths.length} measurement paths`)} →</button>{!canStart && <p className="mt-1.5 max-w-sm text-[11px] text-slate-400">{!technician.trim() ? 'Enter the responsible technician to continue.' : !governanceReady ? 'Lock the approved template or switch to simulation mode.' : 'Select at least one fully configured measurement path.'}</p>}</div></div>
  </div>;
};

const quantityLabel = (value: string) => ({ pressure: 'Pressure', temperature: 'Temperature', force: 'Force', torque: 'Torque', speed: 'Speed', flow: 'Flow', angle: 'Angle', voltage: 'Voltage', current: 'Current', electrical: 'Electrical' }[value] ?? value);
type EquipmentSerialKind = 'sensor' | 'amplifier' | 'reference' | 'daq';
const equipmentSerialKey = (kind: EquipmentSerialKind, path: MeasurementPath) => {
  if (kind === 'sensor') return `sensor:${path.physicalSensorId ?? path.sensorBmk}`;
  if (kind === 'amplifier') return `amplifier:${path.amplifierId}:${path.amplifierBmk}`;
  if (kind === 'reference') return `reference:${path.referenceId}`;
  return `daq:${path.dataAcquisitionId}:${path.dataAcquisitionBmk ?? 'unknown'}`;
};
const roundReferenceValue = (value: number) => Number(value.toFixed(9));
const resolveRange = (range: import('../types').MeasurementRange | undefined, path?: MeasurementPath) => {
  if (!range || !path || !Number.isFinite(path.rangeMin) || !Number.isFinite(path.rangeMax) || path.rangeMax! <= path.rangeMin!) return range;
  const min = path.rangeMin!;
  const max = path.rangeMax!;
  return { ...range, min, max, span: max - min, label: `${format(min)} … ${format(max)} ${range.unit} · ${quantityLabel(path.measurand)}` };
};
const hasInvalidRangeOverride = (path: MeasurementPath) => Number.isFinite(path.rangeMin) && Number.isFinite(path.rangeMax) && path.rangeMax! <= path.rangeMin!;
const hasInvalidAdditionalUncertainty = (path: MeasurementPath) => (path.additionalUncertainties ?? []).some(item => !item.label.trim() || !Number.isFinite(item.expandedPercentFs) || item.expandedPercentFs < 0);
const format = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(value);
const ModeButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>{children}</button>;
const MeasurementPathRow = ({ item, checked, active, onToggle, onEdit }: { item: MeasurementPath; checked: boolean; active: boolean; onToggle: (checked: boolean) => void; onEdit: () => void }) => <div className={`grid gap-3 rounded-xl border p-3 transition sm:grid-cols-[auto_1fr_auto] sm:items-center ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={checked} onChange={event => onToggle(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span>Calibrate</span></label><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{item.name}</strong><span className="mt-0.5 block text-xs text-slate-500">Sensor: {item.physicalSensorName ?? item.sensorModel} · {quantityLabel(item.measurand)} · Equipment ID {item.sensorBmk}</span></div><button type="button" onClick={onEdit} aria-pressed={active} className={active ? 'btn-primary px-3 py-2 text-xs' : 'btn-tertiary px-3 py-2 text-xs'}>{active ? 'Editing' : 'Edit'}</button></div>;
const MethodButton = ({ active, title, note, onClick, disabled = false }: { active: boolean; title: string; note: string; onClick: () => void; disabled?: boolean }) => <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}><strong className={active ? 'text-blue-800' : 'text-slate-800'}>{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{note}</span></button>;
const conversionFormula = (conversion: ReferenceConversion) => {
  if (conversion.mode === 'identity') return `Target [${conversion.targetUnit}] = reference [${conversion.referenceUnit}]`;
  if (conversion.mode === 'linear') return `Target = reference × ${format(conversion.factor)} ${conversion.offset >= 0 ? '+' : '−'} ${format(Math.abs(conversion.offset))}`;
  if (conversion.mode === 'load-cell') return `Force = (Signal − ${format(conversion.zeroReferenceValue ?? 0)}) ÷ ${format(conversion.sensitivityMvV ?? 0)} × ${format(conversion.ratedForceN ?? 0)} N`;
  if (conversion.mode === 'pulse-flow') return `Flow = frequency × ${format(conversion.pulseVolumeCm3 ?? 0)} cm³/pulse × 60 ÷ 1,000`;
  if (conversion.mode === 'torque-lever') return `M = ${conversion.direction ?? 1} × ${conversion.leverInputKind === 'mass' ? 'mass × g × ' : 'force × '}${format(conversion.leverLengthM ?? 0)} m × sin(${format(conversion.leverAngleDeg ?? 90)}°) + ${format(conversion.tareTorqueNm ?? 0)} Nm`;
  return `Target = ${format(conversion.zeroTargetValue ?? 0)} + (signal − ${format(conversion.zeroReferenceValue ?? 0)}) × (${format(conversion.nominalTargetValue ?? 0)} − ${format(conversion.zeroTargetValue ?? 0)}) ÷ (${format(conversion.calibratedReferenceValue ?? 0)} − ${format(conversion.zeroReferenceValue ?? 0)})`;
};
const DeviceCard = ({ index, title, children }: { index: string; title: string; children: ReactNode }) => <div className="card-flat"><p className="eyebrow">{index}</p><h2 className="section-title mb-4">{title}</h2>{children}</div>;
const DatabaseSpecs = ({ source, items }: { source: import('../types').DatasheetSource; items: Array<[string, string]> }) => <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Catalog values · read-only</span><span className={source.status === 'manufacturer' ? 'status-success' : 'status-warning'}>{source.status === 'manufacturer' ? 'Datasheet' : 'Internal'}</span></div><div className="mt-3 space-y-1.5">{items.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><strong className="text-right text-slate-800">{value}</strong></div>)}</div>{source.url && <a className="mt-3 inline-block text-xs font-semibold text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">Open source</a>}</div>;
const Field = ({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) => <label className="block"><span className="form-label">{label}</span><input className="form-input" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
const ReadOnlyValue = ({ label, value }: { label: string; value: string }) => <div><span className="form-label">{label}</span><div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">{value}</div></div>;
const SerialField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label className="mt-4 block"><span className="form-label">{label}</span><input className="form-input" value={value} onChange={event => onChange(event.target.value)} placeholder="optional" /></label>;
const NumberField = ({ label, value, onChange, className = '', disabled = false }: { label: string; value: number; onChange: (value: number) => void; className?: string; disabled?: boolean }) => <label className={`block ${className}`}><span className="form-label">{label}</span><input type="number" step="any" className="form-input" value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} /></label>;

const formatGovernanceDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default CalibrationSetup;
