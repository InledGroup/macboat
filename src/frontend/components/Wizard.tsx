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

  const [manualPath, setManualPath] = useState('');
  const [isPathError, setIsPathError] = useState(false);

  const init = async () => {
    try {
      // @ts-ignore
      const settings = await window.electron.getSettings();
      if (settings.hasAcceptedLegal) {
        hasAcceptedLegal.set(true);
      }

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

  const handleManualPath = async () => {
    setIsPathError(false);
    try {
      // @ts-ignore
      const status = await window.electron.setDockerPath(manualPath);
      if (status && status.dockerInstalled) {
        systemStatus.set(status);
        init();
      } else {
        setIsPathError(true);
      }
    } catch (e) {
      setIsPathError(true);
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

  const deleteVM = async (id: string) => {
    // @ts-ignore
    const result = await window.electron.deleteVM(id);
    if (result && result.ok) {
      refreshVMs();
    }
  };

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const renameVM = async (id: string, currentName: string) => {
    setRenamingId(id);
    setNewName(currentName);
  };

  const saveRename = async () => {
    if (renamingId && newName) {
      // @ts-ignore
      const result = await window.electron.renameVM({ id: renamingId, newName });
      if (result && result.ok) {
        refreshVMs();
      }
    }
    setRenamingId(null);
  };

  useEffect(() => {
    // @ts-ignore
    const unsubscribeLogs = window.electron.onDockerLogs((newLog: string) => {
      logs.set(logs.get() + newLog);
      
      const percentMatch = newLog.match(/(\d+)%/);
      if (percentMatch && percentMatch[1]) {
        progress.set(parseInt(percentMatch[1]));
      }

      if (newLog.includes('Starting macOS for Docker') || newLog.includes('Reusing existing image') || newLog.includes('Downloading') || newLog.includes('Extracting')) {
        currentStage.set(t.bootStage1);
        if (progress.get() < 10) progress.set(10);
      }
      if (newLog.includes('Building boot image') || newLog.includes('Generating Config') || newLog.includes('Creating disk') || newLog.includes('Allocating')) {
        currentStage.set(t.bootStage2);
        if (progress.get() < 25) progress.set(25);
      }
      if (newLog.includes('Booting macOS using QEMU') || newLog.includes('SeaBIOS') || newLog.includes('iPXE') || newLog.includes('Starting QEMU')) {
        currentStage.set(t.bootStage3);
        if (progress.get() < 40) progress.set(40);
      }
      if (newLog.includes('HANDOFF TO XNU') || newLog.includes('OpenCore')) {
        currentStage.set(t.bootStage4);
        if (progress.get() < 60) progress.set(60);
      }
      if (newLog.includes('End of efiboot serial output') || newLog.includes('macOS Login') || newLog.includes('display-manager') || newLog.includes('VNC server running')) {
        currentStage.set(t.bootStage5);
        if (progress.get() < 90) progress.set(90);
        showViewer.set(true);
        isFullScreen.set(true); // Default to full screen
      }

      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });

    // @ts-ignore
    const unsubscribeStatus = window.electron.onStatusUpdate((status: any) => {
      console.log('Status Update:', status);
      if (status.message) {
        logs.set(logs.get() + '\n[STATUS] ' + status.message + '\n');
        if (status.message.toLowerCase().includes('error')) {
          isInstalling.set(false);
        }
      }
    });

    return () => {
      unsubscribeLogs();
      unsubscribeStatus();
    };
  }, [$lang]);

  const [isDockExpanded, setIsDockExpanded] = useState(true);
  const [dockPosition, setDockPosition] = useState<'bottom' | 'left' | 'right'>('bottom');

  const cycleDockPosition = () => {
    if (dockPosition === 'bottom') setDockPosition('left');
    else if (dockPosition === 'left') setDockPosition('right');
    else setDockPosition('bottom');
  };

  useEffect(() => {
    // Retry iframe every 3s until we confirm it's showing (based on logs)
    let timer: any;
    if ($isInstalling && !$showViewer) {
      timer = setInterval(() => {
        setIframeKey(prev => prev + 1);
      }, 3000);
    }
    return () => timer && clearInterval(timer);
  }, [$isInstalling, $showViewer]);

  useEffect(() => {
    // Refresh VMs when showing dashboard
    if ($step === 1) {
      refreshVMs();
    }
  }, [$step]);

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
      step.set(1);
      refreshVMs();
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
            <button onClick={async () => { 
              hasAcceptedLegal.set(true); 
              // @ts-ignore
              await window.electron.saveSettings({ hasAcceptedLegal: true });
            }} class="button-primary">{t.accept}</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div class="wizard-container">

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
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => renameVM(vm.id, vm.name)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = '0.4')}
                        title="Renombrar VM"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-primary)">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button 
                        onClick={() => deleteVM(vm.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.2s' }}
                        onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = '0.4')}
                        title="Eliminar VM"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff3b30">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}></div>
                    {renamingId === vm.id ? (
                      <div style={{ padding: '0 10px' }}>
                        <input 
                          type="text" 
                          value={newName} 
                          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
                          onBlur={saveRename}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          autoFocus
                          style={{ width: '100%', padding: '5px', borderRadius: '5px', border: '1px solid var(--color-primary)', textAlign: 'center' }}
                        />
                      </div>
                    ) : (
                      <h3 class="headline" style={{ marginBottom: '5px' }}>{vm.name}</h3>
                    )}
                    <p class="caption" style={{ marginBottom: '15px', opacity: 0.6 }}>macOS {vm.version}</p>
                    <div class="actions" style={{ justifyContent: 'center' }}>
                      <button 
                        onClick={() => startInstall(vm.config || { ...$config, version: vm.version })} 
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
                    {!$systemStatus.dockerInstalled && (
                      <div class="tile" style={{ padding: '20px', marginBottom: '20px', backgroundColor: 'rgba(255, 59, 48, 0.05)', border: '1px solid #ff3b30' }}>
                        <h3 class="headline" style={{ color: '#ff3b30', marginBottom: '10px' }}>{t.dockerPathTitle}</h3>
                        <p class="caption" style={{ marginBottom: '15px' }}>{t.dockerPathDesc}</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input 
                            type="text" 
                            placeholder={t.dockerPathPlaceholder} 
                            value={manualPath}
                            onInput={(e) => setManualPath((e.target as HTMLInputElement).value)}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--color-hairline)' }}
                          />
                          <button onClick={handleManualPath} class="button-primary" style={{ padding: '10px 20px' }}>
                            {t.savePath}
                          </button>
                        </div>
                        {isPathError && <p class="caption" style={{ color: '#ff3b30', marginTop: '10px' }}>{t.invalidPath}</p>}
                      </div>
                    )}
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
                <span style={{ fontSize: '20px', fontWeight: '600' }}>{t.vmName}</span>
              </div>
              <input 
                type="text" 
                placeholder={t.vmNamePlaceholder} 
                value={$config.name || ''}
                onInput={(e) => config.set({ ...$config, name: (e.target as HTMLInputElement).value })}
                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid var(--color-hairline)', fontSize: '16px' }}
              />
            </div>

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
        <section class="tile product-tile-dark main-step" style={{ position: 'relative', padding: '0', width: '100vw', height: '100vh', overflow: 'hidden' }}>
          
          {/* Main VNC Viewer - Always present but maybe behind logs initially */}
          <div class={`viewer-container full-screen`}>
            <iframe 
              key={iframeKey} 
              src="http://localhost:8006/?autoconnect=1&resize=scale" 
              class="macos-iframe"
              style={{ background: '#000' }}
            ></iframe>
          </div>

          {/* Overlay Logs/Status - Only visible until VNC is confirmed or if debug is needed */}
          {!$showViewer && (
            <div class="macos-overlay">
              <div class="install-header" style={{ textAlign: 'center', marginBottom: '30px', zIndex: 2100 }}>
                <h1 class="display-lg text-white">{$stage || t.preparing}</h1>
                <p class="caption text-white" style={{ opacity: 0.6, marginBottom: '10px' }}>{$progress}% {t.completed}</p>
                <div class="progress-container" style={{ width: '300px', height: '4px', margin: '0 auto' }}>
                  <div class="progress-bar" style={{ width: `${$progress}%` }}></div>
                </div>
              </div>
              
              <div class="log-container" style={{ width: '80%', height: '50vh', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <pre ref={logRef} class="log-viewer" style={{ color: '#fff', fontSize: '12px' }}>{$logs || t.booting}</pre>
              </div>
            </div>
          )}

          {/* macOS-style Dock - The ONLY controls */}
          <div class={`macos-dock-container ${dockPosition} ${isDockExpanded ? 'expanded' : 'collapsed'}`}>
            <div class="dock-handle" onClick={() => setIsDockExpanded(!isDockExpanded)}>
              <div class="handle-bar"></div>
              {!isDockExpanded && (
                <div class="expand-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d={dockPosition === 'bottom' ? "M7 14l5-5 5 5z" : dockPosition === 'left' ? "M10 17l5-5-5-5z" : "M14 7l-5 5 5 5z"}/>
                  </svg>
                </div>
              )}
            </div>
            {isDockExpanded && (
              <div class="macos-dock">
                <button onClick={stopInstall} class="dock-item" title={t.pause}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#ff3b30">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                </button>
                <button onClick={exitInstall} class="dock-item" title={t.exit}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#333">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </button>
                <a href="http://localhost:8006" target="_blank" class="dock-item" title={t.openBrowser}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--color-primary)">
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                  </svg>
                </a>
                <div class="dock-divider"></div>
                <button onClick={cycleDockPosition} class="dock-item" title="Cambiar posición del Dock">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#555">
                    <path d="M7 19h10V5H7v14zm2-12h6v10H9V7z M3 3h18v18H3V3z"/>
                  </svg>
                </button>
                <button onClick={() => showViewer.set(!$showViewer)} class="dock-item" title="Toggle Logs">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#555">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                </button>
                <button onClick={toggleFullScreen} class="dock-item" title={$isFullScreen ? t.exitFullScreen : t.fullScreen}>
                  { $isFullScreen ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#555">
                      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                    </svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#555">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
