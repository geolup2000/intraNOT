import path from 'node:path';
import {createRequire} from 'node:module';
import {parseSchedule} from './dist/schedule.mjs';

const require=createRequire(import.meta.url);
let pdfjsPromise;

export async function extractSchedule(bytes) {
  pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs=await pdfjsPromise;
  const packageRoot=path.dirname(require.resolve('pdfjs-dist/package.json'));
  const loading=pdfjs.getDocument({
    data:Uint8Array.from(bytes),
    isEvalSupported:false,
    useSystemFonts:true,
    standardFontDataUrl:path.join(packageRoot,'standard_fonts').split(path.sep).join('/')+'/',
  });
  try {
    const document=await loading.promise;
    const pages=[];
    for(let number=1;number<=document.numPages;number++) {
      const page=await document.getPage(number);
      pages.push((await page.getTextContent()).items);
      page.cleanup();
    }
    return parseSchedule(pages);
  } catch(error) {
    let message=error.message;
    if(error.name==='PasswordException')message='PDF-ul este protejat cu parolă. Încarcă o copie fără parolă.';
    if(['InvalidPDFException','MissingPDFException','UnexpectedResponseException'].includes(error.name))message='PDF-ul nu poate fi citit sau este deteriorat.';
    throw Object.assign(new Error(message||'Orarul nu a putut fi extras din PDF.'),{status:422});
  } finally {
    await loading.destroy();
  }
}
