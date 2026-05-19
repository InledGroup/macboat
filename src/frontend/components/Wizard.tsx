import { useStore } from '@nanostores/preact';
import { step, systemStatus, config, logs, isInstalling, isDetected, progress, language, currentStage, showViewer, isFullScreen, hasAcceptedLegal, isLegalRejected } from '../store';
import { useEffect, useRef, useState } from 'preact/hooks';
import { translations } from '../translations';

export default function Wizard() {
  const $step = useStore(step);
  const $systemStatus = useStore(systemStatus);
  const $config = useStore(config);
  const $logs = useStore(logs);
  const $isInstalling = useStore(isInstalling);
  const $isDetected = useStore(isDetected);
  const $progress = useStore(progress);
  const $lang = useStore(language);
  const $stage = useStore(currentStage);
  const $showViewer = useStore(showViewer);
  const $isFullScreen = useStore(isFullScreen);
  const $hasAcceptedLegal = useStore(hasAcceptedLegal);
  const $isLegalRejected = useStore(isLegalRejected);
  const t = translations[$lang];
  const logRef = useRef<HTMLPreElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    // Check system requirements and existing image on load
    const init = async () => {
      try {
        // @ts-ignore
        const status = await window.electron.checkSystem();
        systemStatus.set(status);

        if (status) {
          const recRAM = Math.min(8, Math.floor(status.totalMemory - 4));
          const recCores = Math.floor(status.totalCores);
          config.set({
            ...$config,
            ramSize: `${Math.max(4, recRAM)}G`,
            cpuCores: recCores,
            diskSize: '128G'
          });
        }

        // @ts-ignore
        const exists = await window.electron.checkExistingImage();
        isDetected.set(exists);
        
        // If detected and we are on start, show Play screen
        if (exists && $step === 1) {
          step.set(1);
        }
      } catch (e) {
        console.error('Wizard init error:', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    // @ts-ignore
    const unsubscribe = window.electron.onDockerLogs((newLog: string) => {
      logs.set(logs.get() + newLog);
      
      const percentMatch = newLog.match(/(\d+)%/);
      if (percentMatch && percentMatch[1]) {
        progress.set(parseInt(percentMatch[1]));
      }

      if (newLog.includes('Starting macOS for Docker')) {
        currentStage.set(t.bootStage1);
        if (progress.get() < 5) progress.set(5);
      }
      if (newLog.includes('Building boot image')) {
        currentStage.set(t.bootStage2);
        if (progress.get() < 15) progress.set(15);
      }
      if (newLog.includes('Booting macOS using QEMU')) {
        currentStage.set(t.bootStage3);
        if (progress.get() < 30) progress.set(30);
      }
      if (newLog.includes('HANDOFF TO XNU')) {
        currentStage.set(t.bootStage4);
        if (progress.get() < 60) progress.set(60);
      }
      if (newLog.includes('End of efiboot serial output')) {
        currentStage.set(t.bootStage5);
        if (progress.get() < 90) progress.set(90);
        showViewer.set(true);
      }

      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });

    return () => unsubscribe();
  }, [$lang]);

  useEffect(() => {
    // Refresh iframe if it fails to load initially
    if ($showViewer) {
      const timer = setInterval(() => {
        const iframe = document.querySelector('.macos-iframe') as HTMLIFrameElement;
        if (iframe && (!iframe.contentDocument || iframe.contentDocument.body.innerHTML === "")) {
          setIframeKey(prev => prev + 1);
        }
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [$showViewer]);

  const addFolder = async () => {
    // @ts-ignore
    const path = await window.electron.selectFolder();
    if (path) {
      const containerPath = `/shared/${path.split('/').pop()}`;
      config.set({
        ...$config,
        sharedFolders: [...$config.sharedFolders, { hostPath: path, containerPath }]
      });
    }
  };

  const startInstall = async () => {
    step.set(5); 
    isInstalling.set(true);
    showViewer.set(false);
    isFullScreen.set(false);
    currentStage.set(t.bootStage1);
    logs.set('');
    progress.set(0);
    
    try {
      // @ts-ignore
      await window.electron.startMacOS({
        ...$config,
      });
    } catch (error) {
      logs.set(logs.get() + '\n' + t.fatalError + error + '\n');
      isInstalling.set(false);
    }
  };

  const stopInstall = async () => {
    try {
      // @ts-ignore
      await window.electron.stopMacOS();
      isInstalling.set(false);
      showViewer.set(false);
      isFullScreen.set(false);
      logs.set(logs.get() + '\n' + t.stoppedByUser + '\n');
    } catch (error) {
      console.error('Error al detener:', error);
    }
  };

  const exitInstall = () => {
    stopInstall();
    step.set(1);
    isInstalling.set(false);
    logs.set('');
    progress.set(0);
  };

  const toggleFullScreen = () => {
    isFullScreen.set(!$isFullScreen);
  };

  const allRequirementsMet = $systemStatus && 
    $systemStatus.dockerInstalled && 
    $systemStatus.dockerRunning && 
    !$systemStatus.isDockerDesktop &&
    $systemStatus.userInDockerGroup;

  const Spinner = () => (
    <div class="macos-overlay">
      <div class="spinner">
        {[...Array(12)].map((_, i) => (
          <div key={i} class="spinner-blade"></div>
        ))}
      </div>
      <div class="boot-status-text">{$stage || t.booting}</div>
      <button onClick={() => showViewer.set(true)} class="button-secondary-pill" style={{marginTop: '40px', color: 'white', borderColor: 'white', opacity: 0.6}}>
        {t.viewMacos} (Debug)
      </button>
    </div>
  );

  const maxRAM = $systemStatus ? $systemStatus.totalMemory - 1 : 12;
  const maxCores = $systemStatus ? $systemStatus.totalCores : 4;
  const recRAM = $systemStatus ? Math.min(8, Math.floor($systemStatus.totalMemory - 4)) : 6;
  const recCores = $systemStatus ? Math.floor($systemStatus.totalCores) : 4;

  if ($isLegalRejected) {
    return (
      <div class="wizard-container">
        <section class="tile product-tile-light main-step" style={{ borderTop: '4px solid #ff3b30' }}>
          <h1 class="display-lg text-ink" style={{ color: '#ff3b30' }}>{t.legalRequired}</h1>
          <p class="body" style={{ margin: '30px 0', fontSize: '18px' }}>{t.legalRequiredBody}</p>
          <div class="actions">
            <button onClick={() => isLegalRejected.set(false)} class="button-secondary-pill">{t.backToLegal}</button>
          </div>
        </section>
      </div>
    );
  }

  if (!$hasAcceptedLegal) {
    return (
      <div class="wizard-container">
        <section class="tile product-tile-light main-step">
          <h1 class="display-lg text-ink">{t.legalTitle}</h1>
          <div style={{ backgroundColor: '#f5f5f7', padding: '30px', borderRadius: '12px', margin: '30px 0', textAlign: 'left', lineHeight: '1.6' }}>
            <p class="body">{t.legalBody}</p>
          </div>
          <div class="actions" style={{ gap: '20px' }}>
            <button onClick={() => isLegalRejected.set(true)} class="button-secondary-pill">{t.cancel}</button>
            <button onClick={() => hasAcceptedLegal.set(true)} class="button-primary">{t.accept}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div class="wizard-container">
      {!$isFullScreen && (
        <div class="language-selector">
          <button onClick={() => language.set('es')} class={$lang === 'es' ? 'active' : ''}>ES</button>
          <button onClick={() => language.set('en')} class={$lang === 'en' ? 'active' : ''}>EN</button>
        </div>
      )}

      {$step === 1 && (
        <section class="tile product-tile-light main-step">
          <img src="/macboat.png" alt="MacBoat Logo" class="app-logo" />
          
          {$isDetected ? (
            <div class="play-screen" style={{ textAlign: 'center' }}>
              <h1 class="display-lg">{t.welcome}</h1>
              <p class="lead" style={{ marginBottom: '40px' }}>{t.alreadyInstalledDesc}</p>
              
              <div class="play-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => { step.set(3); }} class="button-primary" style={{ width: '100px', height: '100px', borderRadius: '50%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 15px 40px rgba(0,102,204,0.4)', transition: 'transform 0.2s' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                    <span class="caption" style={{ fontWeight: '700', fontSize: '16px', color: 'var(--color-primary)' }}>{t.startMacos}</span>
                  </div>
                </div>
                
                <button onClick={() => { isDetected.set(false); step.set(1); }} class="button-secondary-pill" style={{ marginTop: '30px', fontSize: '14px' }}>
                  {t.newInstall}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 class="display-lg">{t.welcome}</h1>
              <p class="lead">{t.tagline}</p>
              
              <div class="checklist">
                {!$systemStatus ? (
                  <div class="spinner" style={{ fontSize: '32px' }}>
                    {[...Array(12)].map((_, i) => (
                      <div key={i} class="spinner-blade"></div>
                    ))}
                  </div>
                ) : (
                  <div class="checklist-items">
                    <div class={`check-item ${$systemStatus.dockerInstalled ? 'ok' : 'fail'}`}>
                      {$systemStatus.dockerInstalled ? '✓' : '✗'} {t.dockerInstalled}
                    </div>
                    <div class={`check-item ${$systemStatus.dockerRunning ? 'ok' : 'fail'}`}>
                      {$systemStatus.dockerRunning ? '✓' : '✗'} {t.dockerRunning}
                    </div>
                    <div class={`check-item ${!$systemStatus.isDockerDesktop ? 'ok' : 'fail'}`}>
                      {!$systemStatus.isDockerDesktop ? '✓' : '✗'} {t.nativeDocker}
                    </div>
                    <div class={`check-item ${$systemStatus.userInDockerGroup ? 'ok' : 'fail'}`}>
                      {$systemStatus.userInDockerGroup ? '✓' : '✗'} {t.dockerGroup}
                    </div>
                    <div class={`check-item ${$systemStatus.kvmSupported ? 'ok' : 'warn'}`}>
                      {$systemStatus.kvmSupported ? '✓' : '⚠'} {t.kvm}
                    </div>
                    
                    <div class="actions" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                      <button 
                        onClick={() => { step.set(2); }} 
                        class="button-primary" 
                        disabled={!allRequirementsMet}
                        style={{ opacity: allRequirementsMet ? 1 : 0.5 }}
                      >
                        {t.continue}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {$step === 2 && (
        <section class="tile product-tile-parchment main-step">
          <h1 class="display-lg">{t.chooseVersion}</h1>
          <div class="version-grid">
            {['15', '14', '13', '12', '11'].map(v => (
              <div 
                class={`version-card ${$config.version === v ? 'selected' : ''}`}
                onClick={() => config.set({ ...$config, version: v })}
              >
                <span class="tagline">macOS {v}</span>
              </div>
            ))}
          </div>
          <div class="actions">
            <button onClick={() => step.set(1)} class="button-secondary-pill">{t.back}</button>
            <button onClick={() => {
                step.set(3);
            }} class="button-primary">{t.continue}</button>
          </div>
        </section>
      )}

      {$step === 3 && (
        <section class="tile product-tile-light main-step">
          <h1 class="display-lg">{t.configureHardware}</h1>
          <p class="body" style={{ marginBottom: '20px' }}>{t.performanceNote}</p>
          
          <div class="resource-grid">
            <div class="resource-item">
              <div class="resource-label">
                <span>{t.ramSize} <span class="recommendation-tag">{t.recommended}: {recRAM}G</span></span>
                <span class="resource-value">{$config.ramSize}</span>
              </div>
              <input 
                type="range" min="2" max={maxRAM} step="1" 
                value={parseInt($config.ramSize)} 
                onChange={(e) => config.set({ ...$config, ramSize: (e.target as HTMLInputElement).value + 'G' })}
                class="resource-slider"
              />
            </div>

            <div class="resource-item">
              <div class="resource-label">
                <span>{t.cpuCores} <span class="recommendation-tag">{t.recommended}: {recCores}</span></span>
                <span class="resource-value">{$config.cpuCores}</span>
              </div>
              <input 
                type="range" min="1" max={maxCores} step="1" 
                value={$config.cpuCores} 
                onChange={(e) => config.set({ ...$config, cpuCores: parseInt((e.target as HTMLInputElement).value) })}
                class="resource-slider"
              />
            </div>

            <div class="resource-item">
              <div class="resource-label">
                <span>{t.diskSize} <span class="recommendation-tag">{t.recommended}: 128G</span></span>
                <span class="resource-value">{$config.diskSize}</span>
              </div>
              <input 
                type="range" min="32" max="512" step="32" 
                value={parseInt($config.diskSize)} 
                onChange={(e) => config.set({ ...$config, diskSize: (e.target as HTMLInputElement).value + 'G' })}
                class="resource-slider"
              />
            </div>
          </div>

          <div class="actions">
            <button onClick={() => step.set($isDetected ? 1 : 2)} class="button-secondary-pill">{t.back}</button>
            <button onClick={() => step.set(4)} class="button-primary">{t.continue}</button>
          </div>
        </section>
      )}

      {$step === 4 && (
        <section class="tile product-tile-light main-step">
          <h1 class="display-lg">{t.sharedFolders}</h1>
          <p class="body">{t.sharedFoldersDesc}</p>
          <div class="folder-list">
            {$config.sharedFolders.map(f => (
              <div class="folder-item">{f.hostPath} ➔ {f.containerPath}</div>
            ))}
          </div>
          <button onClick={addFolder} class="button-pearl-capsule">{t.addFolder}</button>
          <div class="actions">
            <button onClick={() => step.set(3)} class="button-secondary-pill">{t.back}</button>
            <button onClick={() => startInstall()} class="button-primary">{t.installBtn}</button>
          </div>
        </section>
      )}

      {$step === 5 && (
        <section class={`tile ${$showViewer ? 'product-tile-light' : 'product-tile-dark'} main-step`} style={{ position: 'relative', padding: $isFullScreen ? '0' : '' }}>
          {$isInstalling && !$showViewer && <Spinner />}

          {!$isFullScreen && (
            <div class="install-header">
              <h1 class={`display-lg ${$showViewer ? 'text-ink' : 'text-white'}`}>{$stage || t.preparing}</h1>
              {!$showViewer && <p class="lead-airy text-muted">{t.preparingDesc}</p>}
            </div>
          )}

          {!$showViewer ? (
            <>
              <div class="install-status">
                <div class="progress-container">
                  <div class="progress-bar" style={{ width: `${$progress}%` }}></div>
                </div>
                <div class="status-meta">
                  <span class="caption text-white">{$progress}% {t.completed}</span>
                </div>
              </div>

              <div class="log-container">
                <pre ref={logRef} class="log-viewer">{$logs || '...'}</pre>
              </div>
            </>
          ) : (
            <div class={`viewer-container ${$isFullScreen ? 'full-screen' : ''}`}>
              <iframe key={iframeKey} src="http://localhost:8006/?autoconnect=1&resize=scale" class="macos-iframe"></iframe>
              <button onClick={toggleFullScreen} class="fullscreen-toggle">
                {$isFullScreen ? t.exitFullScreen : t.fullScreen}
              </button>
            </div>
          )}
          
          {!$isFullScreen && (
            <div class="viewer-actions">
              { $showViewer && (
                <a href="http://localhost:8006" target="_blank" class="button-primary" style={{textDecoration: 'none'}}>
                  {t.openBrowser}
                </a>
              )}
              <button onClick={stopInstall} class="button-secondary-pill" style={{borderColor: '#ff3b30', color: '#ff3b30'}}>
                {t.pause}
              </button>
              <button onClick={exitInstall} class="button-secondary-pill">
                {t.exit}
              </button>
            </div>
          )}

          {!$showViewer && !$isFullScreen && (
            <div class="install-footer">
              <p class="fine-print text-muted">{t.stableConn}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
