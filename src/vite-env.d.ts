/// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      getAppVersion?: () => Promise<string>;
      emailWithAttachment: (
        pdfData: string,
        fileName: string,
        recipientEmail: string,
        subject: string,
        body: string
      ) => Promise<{ success: boolean; fallback?: boolean; pdfPath?: string; error?: string }>;
      checkForUpdates?: () => Promise<{ ok?: boolean; skipped?: boolean; version?: string; error?: string; reason?: string }>;
      installUpdateNow?: () => Promise<void>;
      onUpdateStatus?: (
        cb: (payload: { status: "checking" | "available" | "up-to-date" | "downloading" | "downloaded" | "error"; data?: any }) => void
      ) => () => void;
    };
  }
}

export {};
