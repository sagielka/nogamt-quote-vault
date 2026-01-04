import { app, BrowserWindow, ipcMain, shell } from "electron";
import pkg from "electron-updater";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const { autoUpdater } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
    title: "Thinking Inside Quotation System",
  });

  // Enable WebSocket connections for Supabase Realtime
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['wss://*.supabase.co/*', 'https://*.supabase.co/*'] },
    (details, callback) => {
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // Enable print preview by handling the print in the renderer
  mainWindow.webContents.on("will-print", (event, webContents, details) => {
    // Allow default print behavior
  });

  // In production, load the built files
  // In development, you can load from localhost
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://localhost:8080");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", () => {
  console.log("Update available");
});

autoUpdater.on("update-downloaded", () => {
  console.log("Update downloaded - will install on quit");
});

autoUpdater.on("error", (error) => {
  console.error("Auto-updater error:", error);
});

// IPC handler for email with PDF attachment
ipcMain.handle('email-with-attachment', async (event, { pdfData, fileName, recipientEmail, subject, body }) => {
  try {
    // Save PDF to temp directory
    const tempDir = os.tmpdir();
    const pdfPath = path.join(tempDir, fileName);
    
    // Convert base64 to buffer and write file
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    fs.writeFileSync(pdfPath, pdfBuffer);
    
    console.log('PDF saved to:', pdfPath);
    
    // Try to open Outlook with the attachment using PowerShell
    const escapedSubject = subject.replace(/"/g, '\\"');
    const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '`n');
    const escapedPath = pdfPath.replace(/\\/g, '\\\\');
    
    const powershellScript = `
      $outlook = New-Object -ComObject Outlook.Application
      $mail = $outlook.CreateItem(0)
      $mail.To = "${recipientEmail}"
      $mail.Subject = "${escapedSubject}"
      $mail.Body = "${escapedBody}"
      $mail.Attachments.Add("${escapedPath}")
      $mail.Display()
    `;
    
    return new Promise((resolve, reject) => {
      exec(`powershell -Command "${powershellScript.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('PowerShell error:', error);
          // Fallback: just open the folder with the PDF
          shell.showItemInFolder(pdfPath);
          resolve({ success: true, fallback: true, pdfPath });
        } else {
          console.log('Outlook opened successfully');
          resolve({ success: true, fallback: false, pdfPath });
        }
      });
    });
  } catch (error) {
    console.error('Error in email-with-attachment:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  // Check for updates after window is created
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

