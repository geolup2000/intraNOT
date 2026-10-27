const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, 'dist');
function createServer(documentRoot = root) {
const appRoot = path.resolve(documentRoot);
return http.createServer((req,res)=>{
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  res.setHeader('Cache-Control', 'no-cache');
  if (name === '/api/local-documents') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      schedule: fs.existsSync(path.join(appRoot, 'orar-master.pdf')),
      legend: fs.existsSync(path.join(appRoot, 'legenda-discipline.pdf')),
    }));
    return;
  }
  const file = path.resolve(appRoot, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(appRoot + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    const types = {html:'text/html; charset=utf-8',css:'text/css',js:'application/javascript',mjs:'application/javascript',pdf:'application/pdf'};
    res.setHeader('Content-Type', types[path.extname(file).slice(1)] || 'application/octet-stream');
    res.end(data);
  });
});
}

function serverSettings(env = process.env) {
  const host = env.INTRANOT_HOST || '0.0.0.0';
  const port = Number(env.INTRANOT_PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INTRANOT_PORT trebuie să fie un număr între 1 și 65535.');
  return { host, port };
}

if (require.main === module) {
  const {host, port} = serverSettings();
  const server = createServer();
  server.on('error', error => { console.error(`Serverul nu a putut porni: ${error.message}`); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`Pe acest calculator: http://127.0.0.1:${port}`);
    if (host === '0.0.0.0') {
      for (const address of new Set(Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address))) console.log(`În LAN: http://${address}:${port}`);
    } else console.log(`Adresă de ascultare: ${host}:${port}`);
    console.log('Oprire: Ctrl+C');
  });
}

module.exports = { createServer, serverSettings };
