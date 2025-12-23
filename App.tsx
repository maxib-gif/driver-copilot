import React, { useState, useEffect, useRef } from 'react';
import { UserSettings, AnalysisResult, CalculatedMetrics } from './types';
import { analyzeScreenshot } from './services/geminiService';
import { SettingsPanel } from './components/SettingsPanel';
import { ResultDisplay } from './components/ResultDisplay';

const DEFAULT_SETTINGS: UserSettings = {
  minRatePerKm: 1000,
  maxTotalKm: 20,
};

function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [metrics, setMetrics] = useState<CalculatedMetrics | null>(null);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastProcessedOffer, setLastProcessedOffer] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("Listo para iniciar");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Load settings & Setup Install Prompt
  useEffect(() => {
    const saved = localStorage.getItem('driverCopilotSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('driverCopilotSettings', JSON.stringify(settings));
    if (currentResult) {
      recalculateMetrics(currentResult, settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  };

  const recalculateMetrics = (result: AnalysisResult, currentSettings: UserSettings) => {
    if (!result.valid) return null;

    const ratePerKm = result.totalPrice / (result.totalKm || 1);
    const ratePerHour = (result.totalPrice / (result.totalTimeMinutes || 1)) * 60;
    
    const isRateGood = ratePerKm >= currentSettings.minRatePerKm;
    const isDistanceGood = result.totalKm <= currentSettings.maxTotalKm;
    const isOverallGood = isRateGood && isDistanceGood;

    const newMetrics = {
      ratePerKm,
      ratePerHour,
      isRateGood,
      isDistanceGood,
      isOverallGood
    };

    setMetrics(newMetrics);
    return newMetrics;
  };

  const sendNotification = (result: AnalysisResult, metrics: CalculatedMetrics) => {
    if (Notification.permission === "granted") {
      const title = metrics.isOverallGood ? "✅ VIAJE RENTABLE" : "❌ NO RECOMENDADO";
      const body = `${result.currency}${result.totalPrice} | ${result.totalKm}km | ${result.currency}${metrics.ratePerKm.toFixed(0)}/km`;
      
      new Notification(title, {
        body: body,
        icon: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
        tag: "driver-copilot-alert"
      });
    }
  };

  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          displaySurface: "monitor"
        }, 
        audio: false 
      });
      
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      stream.getVideoTracks()[0].onended = () => {
        stopMonitoring();
      };

      setIsMonitoring(true);
      setStatusMessage("Escaneando pantalla...");
      
      intervalRef.current = window.setInterval(captureAndAnalyze, 5000);

    } catch (err) {
      console.error("Error starting screen share:", err);
      setStatusMessage("Error: Permisos denegados.");
    }
  };

  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsMonitoring(false);
    setStatusMessage("Monitor detenido");
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Check if video is actually playing (not paused by backgrounding)
    if (video.paused || video.ended) {
      setStatusMessage("⚠️ Pausado por sistema. Usa Pantalla Dividida.");
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64String = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    
    try {
      const result = await analyzeScreenshot(base64String);
      
      if (result.valid) {
        const offerId = `${result.totalPrice}-${result.totalKm}-${result.totalTimeMinutes}`;
        
        if (offerId !== lastProcessedOffer) {
          setCurrentResult(result);
          const calculated = recalculateMetrics(result, settings);
          if (calculated) {
            sendNotification(result, calculated);
          }
          setLastProcessedOffer(offerId);
          setStatusMessage(`✅ Oferta: ${result.currency}${result.totalPrice}`);
        } else {
           setStatusMessage("👀 Esperando nueva oferta...");
        }
      } else {
        // Just searching silently or minimal update
      }
    } catch (e) {
      console.error(e);
      // Fail silently to keep UI clean
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Hidden elements for capture */}
      <video ref={videoRef} className="hidden" muted playsInline></video>
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg transition-colors duration-300 ${isMonitoring ? 'bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.5)]' : 'bg-blue-600'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">DriverCopilot</h1>
          </div>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors border border-slate-700"
          >
            {isSettingsOpen ? 'Ocultar' : 'Ajustes'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 max-w-md mx-auto w-full flex flex-col gap-6">
        
        {/* Settings Panel */}
        <SettingsPanel 
          settings={settings} 
          onSettingsChange={setSettings} 
          isOpen={isSettingsOpen}
          toggleOpen={() => setIsSettingsOpen(!isSettingsOpen)}
        />
        
        {/* Install Button (Visible only if installable) */}
        {installPrompt && (
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-4 rounded-xl border border-blue-700 flex justify-between items-center shadow-lg animate-fadeIn">
            <div>
              <h3 className="font-bold text-blue-100">Instalar App</h3>
              <p className="text-xs text-blue-300">Descarga para acceso rápido</p>
            </div>
            <button 
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Descargar
            </button>
          </div>
        )}

        {/* Live Monitor Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl relative overflow-hidden group">
           
           {/* Active Scanning Visual Effect */}
           {isMonitoring && (
             <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
                <div className="w-full h-1/2 bg-gradient-to-b from-emerald-500/0 to-emerald-500/10 animate-scan border-b border-emerald-500/30"></div>
             </div>
           )}

           <div className="mb-4 relative z-10">
             <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${isMonitoring ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 text-slate-400'}`}>
               {statusMessage}
             </span>
           </div>

           {!isMonitoring ? (
             <button 
               onClick={startMonitoring}
               className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 transform active:scale-[0.98]"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
                INICIAR MONITOR
             </button>
           ) : (
             <button 
               onClick={stopMonitoring}
               className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-3 transform active:scale-[0.98] relative z-10"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
                DETENER
             </button>
           )}

           <div className="mt-4 text-left bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
             <p className="text-xs text-slate-400 leading-relaxed flex gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-yellow-500 flex-shrink-0">
                 <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
               </svg>
               <span>
                 Si minimizas la app, usa <strong>Pantalla Dividida</strong> para que siga analizando en tiempo real.
               </span>
             </p>
           </div>
        </div>

        {/* Results */}
        {currentResult && metrics && currentResult.valid && (
          <div className="animate-slideUp">
            <h3 className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-3 ml-1 flex justify-between items-end">
              <span>Último Análisis</span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {Math.floor(Date.now() / 1000).toString().slice(-4)}</span>
            </h3>
            <ResultDisplay result={currentResult} metrics={metrics} settings={settings} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
