import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.NEXT_PUBLIC_SUPABASE_URL||import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloud=url&&key?createClient(url,key):null;

export async function fetchBook(){const {data,error}=await cloud.from('books').select('user_id,data,revision').limit(1).maybeSingle();if(error)throw error;return data}
export async function saveBook(bookId,userId,data,revision){
 if(revision===null){const r=await cloud.from('books').insert({user_id:userId,data,revision:1}).select('user_id,revision').single();if(r.error)throw r.error;return {bookId:r.data.user_id,revision:r.data.revision}}
 const r=await cloud.from('books').update({data,revision:revision+1,updated_at:new Date().toISOString()}).eq('user_id',bookId).eq('revision',revision).select('user_id,revision').maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('Catatan berubah di perangkat lain. Muat ulang halaman sebelum mencoba lagi.');return {bookId:r.data.user_id,revision:r.data.revision};
}
export async function fetchInvites(){const {data,error}=await cloud.rpc('pending_book_invites');if(error)throw error;return data||[]}
export async function invitePartner(email){const {data,error}=await cloud.rpc('invite_partner',{p_email:email});if(error)throw error;return data}
export async function acceptInvite(id){const {data,error}=await cloud.rpc('accept_book_invite',{p_invite_id:id});if(error)throw error;return data}
export async function declineInvite(id){const {error}=await cloud.rpc('decline_book_invite',{p_invite_id:id});if(error)throw error}
export async function fetchMembers(bookId){if(!bookId)return[];const {data,error}=await cloud.rpc('book_member_list',{p_book_user_id:bookId});if(error)throw error;return data||[]}
export async function sendInviteEmail(email){const {data:{session}}=await cloud.auth.getSession();if(!session)throw Error('Sesi akun tidak tersedia. Silakan masuk kembali.');const response=await fetch('/api/invite',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({email})});const result=await response.json();if(!response.ok)throw Error(result.error||'Email undangan belum dapat dikirim.');return result}
