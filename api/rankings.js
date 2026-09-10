import { buildValuation } from './valuation-engine.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const {context}=req.body||{};
    const data=await buildValuation(context,{includeWaivers:true});
    return res.json(data);
  }catch(e){
    return res.status(500).json({error:e.message});
  }
}
