import { useStore } from '@nanostores/preact';
import { step, systemStatus, config, logs, isInstalling, isDetected, detectedVMs, progress, language, currentStage, showViewer, isFullScreen, hasAcceptedLegal, isLegalRejected } from '../store';
import { useEffect, useRef, useState } from 'preact/hooks';
import { translations } from '../translations';

export default function Wizard() {
  const $step = useStore(step);
  const $systemStatus = useStore(systemStatus);
  const $config = useStore(config);
  const $logs = useStore(logs);
  const $isInstalling = useStore(isInstalling);
  const $isDetected = useStore(isDetected);
  const $vms = useStore(detectedVMs);
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

      refreshVMs();
      
    } catch (e) {
      console.error('Wizard init error:', e);
    }
  };

  const refreshVMs = async () => {
    // @ts-ignore
    const vms = await window.electron.checkExistingImage();
    detectedVMs.set(vms);
    isDetected.set(vms.length > 0);
  };

  useEffect(() => {
    init();
  }, []);

  const deleteVM = async (version: string) => {
    // @ts-ignore
    const result = await window.electron.deleteVM(version);
    if (result && result.ok) {
      refreshVMs();
    }
  };

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

  const startInstall = async (existingConfig?: any) => {
    // Detectar si es una VM nueva o incompleta para mostrar ayuda
    const targetVM = $vms.find(vm => vm.version === (existingConfig?.version || $config.version));
    const isNew = !targetVM || !targetVM.hasData;

    step.set(5); 
    isInstalling.set(true);
    showViewer.set(false);
    isFullScreen.set(false);
    currentStage.set(t.bootStage1);
    logs.set('');
    progress.set(0);
    
    try {
      const runConfig = existingConfig || { ...$config };
      // @ts-ignore
      await window.electron.startMacOS(runConfig);

      // Si es una instalación nueva, abrir ayuda automáticamente
      if (isNew) {
        // @ts-ignore
        window.electron.openHelp($lang);
      }
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
          <img src="macboat.png" alt="MacBoat Logo" class="app-logo" />
          <h1 class="display-lg">{t.welcome}</h1>
          
          {$isDetected ? (
            <div class="vm-dashboard" style={{ width: '100%', marginTop: '30px' }}>
              <div class="vm-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {$vms.map(vm => (
                  <div class="vm-card tile" style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f5f5f7', border: '1px solid var(--color-hairline)', position: 'relative' }}>
                    <button 
                      onClick={() => deleteVM(vm.version)}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                      onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseOut={(e) => (e.currentTarget.style.opacity = '0.4')}
                      title="Eliminar VM"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff3b30">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}></div>
                    <h3 class="headline" style={{ marginBottom: '15px' }}>{vm.name}</h3>
                    <div class="actions" style={{ justifyContent: 'center' }}>
                      <button 
                        onClick={() => startInstall({ ...$config, version: vm.version })} 
                        class="button-primary" 
                        style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                    </div>
                    {!vm.hasData && <p class="caption" style={{ color: '#f56300', marginTop: '10px' }}>{t.booting}</p>}
                  </div>
                ))}
                <div 
                  onClick={() => { isDetected.set(false); step.set(2); }} 
                  class="vm-card tile" 
                  style={{ padding: '20px', textAlign: 'center', backgroundColor: 'transparent', border: '2px dashed var(--color-hairline)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div style={{ fontSize: '48px', color: 'var(--color-primary)' }}>+</div>
                  <h3 class="headline" style={{ color: 'var(--color-primary)' }}>{t.newInstall}</h3>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                        onClick={() => { step.set(3); }} 
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
        <section class="tile product-tile-light main-step">
          <h1 class="display-lg">{t.newInstall}</h1>
          <p class="lead">{t.tagline}</p>
          <div class="actions">
            <button onClick={() => step.set(1)} class="button-secondary-pill">{t.back}</button>
            <button onClick={() => step.set(3)} class="button-primary">{t.continue}</button>
          </div>
        </section>
      )}

      {$step === 3 && (
        <section class="tile product-tile-light main-step">
          <h1 class="display-lg">{t.configureHardware}</h1>
          <p class="body" style={{ marginBottom: '20px' }}>{t.performanceNote}</p>
          
          <div class="resource-grid">
            <div class="resource-item" style={{ gridColumn: '1 / -1', marginBottom: '20px', padding: '20px', backgroundColor: 'var(--color-canvas-parchment)', borderRadius: '12px' }}>
              <div class="resource-label" style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '20px', fontWeight: '600' }}>{t.chooseVersion}</span>
              </div>
              <div class="version-select-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                {['15', '14', '13', '12', '11'].map(v => (
                  <div 
                    onClick={() => config.set({ ...$config, version: v })}
                    style={{ 
                      padding: '15px', 
                      textAlign: 'center', 
                      borderRadius: '10px', 
                      cursor: 'pointer',
                      border: $config.version === v ? '2px solid var(--color-primary)' : '1px solid var(--color-hairline)',
                      backgroundColor: $config.version === v ? 'rgba(0,102,204,0.05)' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '18px', color: $config.version === v ? 'var(--color-primary)' : 'var(--color-ink)' }}>macOS {v}</div>
                    <div class="caption" style={{ opacity: 0.6 }}>{v === '15' ? 'Sequoia' : v === '14' ? 'Sonoma' : v === '13' ? 'Ventura' : v === '12' ? 'Monterey' : 'Big Sur'}</div>
                  </div>
                ))}
              </div>
            </div>

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
            <button onClick={() => step.set(1)} class="button-secondary-pill">{t.back}</button>
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
              {!$isFullScreen && (
                <div style={{ backgroundColor: 'rgba(0,102,204,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid var(--color-primary)' }}>
                  <p class="caption" style={{ color: 'var(--color-primary)', margin: 0, fontWeight: 600 }}>{t.diskUtilityNote}</p>
                </div>
              )}
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
