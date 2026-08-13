interface HeaderProps {
  currentStep: 'overview' | 'setup' | 'calibration' | 'results';
  canAccessSteps: { setup: boolean; calibration: boolean; results: boolean };
  onNavigateToOverview: () => void;
  onNavigateToSetup: () => void;
  onNavigateToCalibration: () => void;
  onNavigateToResults: () => void;
}

const steps = [
  { id: 'setup', short: 'Setup', label: 'Measurement chain' },
  { id: 'calibration', short: 'Measure', label: 'Measurement points' },
  { id: 'results', short: 'Results', label: 'Evaluation' }
] as const;

const Header = ({ currentStep, canAccessSteps, onNavigateToOverview, onNavigateToSetup, onNavigateToCalibration, onNavigateToResults }: HeaderProps) => {
  const actions = {
    setup: onNavigateToSetup,
    calibration: onNavigateToCalibration,
    results: onNavigateToResults
  };
  const enabled = {
    setup: canAccessSteps.setup,
    calibration: canAccessSteps.calibration,
    results: canAccessSteps.results
  };
  const currentIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <header className="app-header">
      <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <button onClick={onNavigateToOverview} className="flex shrink-0 items-center gap-3 text-left" aria-label="Go to test bench overview">
            <span className="app-brand-mark"><span className="sr-only">Calibration Studio</span></span>
            <span className="hidden sm:block">
              <span className="block text-sm font-extrabold tracking-tight text-white sm:text-base">Calibration Studio</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:block">Measurement control</span>
            </span>
          </button>

          <nav aria-label="Calibration steps" className="app-nav">
            <button type="button" onClick={onNavigateToOverview} aria-current={currentStep === 'overview' ? 'page' : undefined} className={`app-nav-button ${currentStep === 'overview' ? 'app-nav-button-active' : ''}`}><span className="app-nav-number">⌂</span><span className="hidden sm:block">Benches</span></button>
            {steps.map((step, index) => {
              const isEnabled = enabled[step.id];
              const isActive = currentStep === step.id;
              const isComplete = index < currentIndex;
              return (
                  <button key={step.id}
                    onClick={actions[step.id]}
                    disabled={!isEnabled}
                    aria-current={isActive ? 'step' : undefined}
                    className={`app-nav-button ${isActive ? 'app-nav-button-active' : ''} ${isComplete ? 'app-nav-button-complete' : ''}`}
                  >
                    <span className="app-nav-number">
                      {isComplete ? '✓' : index + 1}
                    </span>
                    <span className="hidden sm:block"><span className="block">{step.short}</span><span className="hidden text-[9px] font-medium text-slate-500 lg:block">{step.label}</span></span>
                  </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
