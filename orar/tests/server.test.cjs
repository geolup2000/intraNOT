const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createServer, serverSettings} = require('../server.cjs');

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
  const server=createServer(directory);
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
