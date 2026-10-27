import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActivity, parseSchedule, eventsForDate } from '../dist/schedule.mjs';
import { decodeDisciplineCodes } from '../dist/discipline-names.mjs';

test('user example: hours and course, with no inferred group from MSPPS_1', () => {
  const activity = parseActivity('15-20_MSPPS_1_c_Det_MC_L11-1.1');
  assert.equal(activity.start, '15:00');
  assert.equal(activity.end, '20:00');
  assert.equal(activity.type, 'Curs');
  assert.deepEqual(activity.programs, ['MSPPS']);
  assert.deepEqual(activity.groups, []);
});

test('explicit groups work with separators and both cases of seminar marker', () => {
  const activity = parseActivity('16-18_Bioetica MSPPS_s gr3,4_BS_JVI3');
  assert.equal(activity.type, 'Seminar');
  assert.deepEqual(activity.groups, ['3','4']);
  assert.equal(parseActivity('8-11_Bioetica MSPPS_S gr 1,2_DaC_KP18').type, 'Seminar');
  assert.deepEqual(parseActivity('9-13_MSPPS_2_gr1_Audit_RL, BI').groups, ['1']);
  assert.deepEqual(parseActivity('16-21_S 1,2, MSPPS_MKT_MB_J Constr').groups, []);
});

test('invalid hours are rejected, including reversed intervals', () => {
  for (const text of ['24-25_INFO-A', '20-15_INFO-A', '15:75-20:00_INFO-A', '15-15_INFO-A']) assert.equal(parseActivity(text), null);
  assert.equal(parseActivity('09:30–11:45_INFO-A_c').start, '09:30');
});

test('permanent legend decodes whole codes and preserves unknown names', () => {
  assert.equal(parseActivity('15-20_MSPPS_c_INFO-A').title, 'Informatică medicală. Biostatistică');
  assert.equal(decodeDisciplineCodes('info-a / MCS-M').matches.length, 2);
  assert.equal(decodeDisciplineCodes('INFO-A1 INFO-A-extra MKT Audit Bioetica').matches.length, 0);
  assert.equal(decodeDisciplineCodes('ANATO-M').title, 'Anatomie și Embriologie');
  assert.equal(decodeDisciplineCodes('ÎNGCHIR-A').matches[0].code, 'ÎNGCHIR-A');
});

test('ambiguous legend codes retain both names', () => {
  const result = decodeDisciplineCodes('CARD-M');
  assert.deepEqual(result.matches[0].names, ['Cardiologie intervențională','Cardiologie pediatrică']);
  assert.match(result.title, /Cardiologie intervențională \/ Cardiologie pediatrică/);
});

const item = (str,x,y) => ({ str, transform:[1,0,0,3,x,y], height:3 });
function week(label,range,y,entries) {
  return [item(label,60,y),item(range,67,y), ...['Luni','Marți','Miercuri','Joi','Vineri','Sambata','Duminica'].map((name,i)=>item(name,90+i*55,y)),item('I',55,y-5),item('II',55,y-25), ...entries.map(([text,day,offset])=>item(text,90+day*55,y-offset))];
}

test('table geometry excludes year I and places year II on the correct dates', () => {
  const result = parseSchedule([week('S4','26.10.-01.11.2026',500,[
    ['15-20_MSPPS_1_c_Det_MC_L11-1.1',0,5],
    ['16-20_C, MSPPS&MSIP_MKT_MB_J Constr',1,25],
    ['9-13_MSPPS_2_gr1_Audit_RL, BI',2,25],
    ['16-21_MSPPS_2_gr2_Audit_AE_Spit ICCO',3,25],
  ])]);
  assert.equal(result.events.length,3);
  assert.equal(result.events[0].date,'2026-10-27');
  assert.equal(result.events[1].date,'2026-10-28');
  assert.ok(result.events.every(event=>!event.raw.includes('_Det_')));
  assert.equal(eventsForDate(result,'2026-10-28','1').length,1);
  assert.equal(eventsForDate(result,'2026-10-28','4').length,0);
  assert.equal(eventsForDate(result,'2026-10-27','4').length,1);
});

test('wrapped year II text is joined without mixing days', () => {
  const result=parseSchedule([week('S6','09 -15-11.2026',500,[
    ['16-20_MSPPS_c_INFO-A',0,21],['_gr 1,2',0,25],
    ['16-21_MSPPS_c_MCS-M',1,25],
  ])]);
  assert.equal(result.weeks[0].start,'2026-11-09');
  assert.deepEqual(result.events[0].groups,['1','2']);
  assert.equal(result.events[0].date,'2026-11-09');
  assert.equal(result.events[1].date,'2026-11-10');
});

test('inconsistent year is reported without silently changing the PDF date', () => {
  const result=parseSchedule([[
    ...week('S13','11-17.01.2027',500,[['16-20_MSPPS_c_INFO-A',0,25]]),
    ...week('S14','18-22.01.2021',400,[['16-20_MSPPS_c_MCS-M',0,25]]),
  ]]);
  assert.equal(result.weeks.length,1);
  assert.equal(result.events.length,1);
  assert.match(result.warnings[0],/2021/);
});

test('a document without the year II table fails clearly', () => {
  assert.throws(()=>parseSchedule([[item('A different PDF',90,500)]]),/Nu am identificat/);
});
