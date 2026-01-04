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
    };
  }
}

export {};
