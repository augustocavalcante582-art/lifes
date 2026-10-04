// Processo principal do Electron: sobe o servidor local e abre a janela do Life.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { createServer } = require('./server');

let server;

function start() {
  const dataDir = path.join(app.getPath('userData'), 'life-data');
  const api = createServer({ dataDir });

  // Porta 0 = o sistema escolhe uma porta livre. Só aceita conexões locais.
  server = api.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#171a21',
      title: 'Life',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.loadURL(`http://127.0.0.1:${port}`);

    // Links externos abrem no navegador, não dentro do app
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  });
}

app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
