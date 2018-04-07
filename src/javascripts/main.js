// This is main process of Electron, started as first thing when your
// app starts. This script is running through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import path from 'path';
import url from 'url';
import { exec } from 'child_process';
import { app, ipcMain, BrowserWindow } from 'electron';
import createWindow from './helpers/window';

// Special module holding environment variables which you declared
// in config/env_xxx.json file.
import env from './env';

let mainWindow, progressWindow, showProgressTimeout;

// Save userData in separate folders for each environment.
// Thanks to this you can use production and development versions of the app
// on same machine like those are two separate apps.
if (env.name !== 'production') {
    let userDataPath = app.getPath('userData');
    app.setPath('userData', userDataPath + ' (' + env.name + ')');
}

let getPageUrl = function(page) {
    return url.format({
        pathname: path.join(__dirname, page),
        protocol: 'file:',
        slashes: true
    });
};

let loadPage = function(window, page, openDevTools) {
    if (openDevTools) {
        window.openDevTools();
        window.webContents.on('devtools-opened', function() {
            window.loadURL(getPageUrl(page));
        });
    } else {
        window.loadURL(getPageUrl(page));
    }
};

let mainSend = function(channel, ...args) {
    if (!mainWindow) return;
    mainWindow.webContents.send(channel, ...args);
};

let progSend = function(channel, ...args) {
    if (!progressWindow) return;
    progressWindow.webContents.send(channel, ...args);
};

let resetProgress = function() {
    progSend('set-progress', {
        determinate: false,
        message: '...'
    });
};

let getProcessList = function(callback) {
    exec('tasklist /fo csv /nh', function(err, stdout) {
        let expr = /\"([^\"]+)\"/,
            lines = stdout.split('\r\n').slice(0, -1),
            processes = lines.map((line) => { return line.match(expr)[1] });
        callback(processes);
    });
};

let openMainWindow = function() {
    if (mainWindow) mainWindow.destroy();
    mainWindow = createWindow('main', { frame: false, show: false });
    loadPage(mainWindow, 'app.html', env.name === 'development');
    mainWindow.once('ready-to-show', () => mainWindow.show());
};

let openProgressWindow = function(canUseTransparency) {
    progressWindow = new BrowserWindow({
        parent: mainWindow,
        title: "zEdit Progress",
        modal: true,
        show: true,
        frame: false,
        closable: false,
        transparent: canUseTransparency,
        focusable: false,
        maximizable: false,
        minimizable: false,
        resizable: false,
        movabale: false
    });
    progressWindow.hide();
    loadPage(progressWindow, 'progress.html');
};

let getShouldReboot = function() {
    return !electron.dialog.showMessageBox({
        type: 'error',
        buttons: ['Reboot', 'Close'],
        defaultId: 1,
        title: 'Crash Report',
        message: 'zEdit crashed.  This sometimes happens when an Antivirus interferes with the zEdit process.  You may want to try adding zEdit\'s installation folder to your Antivirus\'s exception list.',
        cancelId: 1
    });
};

let createWindows = function() {
    openMainWindow();
    mainWindow.webContents.on('crash', () => {
        if (getShouldReboot()) createWindows();
    });
    mainWindow.on('closed', () => progressWindow.destroy());
    getProcessList((processes) => {
        openProgressWindow(processes.includes('dwm.exe'));
    });
};

electron.app.on('ready', createWindows);

app.on('window-all-closed', () => app.quit());

ipcMain.on('show-progress', (e, p) => {
    progressWindow.setBounds(mainWindow.getContentBounds());
    progSend('set-progress', p);
    showProgressTimeout = setTimeout(() => progressWindow.show(), 50);
});

ipcMain.on('hide-progress', () => {
    resetProgress();
    mainSend('progress-hidden');
    clearTimeout(showProgressTimeout);
    progressWindow.hide();
});

ipcMain.on('set-theme', (e, p) => progSend('set-theme', p));
ipcMain.on('progress-title', (e, p) => progSend('progress-title', p));
ipcMain.on('progress-message', (e, p) => progSend('progress-message', p));
ipcMain.on('add-progress', (e, p) => progSend('add-progress', p));
ipcMain.on('log-message', (e, p) => progSend('log-message', p));
ipcMain.on('allow-close', () => progSend('allow-close'));
