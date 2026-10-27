const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createScheduleStore, MAX_PDF_BYTES} = require('./schedule-store.cjs');
const root = path.resolve(__dirname, 'dist');
function createServer(documentRoot = root, options = {}) {
const appRoot = path.resolve(documentRoot);
const store = createScheduleStore(options.dataDirectory || process.env.INTRANOT_DATA_DIR || path.resolve(__dirname, '../.local/data'));
function json(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
}
function readUpload(req) {
  return new Promise((resolve, reject) => {
    let chunks = [], size = 0, failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_PDF_BYTES) { failed = true; chunks = []; reject(Object.assign(new Error('Fișierul depășește limita de 20 MB.'), {status:413})); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
    req.on('aborted', () => reject(Object.assign(new Error('Încărcarea a fost întreruptă.'), {status:400})));
  });
}
async function handle(req,res) {
  let name;
  const url = new URL(req.url, 'http://localhost');
  try { name = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400).end(); return; }
  res.setHeader('Cache-Control', 'no-cache');
  if (name === '/api/schedule' && req.method === 'GET') {
    json(res, 200, {document: await store.metadata()});
    return;
  }
  if (name === '/api/schedule' && req.method === 'PUT') {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) { json(res,403,{error:'Încărcarea trebuie făcută din aplicația acestui server.'});req.resume();return; }
    if (Number(req.headers['content-length']) > MAX_PDF_BYTES) { json(res,413,{error:'Fișierul depășește limita de 20 MB.'});req.resume();return; }
    let filename;
    try { filename = decodeURIComponent(req.headers['x-pdf-name'] || 'orar.pdf').split(/[\\/]/).pop(); }
    catch { json(res,400,{error:'Numele fișierului nu este valid.'});req.resume();return; }
    if (!filename || filename.length > 240 || /[\x00-\x1f\x7f]/.test(filename) || !/\.pdf$/i.test(filename)) { json(res,400,{error:'Alege un fișier cu extensia .pdf.'});req.resume();return; }
    const bytes = await readUpload(req);
    if (!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) { json(res,400,{error:'Fișierul nu are un format PDF valid.'});return; }
    json(res,200,{document:await store.save(bytes,filename,{onlyIfEmpty:req.headers['if-none-match']==='*'})});
    return;
  }
  if (name === '/api/schedule/pdf' && req.method === 'GET') {
    const saved = await store.read(url.searchParams.get('version'));
    if (!saved) { json(res,404,{error:'Nu există un orar salvat pe server.'});return; }
    res.writeHead(200, {'Content-Type':'application/pdf','Content-Length':saved.bytes.length,'Content-Disposition':`inline; filename="orar.pdf"; filename*=UTF-8''${encodeURIComponent(saved.document.name)}`,'Cache-Control':'no-store'});
    res.end(saved.bytes);
    return;
  }
  if (name.startsWith('/api/schedule')) { json(res,405,{error:'Metodă nesuportată.'});req.resume();return; }
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
}
return http.createServer((req,res) => {
  handle(req,res).catch(error => {
    console.error('Eroare la procesarea cererii:', error.message);
    if (res.headersSent) { res.end();return; }
    json(res,error.status || 500,{error:error.status ? error.message : 'Serverul nu poate citi sau salva orarul. Verifică spațiul și permisiunile directorului .local/data.'});
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
