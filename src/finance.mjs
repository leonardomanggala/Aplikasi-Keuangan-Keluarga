export const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n || 0);
export const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const baseCategories = [
 {id:'dapur',name:'Belanja Dapur',icon:'ShoppingBasket',color:'orange',type:'expense',budget:2000000},
 {id:'tagihan',name:'Tagihan Rumah',icon:'Zap',color:'blue',type:'expense',budget:1500000},
 {id:'anak',name:'Kebutuhan Anak',icon:'GraduationCap',color:'mint',type:'expense',budget:1000000},
 {id:'transportasi',name:'Transportasi',icon:'Bus',color:'purple',type:'expense',budget:750000},
 {id:'hiburan',name:'Hiburan',icon:'Coffee',color:'pink',type:'expense',budget:400000},
 {id:'kesehatan',name:'Kesehatan',icon:'HeartPulse',color:'pink',type:'expense',budget:200000},
 {id:'lainnya',name:'Lainnya',icon:'Shapes',color:'mint',type:'expense',budget:150000},
 {id:'gaji',name:'Gaji & Penghasilan',icon:'Banknote',color:'mint',type:'income',budget:0},
 {id:'usaha',name:'Usaha & Bonus',icon:'BriefcaseBusiness',color:'blue',type:'income',budget:0}
];
export function summary(book,month){const ts=book.transactions.filter(t=>t.date.startsWith(month));const income=ts.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),expense=ts.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);const balance=book.opening+book.transactions.filter(t=>t.date.slice(0,7)<=month).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);return {income,expense,balance,transactions:ts.sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created),budget:book.categories.filter(c=>c.type==='expense').reduce((s,c)=>s+getBudget(book,c,month),0)}}
export function getBudget(book,c,month){return book.budgets?.[month]?.[c.id]??c.budget??0}
export function validateTransaction(t){if(!Number.isSafeInteger(t.amount)||t.amount<=0||t.amount>999999999999)throw Error('Isi nominal antara Rp1 dan Rp999.999.999.999.');if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||Number.isNaN(Date.parse(t.date)))throw Error('Pilih tanggal yang valid.');if(!t.category)throw Error('Pilih kategori transaksi.');return t}
export function newBook(name='Keluargaku',owner='Anda',opening=0){return {name,owner,opening,categories:structuredClone(baseCategories),budgets:{},transactions:[]}}
export function demoBook(){const b=newBook('Keluarga Rina & Budi','Bu Rina',1000000),m=today().slice(0,7);const rows=[['gaji','Gaji bulanan Pak Budi',8000000,'income',5,'Pak Budi','Transfer Bank'],['dapur','Belanja sayur & telur',65000,'expense',10,'Bu Rina','Tunai'],['tagihan','Token listrik rumah',200000,'expense',9,'Pak Budi','Transfer Bank'],['anak','Uang SPP anak',500000,'expense',8,'Bu Rina','Transfer Bank'],['transportasi','Isi bensin motor',35000,'expense',8,'Pak Budi','Tunai'],['dapur','Belanja dapur bulanan',1735000,'expense',6,'Bu Rina','Tunai'],['tagihan','Tagihan rumah bulanan',1000000,'expense',6,'Pak Budi','Transfer Bank'],['anak','Buku dan kebutuhan sekolah',400000,'expense',6,'Bu Rina','Transfer Bank'],['transportasi','Transportasi keluarga',465000,'expense',6,'Pak Budi','E-Wallet'],['hiburan','Makan bersama keluarga',250000,'expense',6,'Bu Rina','E-Wallet'],['lainnya','Kebutuhan rumah lainnya',100000,'expense',6,'Bu Rina','Tunai']];b.transactions=rows.map(([category,note,amount,type,day,author,method],i)=>({id:crypto.randomUUID(),category,note,amount,type,date:`${m}-${String(day).padStart(2,'0')}`,author,method,created:i}));return b}
