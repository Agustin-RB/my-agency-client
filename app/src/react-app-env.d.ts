/// <reference types="react-scripts" />

interface ElectronAPI {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on?: (channel: string, listener: (...args: any[]) => void) => void;
}

interface Window {
    electron: ElectronAPI;
}

declare module 'react-big-calendar';
