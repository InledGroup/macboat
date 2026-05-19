import { atom } from 'nanostores';

export const step = atom(1);
export const systemStatus = atom(null);
export const config = atom({
  version: '14',
  ramSize: '4G',
  cpuCores: 2,
  diskSize: '64G',
  sharedFolders: [],
  usbDevices: []
});
export const logs = atom('');
export const progress = atom(0);
export const currentStage = atom('');
export const isInstalling = atom(false);
export const isDetected = atom(false);
export const showViewer = atom(false);
export const isFullScreen = atom(false);
export const hasAcceptedLegal = atom(false);
export const isLegalRejected = atom(false);
export const language = atom<'es' | 'en'>('es');
