import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l && !l.startsWith('#'))
    .map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]})
)
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
if(!url || !key){ console.error('faltou URL/KEY'); process.exit(1) }
const supabase = createClient(url, key)

const _cnabChunk=(arr,n)=>{const o=[];for(let i=0;i<arr.length;i+=n)o.push(arr.slice(i,i+n));return o}
const _titKeys=(raw)=>{const str=String(raw||'');const keys=new Set();const digits=str.replace(/\D/g,'');if(!digits)return keys;keys.add(digits.replace(/^0+/,'')||digits);const segs=str.split(/\D+/).filter(Boolean);if(segs.length>1){const perSeg=segs.map(x=>x.replace(/^0+/,'')||x).join('');keys.add(perSeg.replace(/^0+/,'')||perSeg)}return keys}
const _keysIntersect=(a,b)=>{for(const k of a){if(b.has(k))return true}return false}

async function fetchPend(cols){const out=[];let from=0;const ps=1000;while(true){const {data,error}=await supabase.from('RET_CONTACAPT').select(cols).is('NUM_LANCA',null).range(from,from+ps-1);if(error){console.error('pend',error.message);break}if(!data||!data.length)break;out.push(...data);if(data.length<ps)break;from+=ps}return out}
async function batchUpdate(assign, metodo, score){const byNum={};for(const a of assign){(byNum[a.num]=byNum[a.num]||[]).push(a.hash)}let atualizados=0,falhas=0;for(const num of Object.keys(byNum)){for(const c of _cnabChunk(byNum[num],150)){const {error}=await supabase.from('RET_CONTACAPT').update({NUM_LANCA:String(num),link_metodo:metodo,link_score:score}).in('hash_dedup',c);if(error){falhas+=c.length;console.error('upd',error.message)}else atualizados+=c.length}}return {atualizados,falhas}}

async function routine1(){
  const pend=await fetchPend('hash_dedup, VR_TITULO, NUM_TITULO')
  if(!pend.length)return {total:0,atualizados:0,semMatch:0,falhas:0}
  const valores=[...new Set(pend.map(r=>Number(r.VR_TITULO)||0).filter(v=>v>0))]
  const opList={}
  for(const c of _cnabChunk(valores,200)){let from=0;const ps=1000;while(true){const {data,error}=await supabase.from('OPEITE').select('NUM_LANCAMENTO, NUM_TITULO, VR_FACE, STATUS').in('VR_FACE',c).range(from,from+ps-1);if(error){console.error('op1',error.message);break}if(!data||!data.length)break;data.forEach(o=>{const isDC=String(o.STATUS||'').toUpperCase()==='DC';const cents=Math.round((parseFloat(o.VR_FACE)||0)*100);(opList[cents]=opList[cents]||[]).push({num:o.NUM_LANCAMENTO,keys:_titKeys(o.NUM_TITULO),isDC})});if(data.length<ps)break;from+=ps}}
  const assign=[];let semMatch=0
  for(const r of pend){const cents=Math.round((Number(r.VR_TITULO)||0)*100);const pk=_titKeys(r.NUM_TITULO);const candsAll=(opList[cents]||[]).filter(o=>_keysIntersect(pk,o.keys));const candsND=candsAll.filter(o=>!o.isDC);const cands=candsND.length?candsND:candsAll;const distintos=[...new Set(cands.map(o=>o.num))];if(distintos.length===1)assign.push({hash:r.hash_dedup,num:distintos[0]});else semMatch++}
  const {atualizados,falhas}=await batchUpdate(assign,'titulo+valor',60)
  return {total:pend.length,atualizados,semMatch,falhas}
}

async function routine2(){
  const pend=await fetchPend('hash_dedup, VENCIMENTO, NUM_TITULO')
  const pendV=pend.filter(r=>r.VENCIMENTO)
  if(!pendV.length)return {total:pend.length,atualizados:0,semMatch:pend.length,falhas:0}
  const vencs=[...new Set(pendV.map(r=>String(r.VENCIMENTO).slice(0,10)))]
  const opList={};const seen=new Set()
  const fetchBy=async(col)=>{for(const c of _cnabChunk(vencs,100)){let from=0;const ps=1000;while(true){const {data,error}=await supabase.from('OPEITE').select('NUM_LANCAMENTO, NUM_TITULO, DT_VENCI, DT_VENCI_NOVO, STATUS').in(col,c).range(from,from+ps-1);if(error){console.error('op2',error.message);break}if(!data||!data.length)break;data.forEach(o=>{const kk=`${o.NUM_LANCAMENTO}`;if(seen.has(kk))return;seen.add(kk);const st=String(o.STATUS||'').toUpperCase();const venc=String((st==='PR'&&o.DT_VENCI_NOVO)?o.DT_VENCI_NOVO:(o.DT_VENCI||'')).slice(0,10);if(!venc)return;(opList[venc]=opList[venc]||[]).push({num:o.NUM_LANCAMENTO,keys:_titKeys(o.NUM_TITULO),isDC:st==='DC'})});if(data.length<ps)break;from+=ps}}}
  await fetchBy('DT_VENCI');await fetchBy('DT_VENCI_NOVO')
  const assign=[];let semMatch=0
  for(const r of pendV){const venc=String(r.VENCIMENTO).slice(0,10);const pk=_titKeys(r.NUM_TITULO);const candsAll=(opList[venc]||[]).filter(o=>_keysIntersect(pk,o.keys));const candsND=candsAll.filter(o=>!o.isDC);const cands=candsND.length?candsND:candsAll;const distintos=[...new Set(cands.map(o=>o.num))];if(distintos.length===1)assign.push({hash:r.hash_dedup,num:distintos[0]});else semMatch++}
  const {atualizados,falhas}=await batchUpdate(assign,'venc+titulo',70)
  return {total:pend.length,atualizados,semMatch,falhas}
}

const antes=(await supabase.from('RET_CONTACAPT').select('*',{count:'exact',head:true}).is('NUM_LANCA',null)).count
const r1=await routine1()
const r2=await routine2()
const depois=(await supabase.from('RET_CONTACAPT').select('*',{count:'exact',head:true}).is('NUM_LANCA',null)).count
console.log(JSON.stringify({antes_sem_lanca:antes, rotina1_titulo_valor:r1, rotina2_venc_titulo:r2, depois_sem_lanca:depois}, null, 2))
