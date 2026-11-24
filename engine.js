(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Recon=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DAY=86400000, STATUSES=['pending','approved','rejected','reversed'];
const SCHEMA={
 clicks:['click_id','player_id','partner_id','offer_id','country','clicked_at','registered_at'],
 tracker:['conversion_id','click_id','player_id','occurred_at','updated_at','status','deposit_amount','currency'],
 advertiser:['conversion_id','click_id','player_id','occurred_at','updated_at','status','amount','currency'],
 contracts:['partner_id','offer_id','country','valid_from','valid_to','currency','advertiser_cpa','partner_cpa','min_deposit','hold_days']
};
function fail(m){throw new Error(m);}
function stamp(s){if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(s))return NaN;const d=new Date(s);if(!Number.isFinite(+d)||d.toISOString().slice(0,19)!==s.slice(0,19))return NaN;return +d;}
function date(s){if(!/^\d{4}-\d\d-\d\d$/.test(s))return NaN;return stamp(s+'T00:00:00Z');}
function cents(s){const v=String(s);if(!/^\d+(?:\.\d{1,2})?$/.test(v))fail('Ожидается неотрицательная сумма с точкой и максимум 2 знаками: '+v);const [a,b='']=v.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>1e10)fail('Сумма вне допустимого диапазона');return n;}
function parseCSV(text){
 if(typeof text!=='string')fail('CSV должен быть текстом');text=text.replace(/^\uFEFF/,'');if(text.length>20*1024*1024)fail('Файл больше 20 МБ');
 const first=text.split(/\r?\n/,1)[0],sep=first.includes(';')?';':',';let rows=[],row=[],v='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){v+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else v+=c;}
 else if(c==='"'){if(v||closed)fail('Некорректная кавычка в CSV');quoted=true;}
 else if(c===sep){row.push(v);v='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x!==''))rows.push(row);row=[];v='';closed=false;}
 else {if(closed)fail('Текст после закрывающей кавычки');v+=c;}}
 if(quoted)fail('Незакрытая кавычка в CSV');row.push(v);if(row.some(x=>x!==''))rows.push(row);
 if(!rows.length)fail('Пустой CSV');const headers=rows.shift().map(x=>x.trim());if(headers.some(x=>!x)||new Set(headers).size!==headers.length)fail('Пустые или повторные заголовки');if(rows.length>100000)fail('Больше 100 000 строк');
 return rows.map((r,i)=>{if(r.length!==headers.length)fail('Неверное число колонок в строке '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
function csv(rows,columns){const cols=columns||Object.keys(rows[0]||{});const esc=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[cols,...rows.map(r=>cols.map(k=>r[k]))].map(r=>r.map(esc).join(',')).join('\r\n');}
function validate(kind,rows){
 if(!Array.isArray(rows)||!rows.length)fail(kind+': файл не содержит данных');if(rows.length>100000)fail(kind+': больше 100 000 строк');
 for(const [i,r] of rows.entries()){
  for(const k of SCHEMA[kind])if(!Object.hasOwn(r,k))fail(kind+': отсутствует колонка '+k);
  for(const k of SCHEMA[kind])if(r[k]===''&&!(kind==='clicks'&&['player_id','registered_at'].includes(k)))fail(kind+' строка '+(i+2)+': пустое '+k);
  const ts=kind==='clicks'?['clicked_at',...(r.registered_at?['registered_at']:[])]:kind==='contracts'?[]:['occurred_at','updated_at'];
  for(const k of ts)if(!Number.isFinite(stamp(r[k])))fail(kind+' строка '+(i+2)+': неверная UTC-дата '+k);
  if(kind==='clicks'&&Boolean(r.player_id)!==Boolean(r.registered_at))fail('Регистрация и player_id должны быть заполнены вместе');
  if(kind==='clicks'&&r.registered_at&&stamp(r.registered_at)<stamp(r.clicked_at))fail('Регистрация раньше клика');
  if(kind==='tracker'||kind==='advertiser'){if(!STATUSES.includes(r.status))fail('Неизвестный статус '+r.status);if(stamp(r.updated_at)<stamp(r.occurred_at))fail('updated_at раньше occurred_at');cents(kind==='tracker'?r.deposit_amount:r.amount);}
  if(kind!=='clicks'&&!/^[A-Z]{3}$/.test(r.currency))fail('Валюта должна быть ISO-кодом из 3 букв');
  if(kind==='contracts'){for(const k of ['advertiser_cpa','partner_cpa','min_deposit'])cents(r[k]);if(!Number.isFinite(date(r.valid_from))||!Number.isFinite(date(r.valid_to))||r.valid_from>r.valid_to)fail('Неверные даты договора');if(!/^\d+$/.test(r.hold_days)||+r.hold_days>365)fail('hold_days должен быть от 0 до 365');}
 }
}
function snapshots(rows,asof,key){const groups=new Map(),issues=[];let ignored=0,duplicates=0;
 for(const r of rows){if(stamp(r.updated_at)>asof||stamp(r.occurred_at)>asof){ignored++;continue;}const id=r[key];if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 const map=new Map(),ambiguous=new Set();
 for(const [id,rs] of groups){const uniq=new Map();for(const r of rs){const str=JSON.stringify(Object.keys(r).sort().map(k=>[k,r[k]]));if(uniq.has(str)){duplicates++;issues.push({code:'duplicate',id,detail:'Повторная доставка идентичной записи'});}else uniq.set(str,r);}
 const a=[...uniq.values()].sort((x,y)=>stamp(y.updated_at)-stamp(x.updated_at));const top=a.filter(x=>stamp(x.updated_at)===stamp(a[0].updated_at));
 const identities=new Set(a.map(x=>[x.click_id,x.player_id,x.occurred_at].join('|')));
 if(top.length>1||identities.size>1){ambiguous.add(id);issues.push({code:'conflict',id,detail:'Противоречивые снимки или смена идентичности конверсии'});}map.set(id,a[0]);}
 return {map,ambiguous,issues,ignored,duplicates};
}
function reconcile(input,options={}){
 for(const k of Object.keys(SCHEMA))validate(k,input[k]);
 const cutoff=options.asOf||'2026-11-24';if(!Number.isFinite(date(cutoff)))fail('Неверная дата среза');const asof=date(cutoff)+DAY-1;
 const start=options.start||'1900-01-01',end=options.end||cutoff;if(!Number.isFinite(date(start))||!Number.isFinite(date(end))||start>end||end>cutoff)fail('Неверный период: конец должен быть не позже среза');
 const t=snapshots(input.tracker,asof,'conversion_id'),a=snapshots(input.advertiser,asof,'conversion_id');
 const clicks=new Map(),clickBad=new Set(),quality=[...t.issues.map(x=>({...x,source:'tracker'})),...a.issues.map(x=>({...x,source:'advertiser'}))];
 for(const c of input.clicks){if(stamp(c.clicked_at)>asof)continue;if(clicks.has(c.click_id)){clickBad.add(c.click_id);quality.push({source:'clicks',code:'duplicate_click',id:c.click_id,detail:'Повторный click_id исключён из доверенных итогов'});}else clicks.set(c.click_id,c);}
 const contracts=input.contracts;
 // Registration attribution uses the final click at/before registration among observed clicks for the same player and offer.
 const last=new Map(),tied=new Set();for(const c of clicks.values()){if(!c.player_id||!c.registered_at||stamp(c.registered_at)>asof)continue;const key=c.player_id+'|'+c.offer_id;const prev=last.get(key);if(!prev||stamp(c.clicked_at)>stamp(prev.clicked_at)){last.set(key,c);tied.delete(key);}else if(stamp(c.clicked_at)===stamp(prev.clicked_at))tied.add(key);}
 const playerCounts=new Map();for(const r of t.map.values())playerCounts.set(r.player_id,(playerCounts.get(r.player_id)||0)+1);
 const ledger=[];
 for(const id of new Set([...t.map.keys(),...a.map.keys()])){
  const tr=t.map.get(id),ad=a.map.get(id),r=tr||ad,day=r.occurred_at.slice(0,10);if(day<start||day>end)continue;
  const c=clicks.get(r.click_id),partner=c?.partner_id||'unattributed',offer=c?.offer_id||'unknown',country=c?.country||'unknown';
  if(options.partner&&options.partner!==partner)continue;
  const flags=[],blocking=[];const flag=(s,block=false)=>{flags.push(s);if(block)blocking.push(s);};
  if(!tr)flag('missing_tracker',true);if(!ad)flag('missing_advertiser',true);
  if(t.ambiguous.has(id)||a.ambiguous.has(id))flag('snapshot_conflict',true);
  if(!c||clickBad.has(r.click_id))flag('invalid_click',true);
  if(tr&&ad&&(tr.click_id!==ad.click_id||tr.player_id!==ad.player_id||tr.occurred_at!==ad.occurred_at))flag('identity_mismatch',true);
  if(tr&&ad&&tr.status!==ad.status)flag('status_mismatch');
  if(tr&&playerCounts.get(tr.player_id)>1)flag('multiple_ftd',true);
  let contract=null,eligible=false;
  if(c){const cs=contracts.filter(x=>x.partner_id===partner&&x.offer_id===offer&&x.country===country&&x.valid_from<=day&&x.valid_to>=day);if(cs.length!==1)flag(cs.length?'overlapping_contract':'missing_contract',true);else contract=cs[0];
   if(c.player_id!==r.player_id)flag('player_mismatch',true);
   if(!c.registered_at||stamp(c.registered_at)>asof||stamp(c.registered_at)>stamp(r.occurred_at))flag('invalid_registration',true);
   else {if(stamp(c.registered_at)-stamp(c.clicked_at)>30*DAY)flag('registration_window',true);if(stamp(r.occurred_at)-stamp(c.registered_at)>90*DAY)flag('deposit_window',true);if(last.get(c.player_id+'|'+offer)?.click_id!==c.click_id||tied.has(c.player_id+'|'+offer))flag('not_last_click',true);}
  }
  if(contract){if((tr&&tr.currency!==contract.currency)||(ad&&ad.currency!==contract.currency))flag('currency_mismatch',true);if(tr&&cents(tr.deposit_amount)<cents(contract.min_deposit))flag('below_min_deposit',true);}
  eligible=!!tr&&!!contract&&!blocking.some(x=>!['missing_advertiser'].includes(x));
  const expected=eligible?cents(contract.advertiser_cpa):0, actual=ad?.status==='approved'?cents(ad.amount):0;
  if(ad&&ad.status==='approved'&&eligible&&actual!==expected)flag('amount_mismatch');
  if(ad?.status==='reversed')flag('reversed');if(ad?.status==='rejected')flag('rejected');
  if(ad?.status==='pending')flag('pending');
  const clean=blocking.length===0,recognized=clean&&ad?.status==='approved'?actual:0;
  const payable=clean&&ad?.status==='approved'?cents(contract.partner_cpa):0;
  const dueAt=ad&&contract?stamp(ad.updated_at)+Number(contract.hold_days)*DAY:Infinity;
  const held=payable>0&&dueAt>asof;
  // Unreconciled exposure is a candidate shortfall for investigation, never booked revenue.
  const exposure=eligible?Math.max(0,expected-(ad?.status==='approved'&&ad.currency===contract.currency?actual:0)):0;
  ledger.push({conversion_id:id,player_id:r.player_id,click_id:r.click_id,day,partner_id:partner,offer_id:offer,country,currency:contract?.currency||r.currency,tracker_status:tr?.status||'absent',advertiser_status:ad?.status||'absent',expected_cents:expected,reported_cents:actual,reported_currency:ad?.currency||'',recognized_cents:recognized,partner_cents:payable,margin_cents:recognized-payable,due_cents:held?0:payable,held_cents:held?payable:0,exposure_cents:exposure,eligible,clean,flags});
 }
 const finance={};for(const r of ledger){const f=finance[r.currency]||(finance[r.currency]={currency:r.currency,recognized_cents:0,partner_cents:0,margin_cents:0,due_cents:0,held_cents:0,exposure_cents:0});for(const k of Object.keys(f))if(k!=='currency')f[k]+=r[k];}
 const selected=[...clicks.values()].filter(c=>!clickBad.has(c.click_id)&&c.clicked_at.slice(0,10)>=start&&c.clicked_at.slice(0,10)<=end&&(!options.partner||c.partner_id===options.partner));
 const regs=new Set(selected.filter(c=>c.registered_at&&stamp(c.registered_at)<=asof&&stamp(c.registered_at)-stamp(c.clicked_at)<=30*DAY&&last.get(c.player_id+'|'+c.offer_id)?.click_id===c.click_id&&!tied.has(c.player_id+'|'+c.offer_id)).map(c=>c.player_id));
 const selectedIds=new Set(selected.map(c=>c.click_id));
 const ftds=new Set([...t.map.values()].filter(r=>selectedIds.has(r.click_id)&&regs.has(r.player_id)).map(r=>r.player_id));
 return {ledger,finance:Object.values(finance),quality,cutoff,start,end,funnel:{clicks:selected.length,registrations:regs.size,ftd:ftds.size},meta:{trackerRows:input.tracker.length,advertiserRows:input.advertiser.length,trackerUnique:t.map.size,advertiserUnique:a.map.size,duplicates:t.duplicates+a.duplicates,ignored:t.ignored+a.ignored,ambiguous:t.ambiguous.size+a.ambiguous.size},counts:ledger.reduce((acc,r)=>{for(const f of r.flags)acc[f]=(acc[f]||0)+1;return acc;},{})};
}
return {SCHEMA,parseCSV,csv,validate,reconcile,cents,stamp};
});
