const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const VERSION = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function createScheduleStore(directory) {
  const root = path.resolve(directory);
  let writeQueue = Promise.resolve();

  async function metadata(version) {
    if (version && !VERSION.test(version)) return null;
    try {
      const document = JSON.parse(await fs.readFile(path.join(root, version ? `${version}.json` : 'current.json'), 'utf8'));
      if (!VERSION.test(document.version) || typeof document.name !== 'string') throw new Error('Invalid stored document metadata');
      await fs.access(path.join(root, `${document.version}.pdf`));
      return document;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function read(version) {
    const document = await metadata(version);
    if (!document) return null;
    return {document, bytes: await fs.readFile(path.join(root, `${document.version}.pdf`))};
  }

  function save(bytes, name, {onlyIfEmpty = false} = {}) {
    const operation = writeQueue.then(async () => {
      if (onlyIfEmpty && await metadata()) throw Object.assign(new Error('Există deja un orar pe server.'), {status:412});
      const version = randomUUID();
      const document = {
        version,
        name,
        size: bytes.length,
        uploadedAt: new Date().toISOString(),
        pdfUrl: `/api/schedule/pdf?version=${version}`,
      };
      await fs.mkdir(root, {recursive: true, mode: 0o700});
      await fs.writeFile(path.join(root, `${version}.pdf`), bytes, {flag: 'wx', mode: 0o600});
      const json = JSON.stringify(document);
      await fs.writeFile(path.join(root, `${version}.json`), json, {flag: 'wx', mode: 0o600});
      const temporary = path.join(root, `current-${version}.tmp`);
      await fs.writeFile(temporary, json, {flag: 'wx', mode: 0o600});
      // Publish the new document only after all its files have been saved.
      // Earlier versions remain available; a failed write preserves current.json.
      await fs.rename(temporary, path.join(root, 'current.json'));
      return document;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  return {metadata, read, save};
}

module.exports = {createScheduleStore, MAX_PDF_BYTES};
