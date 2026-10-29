const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 820,
    minWidth: 360,
    minHeight: 500,
    title: 'Skill Tracker',
    icon: path.join(__dirname, 'app', 'icon.svg'),
    autoHideMenuBar: true,
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // open external links in the real browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(createWindow);
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.on('window-all-closed', () => app.quit());
}
