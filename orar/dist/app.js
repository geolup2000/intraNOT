import { dateKey, eventsForDate, PROGRAMS } from './schedule.mjs';
import { readSchedule } from './pdf-reader.mjs';

const $ = (s) => document.querySelector(s);
const DEFAULT_PDF = 'orar-master.pdf';
const DEFAULT_NAME = '05_Master_sem1_2026-2027_V2.pdf';
const shortDays = ['lun.', 'mar.', 'mie.', 'joi', 'vin.', 'sâm.', 'dum.'];
const fullDays = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
let preferences;
try { preferences = JSON.parse(localStorage.getItem('intranot-preferences')) || {}; } catch { preferences = {}; }
const state = { group: ['1','2','3','4'].includes(preferences.group) ? preferences.group : '4', subgroup: ['A','B','Toate'].includes(preferences.subgroup) ? preferences.subgroup : 'A', lastday: [5,6,7].includes(preferences.lastday) ? preferences.lastday : 5 };
let selected = today(), activeSetting, pdfUrl = null, pdfName = '', timer, importing = false;
let schedule = null, loadingSchedule = true, scheduleError = '';
function today() { const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const val = t => Number(parts.find(p=>p.type===t).value); return new Date(val('year'),val('month')-1,val('day'),12); }
function monday(date) { const d = new Date(date); d.setDate(d.getDate() - (d.getDay()+6)%7); return d; }
function sameDay(a,b) { return a.toDateString() === b.toDateString(); }
function render() {
  $('#date-title').textContent = selected.toLocaleDateString('ro-RO', {weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  const start = monday(selected), actualToday = today();
  $('#days').replaceChildren(); $('#days').style.setProperty('--day-count',state.lastday); $('#days').classList.toggle('weekend',state.lastday>5);
  for(let i=0;i<state.lastday;i++) { const date = new Date(start); date.setDate(start.getDate()+i); const button = document.createElement('button'); button.className='day'; button.setAttribute('aria-pressed',String(sameDay(selected,date))); button.setAttribute('aria-label', date.toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})); if(sameDay(date,actualToday))button.setAttribute('aria-current','date'); const n=document.createElement('span'); n.className='day-number'; n.textContent=date.getDate(); const name=document.createElement('span'); name.className='day-name';name.textContent=shortDays[i];button.append(n,name);button.onclick=()=>{selected=date;render();};$('#days').append(button); }
  $('#group-value').textContent=state.group; $('#subgroup-value').textContent=state.subgroup;
  $('#context-label').textContent=`Anul II · Grupa ${state.group} · ${state.subgroup==='Toate'?'Toate semigrupele':`Semigrupa ${state.subgroup}`}`;
  renderSchedule();
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function renderSchedule() {
  const activities = schedule ? eventsForDate(schedule, selected, state.group) : [];
  $('#schedule').hidden = !activities.length;
  $('#empty-state').hidden = !!activities.length;
  $('#activity-list').replaceChildren();
  $('#activity-count').textContent = `${activities.length} ${activities.length === 1 ? 'activitate' : 'activități'} · Grupa ${state.group}`;
  for (const activity of activities) {
    const card = element('article', 'activity');
    const time = element('div', 'activity-time');
    time.append(element('span', 'start-time', activity.start), element('span', 'end-time', activity.end));
    const content = element('div', 'activity-content');
    const metadata = element('div', 'activity-meta');
    metadata.append(element('span', `activity-type ${activity.type === 'Seminar' ? 'seminar' : ''}`, activity.type));
    metadata.append(element('span', 'activity-group', activity.groups.length ? `${activity.groups.length === 1 ? 'Grupa' : 'Grupele'} ${activity.groups.join(', ')}` : 'Fără grupă indicată'));
    content.append(metadata, element('h4', 'activity-title', activity.title));
    if (activity.programs.length) content.append(element('p', 'activity-program', activity.programs.map(code => PROGRAMS[code] || code).join(' · ')));
    const details = element('details', 'activity-source');
    details.append(element('summary', '', 'Text din PDF'), element('p', 'source-text', activity.raw), element('p', 'source-reference', `Anul II · ${activity.week} · pagina ${activity.page}`));
    for (const match of activity.disciplineMatches) details.append(element('p', 'source-reference', `Cod ${match.code} · legenda disciplinelor, ${match.pages.length === 1 ? 'pagina' : 'paginile'} ${match.pages.join(', ')}${match.names.length > 1 ? ' · cod cu mai multe denumiri' : ''}`));
    content.append(details);
    card.append(time, content);
    $('#activity-list').append(card);
  }
  if (!activities.length) {
    let title, description;
    if (loadingSchedule) { title = 'Se citește orarul…'; description = 'Se extrag activitățile anului II din PDF.'; }
    else if (scheduleError) { title = 'Orarul nu a putut fi importat.'; description = scheduleError; }
    else if (!schedule) { title = 'Încarcă PDF-ul orarului.'; description = 'Deschide meniul sau apasă „Încarcă PDF” pentru a importa activitățile anului II.'; }
    else {
      const key = dateKey(selected);
      const covered = schedule?.weeks.some(week => key >= week.start && key <= week.end);
      title = covered ? 'Nu ai activități în această zi.' : 'Nu există orar pentru această dată.';
      description = covered ? `Nicio activitate din anul II pentru grupa ${state.group}.` : 'Selectează o zi din intervalul PDF-ului sau încarcă un alt orar.';
    }
    $('#empty-title').textContent = title;
    $('#empty-description').textContent = description;
  }
  $('.pdf-link').hidden = !pdfUrl;
  $('[data-action="pdf"]').hidden = !pdfUrl;
  $('#view-uploaded').hidden = !pdfUrl;
  $('#import-notice').hidden = !schedule?.warnings.length;
  $('#import-notice').textContent = schedule?.warnings.length ? `${schedule.warnings.length} ${schedule.warnings.length === 1 ? 'observație' : 'observații'} la import · Vezi detalii` : '';
}
function closeMenu() { $('#menu').hidden=true; $('#menu-toggle').setAttribute('aria-expanded','false'); }
function notify(text) { clearTimeout(timer); $('#toast').textContent=text; $('#toast').hidden=false; timer=setTimeout(()=>$('#toast').hidden=true,3500); }
function savePreferences() { try { localStorage.setItem('intranot-preferences',JSON.stringify(state)); } catch { notify('Preferințele sunt active doar pentru această sesiune.'); } }
function currentDay() { selected=today(); if((selected.getDay()+6)%7>=state.lastday) { state.lastday=(selected.getDay()+6)%7+1;savePreferences(); } render(); }
$('#menu-toggle').onclick=()=>{ const open=$('#menu').hidden; $('#menu').hidden=!open; $('#menu-toggle').setAttribute('aria-expanded',String(open)); };
document.addEventListener('click',event=>{if(!event.target.closest('#menu')&&!event.target.closest('#menu-toggle'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();$('#menu-toggle').focus();}});
$('#prev').onclick=()=>{selected.setDate(selected.getDate()-7);render();};$('#next').onclick=()=>{selected.setDate(selected.getDate()+7);render();};
function openSettings(kind) { activeSetting=kind; const options = kind==='group'?['1','2','3','4']:kind==='subgroup'?['A','B','Toate']:[5,6,7]; const title=kind==='group'?'Schimbă grupa':kind==='subgroup'?'Schimbă semigrupa':'Ultima zi a orarului'; $('#settings-title').textContent=title; const label=document.createElement('label'); label.className='field';label.textContent=kind==='group'?'Grupa ta':kind==='subgroup'?'Semigrupa ta':'Afișează săptămâna până'; const select=document.createElement('select');select.name='value'; for(const v of options){ const o=new Option(kind==='lastday'?fullDays[v-1]:String(v),String(v)); o.selected=String(v)===String(state[kind]);select.add(o); }label.append(select);$('#settings-fields').replaceChildren(label);$('#settings').showModal(); }
$('#settings-form').onsubmit=event=>{event.preventDefault();const value=new FormData(event.target).get('value');state[activeSetting]=activeSetting==='lastday'?Number(value):value;if((selected.getDay()+6)%7>=state.lastday)selected=monday(selected);savePreferences();render();$('#settings').close();notify('Preferințele au fost salvate.');};
$('#menu').onclick=event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;closeMenu();if(action==='today')currentDay();else if(action==='upload')openUpload();else if(action==='pdf')openPdf();else if(action==='legend')openDocument('legenda-discipline.pdf','Codificare_orar_discipline_2026.pdf');else openSettings(action);};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function updateImportReport() {
  const decoded = schedule?.events.filter(event => event.disciplineMatches.length).length || 0;
  $('#import-summary').textContent = schedule ? `${schedule.events.length} activități din anul II · ${schedule.weeks.length} săptămâni importate. Denumiri din legendă: ${decoded} activități.` : '';
  $('#import-warnings').hidden = !schedule?.warnings.length;
  $('#warnings-title').textContent = schedule?.warnings.length ? `De verificat: ${schedule.warnings.length} ${schedule.warnings.length === 1 ? 'observație' : 'observații'}` : '';
  $('#warnings-list').replaceChildren(...(schedule?.warnings || []).map(warning => element('li', '', warning)));
}
function openUpload() { $('#file-name').textContent=pdfName?`Fișier curent: ${pdfName}`:'Niciun PDF încărcat.';$('#upload-status').textContent='';updateImportReport();$('#upload-dialog').showModal(); }
function openDocument(url, name) { $('#preview-name').textContent=name;$('#pdf-dialog h2').textContent=url==='legenda-discipline.pdf'?'Legenda disciplinelor':'PDF-ul orarului';$('#pdf-preview').data=url;$('#download-pdf').href=url;$('#download-pdf').download=name;$('#pdf-dialog').showModal(); }
function openPdf() { if(pdfUrl)openDocument(pdfUrl,pdfName);else openUpload(); }
$('#open-pdf').onclick=openPdf; $('#footer-upload').onclick=openUpload;$('#import-notice').onclick=()=>{openUpload();$('#import-warnings').open=true;};$('#view-uploaded').onclick=()=>{$('#upload-dialog').close();openPdf();};
function database() { return new Promise((resolve,reject)=>{const request=indexedDB.open('intranot',1);request.onupgradeneeded=()=>request.result.createObjectStore('documents');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}); }
async function storePdf(file) {const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');tx.objectStore('documents').put(file,'schedule');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
async function restorePdf() { try{const db=await database();const file=await new Promise((resolve,reject)=>{const req=db.transaction('documents').objectStore('documents').get('schedule');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();if(file){pdfUrl=URL.createObjectURL(file);pdfName=file.name;return file;}}catch{/* The bundled PDF remains available when storage is disabled. */}return null; }
async function initializeSchedule() {
  try {
    const configResponse = await fetch('/api/local-documents');
    if (!configResponse.ok) throw new Error('Pornește aplicația cu npm start sau start-local.cmd.');
    const documents = await configResponse.json();
    $('[data-action="legend"]').hidden = !documents.legend;
    const file = await restorePdf();
    let buffer;
    if (file) buffer = await file.arrayBuffer();
    else if (documents.schedule) { const response = await fetch(DEFAULT_PDF); if (!response.ok) throw new Error('PDF-ul implicit nu este disponibil. Încarcă un fișier din meniu.'); buffer = await response.arrayBuffer();pdfUrl=DEFAULT_PDF;pdfName=DEFAULT_NAME; }
    else return;
    schedule = await readSchedule(buffer);
  } catch (error) { scheduleError = error.message || 'Încarcă din nou PDF-ul din meniu.'; }
  finally { loadingSchedule = false; render(); updateImportReport(); }
}
async function importPdf(file) {
 if(importing||!file)return;importing=true;$('#upload-status').textContent='Se verifică fișierul…';
 $('#pdf-input').disabled=true;$('#drop-zone').setAttribute('aria-busy','true');
 try {
   await initialization;
   if(!/\.pdf$/i.test(file.name))throw new Error('Alege un fișier cu extensia .pdf.');
   if(file.size>20*1024*1024)throw new Error('Fișierul depășește limita de 20 MB.');
   const buffer=await file.arrayBuffer();
   const signature=new TextDecoder().decode(buffer.slice(0,1024));
   if(!signature.includes('%PDF-'))throw new Error('Fișierul nu are un format PDF valid.');
   $('#upload-status').textContent='Se extrage orarul anului II…';
   const imported=await readSchedule(buffer);
   // Replace the current document only after both parsing and persistence succeed.
   await storePdf(file);
   if(pdfUrl?.startsWith('blob:'))URL.revokeObjectURL(pdfUrl);
   pdfUrl=URL.createObjectURL(file);pdfName=file.name;schedule=imported;scheduleError='';
   $('#file-name').textContent=`Fișier curent: ${pdfName}`;
   $('#upload-status').textContent=`Import finalizat: ${schedule.events.length} activități din anul II.`;
   updateImportReport();render();notify('Orarul anului II a fost importat.');
 }catch(error){$('#upload-status').textContent=error.name==='QuotaExceededError'?'Spațiul de stocare al browserului este insuficient.':error.message||'PDF-ul nu a putut fi salvat în acest browser.';}
 finally{importing=false;$('#pdf-input').value='';$('#pdf-input').disabled=false;$('#drop-zone').removeAttribute('aria-busy');}
}
$('#pdf-input').onchange=event=>importPdf(event.target.files[0]);const zone=$('#drop-zone');for(const type of ['dragenter','dragover'])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.add('dragover');});for(const type of ['dragleave','drop'])zone.addEventListener(type,event=>{event.preventDefault();zone.classList.remove('dragover');});zone.addEventListener('drop',event=>importPdf(event.dataTransfer.files[0]));
render();const initialization=initializeSchedule();
