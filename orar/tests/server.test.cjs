const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createServer, serverSettings} = require('../server.cjs');
const {MAX_PDF_BYTES} = require('../schedule-store.cjs');

test('server listens on LAN by default and accepts explicit host and port', () => {
  assert.deepEqual(serverSettings({}), {host:'0.0.0.0',port:4173});
  assert.deepEqual(serverSettings({INTRANOT_HOST:'127.0.0.1',INTRANOT_PORT:'5000'}), {host:'127.0.0.1',port:5000});
  for (const port of ['abc','0','65536','1.5']) assert.throws(()=>serverSettings({INTRANOT_PORT:port}));
});

test('fresh checkout without PDFs serves the app and reports optional documents as absent', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'intranot-server-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  await fs.writeFile(path.join(directory,'index.html'),'<h1>Orar</h1>');
  await fs.writeFile(path.join(directory,'module.mjs'),'export const ready = true;');
  const server=createServer(directory,{dataDirectory:path.join(directory,'private-data')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base);
  assert.equal(page.status,200);
  assert.match(await page.text(),/Orar/);
  const config=await fetch(`${base}/api/local-documents`);
  assert.deepEqual(await config.json(),{schedule:false,legend:false});
  const module=await fetch(`${base}/module.mjs`);
  assert.match(module.headers.get('content-type'),/javascript/);
  await fs.writeFile(path.join(directory,'orar-master.pdf'),'private local fixture');
  assert.deepEqual(await (await fetch(`${base}/api/local-documents`)).json(),{schedule:true,legend:false});
});

async function sharedServer(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'intranot-shared-'));
  const dataDirectory=path.join(directory,'data');
  let server;
  async function start() {
    server=createServer(directory,{dataDirectory});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const base=await start();
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});});
  return {base,restart:async()=>{await new Promise(resolve=>server.close(resolve));return start();}};
}

const pdf = Buffer.from('%PDF-1.7\nlocal test document\n%%EOF');
async function upload(base,bytes=pdf,name='Orar sănătate.pdf',extraHeaders={}) {
  return fetch(`${base}/api/schedule`,{method:'PUT',headers:{'Content-Type':'application/pdf','X-PDF-Name':encodeURIComponent(name),...extraHeaders},body:bytes});
}

test('an upload is shared with another client and survives a server restart', async t => {
  const fixture=await sharedServer(t);
  assert.deepEqual(await (await fetch(`${fixture.base}/api/schedule`)).json(),{document:null});
  const response=await upload(fixture.base);
  assert.equal(response.status,200);
  const {document}=await response.json();
  assert.equal(document.name,'Orar sănătate.pdf');
  assert.equal(document.size,pdf.length);
  const otherClient=await fetch(`${fixture.base}/api/schedule`);
  assert.equal((await otherClient.json()).document.version,document.version);
  const download=await fetch(fixture.base+document.pdfUrl);
  assert.equal(download.headers.get('content-type'),'application/pdf');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
  const restarted=await fixture.restart();
  assert.deepEqual((await (await fetch(`${restarted}/api/schedule`)).json()).document,document);
  assert.deepEqual(Buffer.from(await (await fetch(restarted+document.pdfUrl)).arrayBuffer()),pdf);
});

test('replacement keeps previous PDF versions and invalid uploads preserve the current schedule', async t => {
  const {base}=await sharedServer(t);
  const first=(await (await upload(base)).json()).document;
  const invalid=await upload(base,Buffer.from('not PDF'));
  assert.equal(invalid.status,400);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,first.version);
  assert.equal((await upload(base,pdf,'file.txt')).status,400);
  assert.equal((await upload(base,pdf,'cache-vechi.pdf',{'If-None-Match':'*'})).status,412);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,first.version);
  assert.equal((await upload(base,pdf,'orar.pdf',{Origin:'http://other-site.invalid'})).status,403);
  const secondPdf=Buffer.from('%PDF-1.7\nreplacement\n%%EOF');
  const second=(await (await upload(base,secondPdf,'nou.pdf')).json()).document;
  assert.notEqual(first.version,second.version);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,second.version);
  assert.deepEqual(Buffer.from(await (await fetch(base+first.pdfUrl)).arrayBuffer()),pdf);
  assert.deepEqual(Buffer.from(await (await fetch(base+second.pdfUrl)).arrayBuffer()),secondPdf);
});

test('oversized uploads are rejected without creating a shared document', async t => {
  const {base}=await sharedServer(t);
  const oversized=Buffer.alloc(MAX_PDF_BYTES+1);
  const response=await upload(base,oversized);
  assert.equal(response.status,413);
  assert.deepEqual(await (await fetch(`${base}/api/schedule`)).json(),{document:null});
});
