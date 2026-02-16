const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    // --- Splash Screen ---
    const splash = new BrowserWindow({
        width: 420,
        height: 340,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        center: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splash.loadFile(path.join(__dirname, 'splash.html'));

    // --- Main Window (hidden initially) ---
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Course Engine',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

    // --- Security hardening ---

    // Block navigation to any non-local URL
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
        }
    });

    // Block popup windows
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Show main window when ready, close splash
    mainWindow.once('ready-to-show', () => {
        // Small delay so the splash feels intentional, not just a flash
        setTimeout(() => {
            splash.destroy();
            mainWindow.show();
            mainWindow.focus();
        }, 3000);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

// Quit when all windows are closed (macOS standard for non-dock apps)
app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
