import { parseSchedule } from './schedule.mjs';

let pdfjsPromise;
export async function readSchedule(buffer) {
  pdfjsPromise ||= import('./vendor/pdf.mjs');
  const pdfjs = await pdfjsPromise;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const loading = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true });
  try {
    const document = await loading.promise;
    const pages = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items);
      page.cleanup();
    }
    return parseSchedule(pages);
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('PDF-ul este protejat cu parolă. Încarcă o copie fără parolă.');
    if (['InvalidPDFException', 'MissingPDFException', 'UnexpectedResponseException'].includes(error.name)) throw new Error('PDF-ul nu poate fi citit sau este deteriorat.');
    throw error;
  } finally {
    await loading.destroy();
  }
}
