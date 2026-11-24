const fs=require('node:fs'),path=require('node:path'),R=require('../dist/engine.js');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'../data'));
const input=Object.fromEntries(Object.keys(R.SCHEMA).map(k=>[k,R.parseCSV(fs.readFileSync(path.join(dir,k+'.csv'),'utf8'))]));
const result=R.reconcile(input,{asOf:process.argv[3]||'2026-11-24'});
const out=path.join(__dirname,'../results');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({...result,ledger:undefined,quality:undefined},null,2));
fs.writeFileSync(path.join(out,'ledger.csv'),R.csv(result.ledger.map(x=>({...x,flags:x.flags.join('|')}))));
fs.writeFileSync(path.join(out,'quality.csv'),R.csv(result.quality,['source','code','id','detail']));
console.log(JSON.stringify({rows:result.ledger.length,finance:result.finance,counts:result.counts,meta:result.meta},null,2));
