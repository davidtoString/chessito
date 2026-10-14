import { identity, json, failure } from '../../../lib/server';
export async function GET(req:Request){try{await identity(req);return json({engines:[],message:'Native engines are available in the self-hosted Docker app.'});}catch(e){return failure(e);}}
