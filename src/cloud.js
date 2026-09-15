import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud=url&&key?createClient(url,key):null;
export async function fetchBook(userId){const {data,error}=await cloud.from('books').select('data,revision').eq('user_id',userId).maybeSingle();if(error)throw error;return data}
export async function saveBook(userId,data,revision){if(revision===null){const r=await cloud.from('books').insert({user_id:userId,data,revision:1}).select('revision').single();if(r.error)throw r.error;return r.data.revision}const r=await cloud.from('books').update({data,revision:revision+1}).eq('user_id',userId).eq('revision',revision).select('revision').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('Catatan berubah di perangkat lain. Muat ulang halaman sebelum mencoba lagi.');return r.data.revision}
