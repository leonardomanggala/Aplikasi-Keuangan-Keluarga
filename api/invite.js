import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Metode tidak didukung.'});
 if(!url||!secret)return res.status(503).json({error:'Layanan email belum dikonfigurasi.'});
 const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(!token||!email)return res.status(400).json({error:'Email atau sesi tidak tersedia.'});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await admin.auth.getUser(token);
 if(userError||!user)return res.status(401).json({error:'Sesi akun tidak valid.'});
 const {data:owner,error:ownerError}=await admin.from('book_members').select('book_user_id').eq('user_id',user.id).eq('role','owner').maybeSingle();
 if(ownerError||!owner)return res.status(403).json({error:'Hanya pemilik buku yang dapat mengirim undangan.'});
 const {data:pending}=await admin.from('book_invites').select('id').eq('book_user_id',owner.book_user_id).eq('email',email).eq('status','pending').maybeSingle();
 if(!pending)return res.status(403).json({error:'Buat undangan di aplikasi terlebih dahulu.'});
 const redirectTo=process.env.APP_URL||'https://uang-rumah-one.vercel.app/';
 const {error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo});
 if(error){
  const message=error.message?.toLowerCase()||'';
  if(message.includes('already')||message.includes('registered'))return res.status(200).json({sent:false,existing:true});
  return res.status(502).json({error:'Undangan tersimpan, tetapi email belum dapat dikirim.',detail:error.message});
 }
 return res.status(200).json({sent:true});
}
