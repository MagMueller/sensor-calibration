// import { Activity, BarChart3, Home, Settings } from 'lucide-react';

interface HeaderProps {
  currentStep: 'dashboard' | 'setup' | 'calibration' | 'results';
  canAccessSteps: {
    setup: boolean;
    calibration: boolean;
    results: boolean;
  };
  onNavigateToDashboard: () => void;
  onNavigateToSetup: () => void;
  onNavigateToCalibration: () => void;
  onNavigateToResults: () => void;
}

const Header = ({ 
  currentStep, 
  canAccessSteps, 
  onNavigateToDashboard, 
  onNavigateToSetup, 
  onNavigateToCalibration, 
  onNavigateToResults 
}: HeaderProps) => {
  const getStepIcon = () => {
    switch (currentStep) {
      case 'dashboard':
        return <span className="w-5 h-5 text-lg">🏠</span>;
      case 'setup':
        return <span className="w-5 h-5 text-lg">⚙️</span>;
      case 'calibration':
        return <span className="w-5 h-5 text-lg">📊</span>;
      case 'results':
        return <span className="w-5 h-5 text-lg">📈</span>;
      default:
        return <span className="w-5 h-5 text-lg">🏠</span>;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'dashboard':
        return 'Dashboard';
      case 'setup':
        return 'Kalibrierung einrichten';
      case 'calibration':
        return 'Kalibrierung durchführen';
      case 'results':
        return 'Ergebnisse';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onNavigateToDashboard}
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors"
            >
              <span className="w-8 h-8 text-2xl">🎯</span>
              <span className="text-xl font-bold">Kalibrierungs-App</span>
            </button>
            
            <div className="h-6 w-px bg-gray-300" />
            
            <div className="flex items-center space-x-2 text-gray-600">
              {getStepIcon()}
              <span className="font-medium">{getStepTitle()}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">System bereit</span>
            </div>
          </div>
        </div>

        {/* Interactive Navigation */}
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            {/* Dashboard */}
            <button
              onClick={onNavigateToDashboard}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentStep === 'dashboard' 
                  ? 'bg-primary-600 shadow-lg' 
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              title="Dashboard"
            />
            <div className="w-8 h-px bg-gray-300" />
            
            {/* Setup */}
            <button
              onClick={onNavigateToSetup}
              disabled={!canAccessSteps.setup}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentStep === 'setup' 
                  ? 'bg-primary-600 shadow-lg' 
                  : canAccessSteps.setup 
                    ? 'bg-gray-300 hover:bg-gray-400 cursor-pointer' 
                    : 'bg-gray-200 cursor-not-allowed'
              }`}
              title="Kalibrierung einrichten"
            />
            <div className="w-8 h-px bg-gray-300" />
            
            {/* Calibration */}
            <button
              onClick={onNavigateToCalibration}
              disabled={!canAccessSteps.calibration}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentStep === 'calibration' 
                  ? 'bg-primary-600 shadow-lg' 
                  : canAccessSteps.calibration 
                    ? 'bg-gray-300 hover:bg-gray-400 cursor-pointer' 
                    : 'bg-gray-200 cursor-not-allowed'
              }`}
              title="Kalibrierung durchführen"
            />
            <div className="w-8 h-px bg-gray-300" />
            
            {/* Results */}
            <button
              onClick={onNavigateToResults}
              disabled={!canAccessSteps.results}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                currentStep === 'results' 
                  ? 'bg-primary-600 shadow-lg' 
                  : canAccessSteps.results 
                    ? 'bg-gray-300 hover:bg-gray-400 cursor-pointer' 
                    : 'bg-gray-200 cursor-not-allowed'
              }`}
              title="Ergebnisse anzeigen"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={onNavigateToDashboard}
              className="text-xs text-gray-600 hover:text-primary-600 transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={onNavigateToSetup}
              disabled={!canAccessSteps.setup}
              className={`text-xs transition-colors ${
                canAccessSteps.setup 
                  ? 'text-gray-600 hover:text-primary-600' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Setup
            </button>
            <button
              onClick={onNavigateToCalibration}
              disabled={!canAccessSteps.calibration}
              className={`text-xs transition-colors ${
                canAccessSteps.calibration 
                  ? 'text-gray-600 hover:text-primary-600' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Messung
            </button>
            <button
              onClick={onNavigateToResults}
              disabled={!canAccessSteps.results}
              className={`text-xs transition-colors ${
                canAccessSteps.results 
                  ? 'text-gray-600 hover:text-primary-600' 
                  : 'text-gray-400 cursor-not-allowed'
              }`}
            >
              Ergebnis
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 