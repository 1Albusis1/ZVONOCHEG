const { app, BrowserWindow } = require('electron');

const timeout = setTimeout(() => {
  console.error('Recovery probe timed out');
  app.exit(1);
}, 20000);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, nodeIntegration: false },
  });
  await window.loadURL(process.argv[2]);
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const result = document.querySelector('#result');
      const observer = new MutationObserver(check);
      function check() {
        if (!result.dataset.status) return;
        observer.disconnect();
        resolve({ status: result.dataset.status, text: result.textContent });
      }
      observer.observe(result, { attributes: true });
      check();
    })
  `);
  clearTimeout(timeout);
  console.log(result.text);
  app.exit(result.status === 'passed' ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
