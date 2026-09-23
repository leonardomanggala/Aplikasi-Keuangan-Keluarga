import 'dotenv/config';
import postgres from 'postgres';
import {readFile} from 'node:fs/promises';

const connectionString=process.env.POSTGRES_URL_NON_POOLING||process.env.POSTGRES_URL;
if(!connectionString) throw new Error('POSTGRES_URL_NON_POOLING atau POSTGRES_URL belum tersedia.');
const sql=postgres(connectionString,{ssl:'require',max:1});
try{
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await sql.unsafe(schema);
  console.log('Schema FamBudget berhasil diterapkan.');
} finally {
  await sql.end();
}
