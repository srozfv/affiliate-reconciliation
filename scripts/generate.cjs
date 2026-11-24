const fs=require('node:fs'),path=require('node:path');
const R=require('../dist/engine.js');
function generate(){
 let seed=81621;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const iso=n=>new Date(n).toISOString().replace('.000',''),base=Date.UTC(2026,3,1),day=86400000,cutoff=Date.UTC(2026,10,24,23,59,59),span=Math.floor((cutoff-base)/day)+1;
 const clicks=[],tracker=[],advertiser=[],contracts=[];
 for(const [partner,rate,pay] of [['north-seo','125.00','90.00'],['compare-lab','140.00','105.00'],['content-house','110.00','80.00']])contracts.push({partner_id:partner,offer_id:'mrq-inspired-cpa',country:'GB',valid_from:'2026-01-01',valid_to:'2026-12-31',currency:'GBP',advertiser_cpa:rate,partner_cpa:pay,min_deposit:'20.00',hold_days:'14'});
 for(let i=1;i<=6000;i++){
  const ct=base+Math.floor(random()*span)*day+Math.floor(random()*86400)*1000,wantsRegistration=random()<.31,partner=contracts[i%3],rt=ct+Math.floor(random()*8)*day+3600000,registered=wantsRegistration&&rt<=cutoff;
  const c={click_id:'clk_'+String(i).padStart(5,'0'),player_id:registered?'p_'+i:'',partner_id:partner.partner_id,offer_id:partner.offer_id,country:'GB',clicked_at:iso(ct),registered_at:registered?iso(rt):''};clicks.push(c);
  if(!registered||random()>.48)continue;
  const ft=rt+(1+Math.floor(random()*11))*day,ut=ft+2*day;if(ut>cutoff)continue;
  const tr={conversion_id:'ftd_'+i,click_id:c.click_id,player_id:c.player_id,occurred_at:iso(ft),updated_at:iso(ut),status:'approved',deposit_amount:String(20+Math.floor(random()*8)*10)+'.00',currency:'GBP'};
  const ad={conversion_id:tr.conversion_id,click_id:c.click_id,player_id:c.player_id,occurred_at:tr.occurred_at,updated_at:iso(ut+day),status:'approved',amount:partner.advertiser_cpa,currency:'GBP'};
  tracker.push(tr);
  const v=random();
  if(v<.025||ut+day>cutoff)continue;
  if(v<.05)ad.amount=(Number(ad.amount)-15).toFixed(2);
  else if(v<.075)ad.status='pending';
  else if(v<.09)ad.status='rejected';
  else if(v<.102)ad.status='reversed';
  else if(v<.112)ad.currency='EUR';
  else if(v<.122)ad.click_id='unmapped_'+i;
  else if(v<.132)tr.deposit_amount='10.00';
  advertiser.push(ad);
  if(i%31===0)tracker.push({...tr});
  if(i%47===0)advertiser.push({...ad,updated_at:iso(ut),status:'pending'});
  if(i%83===0)advertiser.push({...ad,amount:(Number(ad.amount)+5).toFixed(2)});
 }
 // Traceable scenarios not dependent on RNG. They exercise attribution and lifecycle changes.
 const add=(id,overC={},overT={},overA={})=>{
  const c={click_id:'case_'+id,player_id:'case_player_'+id,partner_id:'north-seo',offer_id:'mrq-inspired-cpa',country:'GB',clicked_at:'2026-08-01T10:00:00Z',registered_at:'2026-08-02T10:00:00Z',...overC};
  const t={conversion_id:id,click_id:c.click_id,player_id:c.player_id,occurred_at:'2026-08-03T10:00:00Z',updated_at:'2026-08-04T10:00:00Z',status:'approved',deposit_amount:'25.00',currency:'GBP',...overT};
  const a={conversion_id:id,click_id:c.click_id,player_id:c.player_id,occurred_at:t.occurred_at,updated_at:'2026-11-01T10:00:00Z',status:'approved',amount:'125.00',currency:'GBP',...overA};clicks.push(c);tracker.push(t);advertiser.push(a);return {c,t,a};
 };
 add('CASE_REG_DAY31',{registered_at:'2026-09-01T10:00:00Z'},{occurred_at:'2026-09-02T10:00:00Z',updated_at:'2026-09-03T10:00:00Z'});
 add('CASE_FTD_DAY91',{}, {occurred_at:'2026-11-01T10:00:00Z',updated_at:'2026-11-02T10:00:00Z'},{updated_at:'2026-11-03T10:00:00Z'});
 const old=add('CASE_LAST_CLICK');clicks.push({...old.c,click_id:'last_click_replacement',clicked_at:'2026-08-02T09:00:00Z'});
 const late=add('CASE_REVERSED',{}, {},{status:'reversed',updated_at:'2026-11-20T10:00:00Z'});advertiser.push({...late.a,status:'approved',updated_at:'2026-09-01T10:00:00Z'});
 const repeat=add('CASE_MULTIPLE_FTD');tracker.push({...repeat.t,conversion_id:'CASE_MULTIPLE_FTD_2',occurred_at:'2026-08-05T10:00:00Z',updated_at:'2026-08-06T10:00:00Z'});
 add('CASE_HOLD', {clicked_at:'2026-11-19T10:00:00Z',registered_at:'2026-11-20T10:00:00Z'},{occurred_at:'2026-11-21T10:00:00Z',updated_at:'2026-11-22T10:00:00Z'},{updated_at:'2026-11-23T10:00:00Z'});
 add('CASE_APRIL_OPENING',{clicked_at:'2026-04-01T08:00:00Z',registered_at:'2026-04-01T09:00:00Z'},{occurred_at:'2026-04-01T10:00:00Z',updated_at:'2026-04-02T10:00:00Z'},{updated_at:'2026-04-03T10:00:00Z'});
 add('CASE_CURRENT_DAY',{clicked_at:'2026-11-22T08:00:00Z',registered_at:'2026-11-23T09:00:00Z'},{occurred_at:'2026-11-24T10:00:00Z',updated_at:'2026-11-24T11:00:00Z',status:'pending'},{updated_at:'2026-11-24T12:00:00Z',status:'pending'});
 return {clicks,tracker,advertiser,contracts};
}
if(require.main===module){const d=generate(),root=path.join(__dirname,'..');for(const [k,rows] of Object.entries(d))fs.writeFileSync(path.join(root,'data',k+'.csv'),R.csv(rows,R.SCHEMA[k]));fs.writeFileSync(path.join(root,'dist','demo.js'),'window.DEMO_DATA='+JSON.stringify(d)+';\n');console.log(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.length])));}
module.exports={generate};
