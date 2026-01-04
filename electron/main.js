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
    { urls: ["wss://*.supabase.co/*", "https://*.supabase.co/*"] },
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

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// IPC handler for email with PDF attachment
ipcMain.handle(
  "email-with-attachment",
  async (event, { pdfData, fileName, recipientEmail, subject, body }) => {
    console.log("email-with-attachment called with:", {
      fileName,
      recipientEmail,
      subject,
    });

    try {
      // Save PDF to temp directory
      const tempDir = os.tmpdir();
      const pdfPath = path.join(tempDir, fileName);

      // Convert base64 to buffer and write file
      const pdfBuffer = Buffer.from(pdfData, "base64");
      fs.writeFileSync(pdfPath, pdfBuffer);

      console.log("PDF saved to:", pdfPath);

      // Escape special characters for PowerShell
      const escapedSubject = subject.replace(/'/g, "''").replace(/`/g, "``");
      const escapedBody = body
        .replace(/'/g, "''")
        .replace(/`/g, "``")
        .replace(/\r?\n/g, "`r`n");
      const escapedEmail = recipientEmail.replace(/'/g, "''");

      // PowerShell script using single quotes for safety
      const powershellScript = `
      try {
        $outlook = New-Object -ComObject Outlook.Application
        $mail = $outlook.CreateItem(0)
        $mail.To = '${escapedEmail}'
        $mail.Subject = '${escapedSubject}'
        $mail.Body = '${escapedBody}'
        $mail.Attachments.Add('${pdfPath.replace(/\\/g, "\\\\")}')
        $mail.Display()
        Write-Output 'SUCCESS'
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

      console.log("Executing PowerShell script...");

      return new Promise((resolve) => {
        exec(
          `powershell -NoProfile -ExecutionPolicy Bypass -Command "${powershellScript
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, " ")}"`,
          { timeout: 30000 },
          (error, stdout, stderr) => {
            console.log("PowerShell stdout:", stdout);
            console.log("PowerShell stderr:", stderr);

            if (error) {
              console.error("PowerShell error:", error);
              // Fallback: just open the folder with the PDF
              shell.showItemInFolder(pdfPath);
              resolve({ success: true, fallback: true, pdfPath });
            } else {
              console.log("Outlook opened successfully");
              resolve({ success: true, fallback: false, pdfPath });
            }
          }
        );
      });
    } catch (error) {
      console.error("Error in email-with-attachment:", error);
      return { success: false, error: error.message };
    }
  }
);

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


