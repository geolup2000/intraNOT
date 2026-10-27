const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createServer, serverSettings} = require('../server.cjs');
const {MAX_PDF_BYTES} = require('../schedule-store.cjs');
const {timetablePdf}=require('./pdf-fixture.cjs');

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

async function sharedServer(t, options={}) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'intranot-shared-'));
  const dataDirectory=path.join(directory,'data');
  let server;
  async function start() {
    server=createServer(directory,{dataDirectory,...options});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  const base=await start();
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});});
  return {base,dataDirectory,restart:async()=>{await new Promise(resolve=>server.close(resolve));return start();}};
}

const pdf = timetablePdf();
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
  const parsed=await (await fetch(`${fixture.base}/${document.dataUrl}`)).json();
  assert.equal(parsed.schedule.events.length,1);
  assert.equal(parsed.schedule.events[0].title,'Informatică medicală. Biostatistică');
  assert.equal(parsed.schedule.events[0].date,'2026-10-27');
  const download=await fetch(`${fixture.base}/${document.pdfUrl}`);
  assert.equal(download.headers.get('content-type'),'application/pdf');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
  const restarted=await fixture.restart();
  assert.deepEqual((await (await fetch(`${restarted}/api/schedule`)).json()).document,document);
  assert.deepEqual(Buffer.from(await (await fetch(`${restarted}/${document.pdfUrl}`)).arrayBuffer()),pdf);
  assert.deepEqual((await (await fetch(`${restarted}/${document.dataUrl}`)).json()).schedule,parsed.schedule);
});

test('replacement keeps previous PDF versions and invalid uploads preserve the current schedule', async t => {
  const {base}=await sharedServer(t);
  const first=(await (await upload(base)).json()).document;
  const invalid=await upload(base,Buffer.from('not PDF'));
  assert.equal(invalid.status,400);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,first.version);
  assert.equal((await upload(base,pdf,'file.txt')).status,400);
  assert.equal((await upload(base,Buffer.from('%PDF-1.7\nnot a valid document'))).status,422);
  assert.equal((await upload(base,Buffer.from(pdf.toString().replace('(S4)','(XX)')))).status,422);
  assert.equal((await upload(base,pdf,'cache-vechi.pdf',{'If-None-Match':'*'})).status,412);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,first.version);
  assert.equal((await upload(base,pdf,'orar.pdf',{Origin:'http://other-site.invalid'})).status,403);
  const secondPdf=timetablePdf('MCS-M');
  const second=(await (await upload(base,secondPdf,'nou.pdf')).json()).document;
  assert.notEqual(first.version,second.version);
  assert.equal((await (await fetch(`${base}/api/schedule`)).json()).document.version,second.version);
  assert.deepEqual(Buffer.from(await (await fetch(`${base}/${first.pdfUrl}`)).arrayBuffer()),pdf);
  assert.deepEqual(Buffer.from(await (await fetch(`${base}/${second.pdfUrl}`)).arrayBuffer()),secondPdf);
});

test('existing PDF-only server data is parsed without another upload and old URLs are normalized', async t => {
  const fixture=await sharedServer(t);
  const document=(await (await upload(fixture.base)).json()).document;
  await fs.unlink(path.join(fixture.dataDirectory,`${document.version}.schedule.json`));
  const old={...document,pdfUrl:`/api/schedule/pdf?version=${document.version}`};delete old.dataUrl;
  await fs.writeFile(path.join(fixture.dataDirectory,`${document.version}.json`),JSON.stringify(old));
  await fs.writeFile(path.join(fixture.dataDirectory,'current.json'),JSON.stringify(old));
  const base=await fixture.restart();
  const migrated=(await (await fetch(`${base}/api/schedule`)).json()).document;
  assert.ok(migrated.dataUrl.startsWith('api/'));
  assert.ok(migrated.pdfUrl.startsWith('api/'));
  const data=await (await fetch(`${base}/${migrated.dataUrl}`)).json();
  assert.equal(data.schedule.events.length,1);
  assert.ok(await fs.stat(path.join(fixture.dataDirectory,`${document.version}.schedule.json`)));
});

test('reverse proxy origin can use an explicit public origin or explicitly trusted forwarded headers', async t => {
  const direct=await sharedServer(t);
  const proxyHeaders={Origin:'https://orar.example.test','X-Forwarded-Host':'orar.example.test','X-Forwarded-Proto':'https'};
  assert.equal((await upload(direct.base,pdf,'orar.pdf',proxyHeaders)).status,403);
  const explicit=await sharedServer(t,{publicOrigin:'https://orar.example.test'});
  assert.equal((await upload(explicit.base,pdf,'orar.pdf',{Origin:'https://orar.example.test'})).status,200);
  const trusted=await sharedServer(t,{trustProxy:true});
  assert.equal((await upload(trusted.base,pdf,'orar.pdf',proxyHeaders)).status,200);
  assert.equal((await upload(trusted.base,pdf,'orar.pdf',{Origin:'not a valid origin'})).status,403);
});

test('oversized uploads are rejected without creating a shared document', async t => {
  const {base}=await sharedServer(t);
  const oversized=Buffer.alloc(MAX_PDF_BYTES+1);
  const response=await upload(base,oversized);
  assert.equal(response.status,413);
  assert.deepEqual(await (await fetch(`${base}/api/schedule`)).json(),{document:null});
});
