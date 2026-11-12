import React, { useState, useEffect, useMemo } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { anyApi } from 'convex/server';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import { 
  Wallet, ArrowDownLeft, ArrowUpRight, Zap, FileUp, Filter, Search, 
  Settings, LogOut, CheckCircle2, AlertCircle, RefreshCw, UserCheck, 
  Users, ShieldCheck, Download, Coffee, ShoppingBag, Landmark, Utensils
} from 'lucide-react';

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if ((char === ',' || char === ';') && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell.trim());
      if (row.some(value => value)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(value => value)) rows.push(row);
  return rows;
}

const normalizeHeader = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
const parseRupiah = (value) => {
  const cleaned = String(value || '').trim().replace(/\s/g, '');
  const negative = /^-/.test(cleaned) || /\bDB\b/i.test(cleaned) || /^\(.*\)$/.test(cleaned);
  const number = cleaned.replace(/[^\d.,]/g, '');
  let normalized = number;
  if (number.includes(',')) normalized = number.replace(/\./g, '').replace(',', '.');
  else if ((number.match(/\./g) || []).length > 1) normalized = number.replace(/\./g, '');
  else if (/\.\d{3}$/.test(number)) normalized = number.replace('.', '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round((negative ? -amount : amount) * 100) / 100 : NaN;
};
const normalizeDate = (value) => {
  const text = String(value || '').trim();
  const localDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?$/);
  if (localDate) return `${localDate[3]}-${localDate[2].padStart(2, '0')}-${localDate[1].padStart(2, '0')} ${localDate[4] || '00:00:00'}`;
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/);
  return isoDate ? `${isoDate[1]} ${isoDate[2] || '00:00:00'}` : '';
};

export default function App() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const [authView, setAuthView] = useState('login');
  const [selectedAuthRole, setSelectedAuthRole] = useState('SUAMI');
  const [authError, setAuthError] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chartRange, setChartRange] = useState('all');
  const [hoveredChartPoint, setHoveredChartPoint] = useState(null);
  const [householdNotice, setHouseholdNotice] = useState('');
  const api = anyApi;
  const familyState = useQuery(api.households.current, isAuthenticated ? {} : 'skip');
  const dbTransactions = useQuery(api.transactions.list, isAuthenticated && familyState?.household ? {} : 'skip');
  const createOrJoinHousehold = useMutation(api.households.createOrJoin);
  const updateFamilyName = useMutation(api.households.updateFamilyName);
  const updateProfileName = useMutation(api.households.updateProfileName);
  const updateChartPreference = useMutation(api.households.updateChartRange);
  const addTransactions = useMutation(api.transactions.addMany);
  const currentUser = familyState?.user ? {
    id: familyState.user._id,
    name: familyState.user.name || '',
    email: familyState.user.email || '',
    role: familyState.user.role || 'SUAMI',
    familyName: familyState.user.familyName || '',
    joinCode: familyState.user.joinCode || '',
  } : null;
  const transactions = useMemo(() => (dbTransactions || []).map(transaction => ({
    id: transaction._id,
    date: transaction.date,
    owner: transaction.ownerRole,
    desc: transaction.description,
    amount: transaction.amount,
    balance: transaction.balance || 0,
    cat: transaction.category,
  })), [dbTransactions]);

  useEffect(() => {
    if (familyState?.user?.chartRange) setChartRange(familyState.user.chartRange);
  }, [familyState?.user?.chartRange]);

  const householdName = familyState?.household?.name || currentUser?.familyName || '';
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadNotice, setUploadNotice] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfPasswordPrompt, setPdfPasswordPrompt] = useState(null);
  const [pdfPasswordInput, setPdfPasswordInput] = useState('');
  const pdfPasswordCancelled = React.useRef(false);

  // Login Handler
  const handleRegister = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmation')) {
      setAuthError('Konfirmasi kata sandi belum cocok.');
      return;
    }
    form.set('flow', 'signUp');
    form.set('role', selectedAuthRole);
    form.set('name', String(form.get('name') || '').trim());
    form.set('familyName', String(form.get('familyName') || '').trim());
    form.set('joinCode', String(form.get('joinCode') || '').trim().toUpperCase());
    try { await signIn('password', form); }
    catch (error) { setAuthError(error.message || 'Pendaftaran gagal. Periksa data lalu coba lagi.'); }
  };

  const handleRegisteredLogin = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('flow', 'signIn');
    try { await signIn('password', form); setAuthError(''); }
    catch (error) { setAuthError(error.message || 'Email atau kata sandi tidak cocok.'); }
  };

  const handleSaveProfile = (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('name').trim();
    updateProfileName({ name }).then(() => setSettingsNotice('Profil berhasil diperbarui.')).catch(error => setSettingsNotice(error.message));
  };

  const handleSaveHousehold = (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('householdName').trim();
    updateFamilyName({ name }).then(() => setSettingsNotice('Nama keluarga berhasil disimpan.')).catch(error => setSettingsNotice(error.message));
  };

  const handleCreateOrJoinHousehold = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const familyName = String(form.get('familyName') || '').trim();
      const joinCode = String(form.get('joinCode') || '').trim() || undefined;
      if (!familyName && !joinCode) throw new Error('Isi nama rumah tangga atau gunakan kode undangan.');
      await createOrJoinHousehold({ familyName: familyName || 'Rumah tangga', joinCode });
      setHouseholdNotice('Rumah tangga berhasil disiapkan.');
    } catch (error) { setHouseholdNotice(error.message || 'Tidak dapat menyiapkan rumah tangga.'); }
  };

  // Logout Handler
  const handleLogout = async () => {
    await signOut();
    setActiveTab('dashboard');
  };

  const parsePdfTransactions = (text) => {
    const datePattern = /\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\s+\d{4}\b/ig;
    // Statement amounts use grouped thousands (e.g. -500.000,00). Excluding
    // ungrouped digit strings prevents account/reference numbers being read as money.
    const moneyPattern = /[+-]?\(?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\)?(?:\s*(?:DB|CR|DR))?/gi;
    const monthMap = { jan:'01', feb:'02', mar:'03', apr:'04', mei:'05', may:'05', jun:'06', jul:'07', agu:'08', aug:'08', sep:'09', okt:'10', oct:'10', nov:'11', des:'12', dec:'12' };
    const result = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const dateMatch = rawLine.match(datePattern);
      if (!dateMatch) continue;
      let rawDate = dateMatch[0];
      const rawTime = rawLine.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] || '00:00:00';
      if (/\b[A-Za-z]{3}\b/.test(rawDate)) {
        const parts = rawDate.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
        if (!parts) continue;
        rawDate = `${parts[1]}/${monthMap[parts[2].toLowerCase()]}/${parts[3]}`;
      }
      const date = normalizeDate(`${rawDate} ${rawTime}`);
      let tail = rawLine.replace(datePattern, ' ').replace(/\s+/g, ' ').trim();
      // Bank statements often place reference numbers inside the description.
      // In Mandiri statements the last two grouped money values are nominal and balance.
      const values = [...tail.matchAll(moneyPattern)].map(match => ({ raw: match[0].trim(), index: match.index }));
      if (values.length < 2) continue;
      const amountToken = values[values.length - 2];
      const balanceToken = values[values.length - 1];
      const description = tail.slice(0, amountToken.index).replace(/[|:•-]+$/g, '').trim();
      if (!description || /^(saldo|balance|total|mutasi|tanggal|date)\b/i.test(description)) continue;
      const amount = parseRupiah(amountToken.raw);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const signedAmount = amount;
      const lastValue = parseRupiah(balanceToken.raw);
      const lower = description.toLowerCase();
      const category = /pln|listrik|indihome|telkom|air|tagihan/.test(lower) ? 'Utilitas & Tagihan' : /transfer|ovo|gopay|dana|shopeepay/.test(lower) ? 'Transfer & E-Wallet' : /makan|resto|soto|kopi|qris|qr ke/.test(lower) ? 'Kuliner & Kopi' : 'Belanja Retail';
      result.push({ ownerRole: currentUser?.role || 'SUAMI', date, description, amount: signedAmount, balance: Number.isFinite(lastValue) ? lastValue : undefined, category });
    }
    // Cross-check the extracted text against the running balance before allowing a save.
    for (let index = 1; index < result.length; index++) {
      const previous = result[index - 1];
      const current = result[index];
      const delta = Math.round((current.balance - previous.balance) * 100) / 100;
      if (Math.abs(delta - current.amount) <= 0.02) current.amount = delta;
      else if (Math.abs(delta + current.amount) <= 0.02) current.amount = delta;
      // Some PDFs place the previous row's balance beside the next description.
      // Correct only when that exact balance is selected;
      // the next row's balance then gives the transaction amount unambiguously.
      else if (Math.abs(Math.abs(current.amount) - previous.balance) <= 0.02) {
        current.amount = delta;
        current.textBalanceCorrection = true;
      }
      else throw new Error(`Validasi saldo gagal pada transaksi ${index + 1} (${current.date}). Nominal dalam teks PDF terbaca ${current.amount.toLocaleString('id-ID')}, sedangkan perubahan saldonya ${delta.toLocaleString('id-ID')}. Susunan teks atau saldo pada baris ini tidak cocok, jadi impor dihentikan agar data keliru tidak tersimpan. Periksa PDF atau gunakan CSV mutasi.`);
    }
    return result;
  };

  const readPdfText = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfPasswordCancelled.current = false;
    const loadingTask = pdfjs.getDocument({ data: bytes });
    loadingTask.onPassword = (updatePassword, reason) => {
      setPdfPasswordInput('');
      setPdfPasswordPrompt({
        error: reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD,
        submit: (password) => {
          setPdfPasswordPrompt(null);
          setPdfPasswordInput('');
          updatePassword(password);
        },
        cancel: () => {
          pdfPasswordCancelled.current = true;
          setPdfPasswordPrompt(null);
          setPdfPasswordInput('');
          loadingTask.destroy();
        },
      });
    };
    const pdfDoc = await loadingTask.promise;
    let fullText = '';
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      setUploadNotice({ type: 'loading', msg: `Mengambil teks langsung dari halaman PDF ${pageNumber} dari ${pdfDoc.numPages}...` });
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = [];
      for (const item of textContent.items) {
        if (!item.str?.trim()) continue;
        const x = item.transform?.[4] ?? 0;
        const y = item.transform?.[5] ?? 0;
        let line = lines.find(candidate => Math.abs(candidate.y - y) <= 2.5);
        if (!line) { line = { y, items: [] }; lines.push(line); }
        line.items.push({ x, width: item.width || 0, text: item.str.trim() });
      }
      const pageLines = lines.sort((a, b) => b.y - a.y).map(line => {
        const parts = line.items.sort((a, b) => a.x - b.x);
        return parts.reduce((text, part, index) => {
          if (!index) return part.text;
          const previous = parts[index - 1];
          const gap = part.x - (previous.x + previous.width);
          return `${text}${gap > 2 ? ' ' : ''}${part.text}`;
        }, '');
      });
      // Keep wrapped descriptions and amounts with their transaction date. Text
      // PDFs often store each visual baseline separately even within one row.
      const transactionBlocks = [];
      for (const line of pageLines) {
        if (/\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|Mei|May|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec)\s+\d{4}\b/i.test(line)) {
          transactionBlocks.push(line);
        } else if (transactionBlocks.length) {
          transactionBlocks[transactionBlocks.length - 1] += ` ${line}`;
        }
      }
      fullText += `\n${transactionBlocks.join('\n')}`;
    }
    return fullText;
  };

  const importTransactions = async (transactionsToImport) => {
    const result = await addTransactions({ transactions: transactionsToImport });
    setUploadNotice({ type: 'success', msg: `Impor selesai: ${result.added} transaksi ditambahkan, ${result.skipped} duplikat dilewati.` });
    setPdfPreview(null);
  };

  // Import CSV or text-based PDF e-statements into the signed-in household.
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'pdf'].includes(extension)) {
      setUploadNotice({ type: 'error', msg: 'Pilih berkas CSV atau PDF.' });
      e.target.value = '';
      return;
    }
    setUploadNotice({ type: 'loading', msg: `Membaca e-statement: ${file.name}...` });
    try {
      if (extension === 'pdf') {
        const text = await readPdfText(file);
        if (text.replace(/\s/g, '').length < 80) throw new Error('PDF ini tidak memiliki teks digital yang dapat dibaca. Gunakan PDF asli yang teksnya dapat dipilih/disalin atau CSV mutasi.');
        const parsed = parsePdfTransactions(text);
        if (!parsed.length) throw new Error('Teks PDF berhasil dibaca, tetapi susunan transaksi belum dikenali. Coba PDF mutasi lain atau CSV.');
        setPdfPreview({ fileName: file.name, transactions: parsed });
        setUploadNotice(null);
        return;
      }
      const rows = parseCsvRows(await file.text());
      if (rows.length < 2) throw new Error('Berkas CSV belum berisi baris transaksi.');
      const headers = rows[0].map(normalizeHeader);
      const findColumn = (...names) => headers.findIndex(header => names.includes(header));
      const dateIndex = findColumn('tanggal', 'tgl', 'date', 'transactiondate');
      const descriptionIndex = findColumn('keterangan', 'description', 'deskripsi', 'desc', 'narrative');
      const amountIndex = findColumn('nominal', 'amount', 'mutasi', 'jumlah');
      const balanceIndex = findColumn('saldo', 'balance');
      const categoryIndex = findColumn('kategori', 'category');
      const ownerIndex = findColumn('pemilik', 'owner', 'role');
      if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) throw new Error('Header wajib: tanggal, keterangan, nominal. Header opsional: saldo, kategori, pemilik.');
      const parsed = rows.slice(1).map(row => {
        const description = row[descriptionIndex]?.trim();
        const date = normalizeDate(row[dateIndex]);
        const amount = parseRupiah(row[amountIndex]);
        const explicitCategory = categoryIndex >= 0 ? row[categoryIndex]?.trim() : '';
        const text = (description || '').toLowerCase();
        const category = explicitCategory || (/pln|listrik|indihome|telkom|air|tagihan/.test(text) ? 'Utilitas & Tagihan' : /transfer|ovo|gopay|dana|shopeepay/.test(text) ? 'Transfer & E-Wallet' : /makan|resto|soto|kopi|qris|qr ke/.test(text) ? 'Kuliner & Kopi' : 'Belanja Retail');
        const owner = ownerIndex >= 0 && /istri|ika/i.test(row[ownerIndex] || '') ? 'ISTRI' : ownerIndex >= 0 && /suami|leonardo/i.test(row[ownerIndex] || '') ? 'SUAMI' : currentUser.role;
        const balanceValue = balanceIndex >= 0 && row[balanceIndex] ? parseRupiah(row[balanceIndex]) : undefined;
        return { ownerRole: owner, date, description, amount, balance: Number.isFinite(balanceValue) ? balanceValue : undefined, category };
      }).filter(transaction => transaction.date && transaction.description && Number.isFinite(transaction.amount));
      if (!parsed.length) throw new Error('Tidak ada transaksi valid. Periksa kolom tanggal, keterangan, dan nominal.');
      await importTransactions(parsed);
    } catch (error) {
      if (!pdfPasswordCancelled.current) setUploadNotice({ type: 'error', msg: error.message || 'Gagal membaca berkas.' });
    } finally { e.target.value = ''; }
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const matchOwner = selectedOwnerFilter === 'ALL' || t.owner === selectedOwnerFilter;
      const matchCat = selectedCategoryFilter === 'ALL' || t.cat === selectedCategoryFilter;
      const matchSearch = t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.cat.toLowerCase().includes(searchQuery.toLowerCase());
      return matchOwner && matchCat && matchSearch;
    });
  }, [transactions, selectedOwnerFilter, selectedCategoryFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let utilitas = 0;

    filteredData.forEach(t => {
      if (t.amount > 0) income += t.amount;
      else {
        expense += Math.abs(t.amount);
        if (t.cat === 'Utilitas & Tagihan') utilitas += Math.abs(t.amount);
      }
    });

    const latestTransaction = filteredData.reduce((latest, transaction) => (
      !latest || transaction.date > latest.date ? transaction : latest
    ), null);
    const latestOverall = transactions.reduce((latest, transaction) => (
      !latest || transaction.date > latest.date ? transaction : latest
    ), null);
    const openingBalance = Number(familyState?.household?.legacyData?.opening || 0);
    const currentBalance = latestOverall?.balance ?? openingBalance + transactions.reduce((balance, transaction) => balance + transaction.amount, 0);
    return { income, expense, utilitas, currentBalance, latestTransaction };
  }, [filteredData, transactions, familyState?.household?.legacyData?.opening]);

  const cashFlowPoints = useMemo(() => {
    const grouped = filteredData.reduce((days, transaction) => {
      const date = transaction.date.slice(0, 10);
      if (!days[date]) days[date] = { date, income: 0, expense: 0 };
      if (transaction.amount > 0) days[date].income += transaction.amount;
      else days[date].expense += Math.abs(transaction.amount);
      return days;
    }, {});
    const sorted = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    if (chartRange === 'all' || !sorted.length) return sorted;
    const latestDate = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
    const cutoff = new Date(latestDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - Number(chartRange) + 1);
    return sorted.filter(point => new Date(`${point.date}T00:00:00Z`) >= cutoff);
  }, [filteredData, chartRange]);

  const spendingCategories = useMemo(() => {
    const totals = filteredData.reduce((result, transaction) => {
      if (transaction.amount < 0) result[transaction.cat] = (result[transaction.cat] || 0) + Math.abs(transaction.amount);
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredData]);

  const formatRupiah = (amount) => `Rp ${amount.toLocaleString('id-ID')}`;
  const formatChartDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const chartWidth = 720;
  const chartHeight = 248;
  const chartLeft = 50;
  const chartTop = 20;
  const chartBottom = 204;
  const chartPlotWidth = chartWidth - chartLeft - 18;
  const chartPlotHeight = chartBottom - chartTop;
  const chartMax = Math.max(1, ...cashFlowPoints.flatMap(point => [point.income, point.expense]));
  const chartGroupWidth = chartPlotWidth / Math.max(cashFlowPoints.length, 1);
  const chartBarWidth = Math.max(3, Math.min(14, chartGroupWidth * 0.32));
  const activeChartPoint = cashFlowPoints.find(point => point.date === hoveredChartPoint) || cashFlowPoints[cashFlowPoints.length - 1];
  const categoryMax = Math.max(1, ...spendingCategories.map(([, amount]) => amount));

  // LOGIN SCREEN GATING
  if (authLoading || (isAuthenticated && familyState === undefined)) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Menghubungkan akun...</div>;
  }

  if (!isAuthenticated) {
    const authInput = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 lg:grid lg:grid-cols-[1fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 font-black shadow-lg shadow-blue-950/50">DK</div>
            <span className="text-lg font-bold tracking-tight">DanaKeluarga</span>
          </div>
          <div className="relative max-w-lg">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-300">Keuangan yang lebih terarah</p>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">Kelola keuangan rumah tangga, bersama.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Pantau pemasukan, pengeluaran, dan transaksi keluarga dalam satu dasbor yang mudah dipahami.</p>
            <div className="mt-9 flex items-center gap-3 text-sm text-slate-300"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Data keuangan keluarga tersusun rapi</div>
          </div>
          <p className="relative text-xs text-slate-500">© 2026 DanaKeluarga</p>
        </aside>

        <div className="flex min-h-screen items-center justify-center p-5 sm:p-8">
          <section className="w-full max-w-md">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white">DK</div>
              <h1 className="text-xl font-bold">DanaKeluarga</h1>
            </div>
            <div className="mb-7">
              <p className="text-sm font-semibold text-blue-600">Selamat datang</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{authView === 'login' ? 'Masuk ke akun Anda' : 'Buat akun keluarga'}</h1>
              <p className="mt-2 text-sm text-slate-500">{authView === 'login' ? 'Masuk menggunakan email dan kata sandi akun Anda.' : 'Daftarkan profil Anda untuk mulai menggunakan DanaKeluarga.'}</p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => { setAuthView('login'); setAuthError(''); }} className={`rounded-lg py-2.5 text-sm font-semibold transition ${authView === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Masuk</button>
              <button type="button" onClick={() => { setAuthView('register'); setAuthError(''); }} className={`rounded-lg py-2.5 text-sm font-semibold transition ${authView === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Daftar</button>
            </div>

            {authError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{authError}</div>}

            {authView === 'login' ? (
              <form onSubmit={handleRegisteredLogin} className="space-y-4">
                <label className="block text-xs font-semibold text-slate-700">Email<input className={`${authInput} mt-1.5`} name="email" type="email" autoComplete="email" placeholder="nama@email.com" required /></label>
                <label className="block text-xs font-semibold text-slate-700">Kata sandi<input className={`${authInput} mt-1.5`} name="password" type="password" autoComplete="current-password" placeholder="Masukkan kata sandi" required /></label>
                <button type="submit" className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Masuk</button>
                <p className="pt-1 text-center text-xs leading-5 text-slate-400">Belum memiliki akun? Pilih tab Daftar untuk membuat akun keluarga.</p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <label className="block text-xs font-semibold text-slate-700">Nama lengkap<input className={`${authInput} mt-1.5`} name="name" autoComplete="name" placeholder="Contoh: Leonardo Manggala" required /></label>
                <label className="block text-xs font-semibold text-slate-700">Email<input className={`${authInput} mt-1.5`} name="email" type="email" autoComplete="email" placeholder="nama@email.com" required /></label>
                <label className="block text-xs font-semibold text-slate-700">Nama rumah tangga<input className={`${authInput} mt-1.5`} name="familyName" placeholder="Contoh: Keluarga Wardhana" /></label>
                <label className="block text-xs font-semibold text-slate-700">Kode undangan (jika bergabung dengan keluarga yang sudah ada)<input className={`${authInput} mt-1.5 uppercase`} name="joinCode" autoCapitalize="characters" placeholder="Kosongkan jika membuat rumah tangga baru" /></label>
                <div>
                  <span className="block text-xs font-semibold text-slate-700">Peran dalam keluarga</span>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {[['SUAMI', '👨‍💼', 'Suami'], ['ISTRI', '👩‍💼', 'Istri']].map(([role, emoji, label]) => <button key={role} type="button" aria-pressed={selectedAuthRole === role} onClick={() => setSelectedAuthRole(role)} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${selectedAuthRole === role ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/10' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}><span className="text-lg">{emoji}</span>{label}</button>)}
                  </div>
                </div>
                <label className="block text-xs font-semibold text-slate-700">Kata sandi<input className={`${authInput} mt-1.5`} name="password" type="password" autoComplete="new-password" minLength="8" placeholder="Minimal 8 karakter" required /></label>
                <label className="block text-xs font-semibold text-slate-700">Konfirmasi kata sandi<input className={`${authInput} mt-1.5`} name="confirmation" type="password" autoComplete="new-password" minLength="8" placeholder="Ulangi kata sandi" required /></label>
                <button type="submit" className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700">Buat akun</button>
                <p className="text-center text-xs leading-5 text-slate-400">Anggota keluarga lain dapat bergabung menggunakan kode undangan dari menu Pengaturan.</p>
              </form>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !familyState?.household) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
        <form onSubmit={handleCreateOrJoinHousehold} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-black text-white">DK</div>
          <div><h1 className="text-xl font-bold">Siapkan rumah tangga</h1><p className="mt-1 text-sm leading-6 text-slate-500">Buat rumah tangga baru, atau masukkan kode undangan dari anggota keluarga untuk berbagi transaksi.</p></div>
          {householdNotice && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{householdNotice}</div>}
          <label className="block text-xs font-semibold text-slate-700">Nama rumah tangga<input name="familyName" defaultValue={currentUser?.familyName} placeholder="Contoh: Keluarga Wardhana" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
          <label className="block text-xs font-semibold text-slate-700">Kode undangan (opsional)<input name="joinCode" defaultValue={currentUser?.joinCode} autoCapitalize="characters" placeholder="Isi untuk bergabung dengan keluarga lain" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-500" /></label>
          <button className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">Lanjutkan</button>
          <button type="button" onClick={handleLogout} className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800">Keluar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* HEADER NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-lg shadow-sm">
              DK
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight">DanaKeluarga</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                Keluarga Wardhana
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="hidden md:flex items-center px-3 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700 mr-2">
              <span className="mr-1.5">{currentUser.role === 'SUAMI' ? '👨‍💼' : '👩‍💼'}</span>
              <span>{currentUser.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-4 h-12 items-center text-xs font-medium">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`h-full border-b-2 px-3 flex items-center space-x-2 transition ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`h-full border-b-2 px-3 flex items-center space-x-2 transition ${
                activeTab === 'transactions'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Daftar Transaksi</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`h-full border-b-2 px-3 flex items-center space-x-2 transition ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {pdfPasswordPrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pdf-password-title">
            <form onSubmit={(event) => { event.preventDefault(); if (pdfPasswordInput) pdfPasswordPrompt.submit(pdfPasswordInput); }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 id="pdf-password-title" className="text-lg font-bold text-slate-900">PDF ini dikunci kata sandi</h2>
              <p className="mt-2 text-sm text-slate-600">Masukkan kata sandi PDF untuk membukanya dan melanjutkan pembacaan.</p>
              {pdfPasswordPrompt.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">Kata sandi salah. Silakan coba lagi.</p>}
              <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="pdf-password-input">Kata sandi PDF</label>
              <input id="pdf-password-input" type="password" autoComplete="off" autoFocus value={pdfPasswordInput} onChange={event => setPdfPasswordInput(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
              <p className="mt-2 text-[11px] text-slate-500">Kata sandi hanya digunakan di browser untuk membuka berkas.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={pdfPasswordPrompt.cancel} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Batal</button>
                <button type="submit" disabled={!pdfPasswordInput} className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Buka PDF</button>
              </div>
            </form>
          </div>
        )}

        {pdfPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pdf-preview-title">
            <section className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 p-5">
                <h2 id="pdf-preview-title" className="text-lg font-bold text-slate-900">Periksa hasil baca PDF</h2>
                <p className="mt-1 text-xs text-slate-500">{pdfPreview.transactions.length} transaksi terbaca dari {pdfPreview.fileName}. Pastikan tanggal, keterangan, dan tanda debit/kredit sudah benar sebelum disimpan.{pdfPreview.transactions.some(transaction => transaction.textBalanceCorrection) && <span className="mt-1 block font-medium text-amber-700">Beberapa nominal disesuaikan memakai selisih saldo karena PDF menempatkan saldo sebelumnya dekat dengan transaksi berikutnya.</span>}</p>
              </div>
              <div className="overflow-auto p-4">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="p-2">Tanggal</th><th className="p-2">Keterangan</th><th className="p-2 text-right">Mutasi</th><th className="p-2 text-right">Saldo</th></tr></thead>
                  <tbody>{pdfPreview.transactions.map((transaction, index) => <tr key={`${transaction.date}-${index}`} className="border-b border-slate-100"><td className="whitespace-nowrap p-2">{transaction.date}</td><td className="min-w-48 p-2">{transaction.description}</td><td className={`whitespace-nowrap p-2 text-right font-semibold ${transaction.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{transaction.amount.toLocaleString('id-ID')}</td><td className="whitespace-nowrap p-2 text-right">{Number.isFinite(transaction.balance) ? transaction.balance.toLocaleString('id-ID') : '—'}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
                <button type="button" onClick={() => setPdfPreview(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">Batal</button>
                <button type="button" onClick={() => importTransactions(pdfPreview.transactions).catch(error => setUploadNotice({ type: 'error', msg: error.message || 'Gagal menyimpan transaksi.' }))} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Simpan transaksi</button>
              </div>
            </section>
          </div>
        )}
        
        {/* Upload Alert */}
        {uploadNotice && (
          <div className={`p-4 rounded-xl border text-xs flex justify-between items-center ${
            uploadNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : uploadNotice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center space-x-2">
              {uploadNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : uploadNotice.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />}
              <span>{uploadNotice.msg}</span>
            </div>
            <button onClick={() => setUploadNotice(null)} className="font-bold text-slate-500 hover:text-slate-800">Tutup</button>
          </div>
        )}

        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header Control Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ringkasan Analisis Keuangan</h2>
                <p className="text-xs text-slate-500">Ringkasan transaksi keluarga yang tersimpan di Convex.</p>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <select
                  value={selectedOwnerFilter}
                  onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">👨‍💼👩‍💼 Gabungan (Suami & Istri)</option>
                  <option value="SUAMI">👨‍💼 Suami (Leonardo)</option>
                  <option value="ISTRI">👩‍💼 Istri (Ika Puspita)</option>
                </select>

                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition inline-flex items-center space-x-2 shadow-sm">
                  <FileUp className="w-4 h-4" />
                  <span>Upload CSV / PDF e-Statement</span>
                  <input type="file" accept=".csv,text/csv,.pdf,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>SALDO TERAKHIR</span>
                  <Wallet className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  Rp {summary.currentBalance.toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {summary.latestTransaction
                    ? `Per ${new Date(summary.latestTransaction.date.replace(' ', 'T')).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                    : 'Belum ada transaksi'}
                </span>
                {summary.latestTransaction && <span className="mt-1 block truncate text-[10px] text-slate-400" title={summary.latestTransaction.desc}>{summary.latestTransaction.desc}</span>}
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>TOTAL PEMASUKAN</span>
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-emerald-600 mt-2">
                  +Rp {summary.income.toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Setoran & Transfer Masuk</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>TOTAL PENGELUARAN</span>
                  <ArrowUpRight className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black text-rose-600 mt-2">
                  -Rp {summary.expense.toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">{filteredData.length} Transaksi Diproses</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                  <span>UTILITAS & TAGIHAN</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">
                  Rp {summary.utilitas.toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Listrik, Indihome, Indosat</span>
              </div>
            </div>

            {/* INTERACTIVE CASH FLOW CHARTS */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="cash-flow-title">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 id="cash-flow-title" className="text-sm font-bold text-slate-900">Tren arus kas</h3>
                    <p className="mt-1 text-xs text-slate-500">Pilih batang untuk melihat rincian per hari</p>
                  </div>
                  <div className="flex self-start rounded-lg bg-slate-100 p-1" aria-label="Rentang waktu grafik">
                    {[['7', '7 hari'], ['30', '30 hari'], ['all', 'Semua']].map(([range, label]) => (
                      <button key={range} type="button" onClick={() => { setChartRange(range); setHoveredChartPoint(null); }} aria-pressed={chartRange === range} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${chartRange === range ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex min-h-12 items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">{activeChartPoint ? formatChartDate(activeChartPoint.date) : 'Belum ada data'}</p>
                      {activeChartPoint && <p className="mt-1 text-[10px] text-slate-500">Masuk <span className="font-bold text-emerald-700">{formatRupiah(activeChartPoint.income)}</span><span className="mx-2 text-slate-300">•</span>Keluar <span className="font-bold text-rose-700">{formatRupiah(activeChartPoint.expense)}</span></p>}
                    </div>
                    {activeChartPoint && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${activeChartPoint.income >= activeChartPoint.expense ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{activeChartPoint.income >= activeChartPoint.expense ? 'Arus kas positif' : 'Pengeluaran lebih besar'}</span>}
                  </div>
                  <div className="w-full overflow-x-auto">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Grafik batang interaktif pemasukan dan pengeluaran harian" className="h-auto min-w-[540px] w-full select-none">
                      {[0, 1, 2, 3].map(index => {
                        const y = chartTop + chartPlotHeight * index / 3;
                        const amount = chartMax * (1 - index / 3);
                        return <g key={index}><line x1={chartLeft} x2={chartWidth - 18} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={index === 3 ? '0' : '4 5'} /><text x={chartLeft - 8} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize="9">{amount >= 1000000 ? `${(amount / 1000000).toFixed(1)}jt` : `${Math.round(amount / 1000)}rb`}</text></g>;
                      })}
                      {cashFlowPoints.map((point, index) => {
                        const center = chartLeft + chartGroupWidth * (index + 0.5);
                        const incomeHeight = point.income / chartMax * chartPlotHeight;
                        const expenseHeight = point.expense / chartMax * chartPlotHeight;
                        const isActive = activeChartPoint?.date === point.date;
                        const labelEvery = Math.max(1, Math.ceil(cashFlowPoints.length / 7));
                        return <g key={point.date} onMouseEnter={() => setHoveredChartPoint(point.date)} onFocus={() => setHoveredChartPoint(point.date)}>
                          <rect x={center - chartGroupWidth * 0.44} y={chartTop} width={chartGroupWidth * 0.88} height={chartBottom - chartTop + 23} fill="transparent" tabIndex={0} role="button" aria-label={`${formatChartDate(point.date)}: pemasukan ${formatRupiah(point.income)}, pengeluaran ${formatRupiah(point.expense)}`} className="cursor-pointer outline-none" />
                          <rect x={center - chartBarWidth - 1} y={chartBottom - incomeHeight} width={chartBarWidth} height={Math.max(incomeHeight, point.income > 0 ? 2 : 0)} rx="3" fill="#10b981" opacity={isActive ? '1' : '0.78'} pointerEvents="none" />
                          <rect x={center + 1} y={chartBottom - expenseHeight} width={chartBarWidth} height={Math.max(expenseHeight, point.expense > 0 ? 2 : 0)} rx="3" fill="#f43f5e" opacity={isActive ? '1' : '0.78'} pointerEvents="none" />
                          {isActive && <line x1={center} x2={center} y1={chartTop} y2={chartBottom} stroke="#64748b" strokeDasharray="3 4" opacity="0.55" pointerEvents="none" />}
                          {(index % labelEvery === 0 || index === cashFlowPoints.length - 1) && <text x={center} y={chartHeight - 10} textAnchor="middle" fill={isActive ? '#0f172a' : '#94a3b8'} fontSize="9" fontWeight={isActive ? '700' : '400'} pointerEvents="none">{formatChartDate(point.date)}</text>}
                        </g>;
                      })}
                      {!cashFlowPoints.length && <text x={chartWidth / 2} y={chartHeight / 2} textAnchor="middle" fill="#64748b" fontSize="12">Belum ada transaksi untuk ditampilkan</text>}
                    </svg>
                  </div>
                  <div className="mt-1 flex justify-center gap-5 text-[11px] font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Pemasukan</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Pengeluaran</span></div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="category-chart-title">
                <div className="mb-1 flex items-center justify-between">
                  <h3 id="category-chart-title" className="text-sm font-bold text-slate-900">Pengeluaran per kategori</h3>
                  <span className="text-[10px] font-medium text-slate-400">{spendingCategories.length} kategori</span>
                </div>
                <p className="mb-5 text-xs text-slate-500">Klik kategori untuk melihat transaksinya</p>
                <div className="space-y-4">
                  {spendingCategories.slice(0, 5).map(([category, amount], index) => {
                    const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                    const percent = summary.expense ? Math.round(amount / summary.expense * 100) : 0;
                    return <button key={category} type="button" onClick={() => { setSelectedCategoryFilter(category); setActiveTab('transactions'); }} className="group block w-full rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-[11px]"><span className="truncate font-semibold text-slate-700 group-hover:text-blue-700">{category}</span><span className="shrink-0 font-medium tabular-nums text-slate-500">{percent}%</span></span>
                      <span className="block h-2 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full transition-all duration-500 ${colors[index % colors.length]} group-hover:brightness-90`} style={{ width: `${Math.max(percent, amount > 0 ? 1 : 0)}%` }} /></span>
                      <span className="mt-1 block text-[10px] text-slate-400">{formatRupiah(amount)}</span>
                    </button>;
                  })}
                  {!spendingCategories.length && <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">Belum ada pengeluaran pada filter ini.</p>}
                </div>
              </section>
            </div>

            {/* QUICK PREVIEW TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-900">Transaksi Terbaru</h3>
                <button onClick={() => setActiveTab('transactions')} className="text-xs font-semibold text-blue-600 hover:underline">
                  Lihat Semua ({filteredData.length}) →
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredData.slice(0, 5).map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        t.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {t.amount > 0 ? '+' : '-'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{t.desc}</div>
                        <div className="text-slate-400 text-[10px]">{t.date} • {t.cat}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        Rp {t.amount.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-400">Saldo: Rp {t.balance.toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: DAFTAR TRANSAKSI ================= */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Riwayat Transaksi e-Statement</h2>
              
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari transaksi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Kategori</option>
                  <option value="Utilitas & Tagihan">Utilitas & Tagihan</option>
                  <option value="Kuliner & Kopi">Kuliner & Kopi</option>
                  <option value="Transfer & E-Wallet">Transfer & E-Wallet</option>
                  <option value="Belanja Retail">Belanja Retail</option>
                  <option value="Biaya Admin Bank">Biaya Admin Bank</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th class="py-3 px-3">Tanggal</th>
                    <th class="py-3 px-3">Pemilik</th>
                    <th class="py-3 px-3">Keterangan / Merchant</th>
                    <th class="py-3 px-3">Kategori</th>
                    <th class="py-3 px-3 text-right">Nominal (IDR)</th>
                    <th class="py-3 px-3 text-right">Saldo (IDR)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {filteredData.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">{t.date}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          t.owner === 'SUAMI' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                        }`}>
                          {t.owner === 'SUAMI' ? '👨‍💼 Suami' : '👩‍💼 Istri'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{t.desc}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          {t.cat}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 font-mono">
                        {t.balance.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: PENGATURAN ================= */}
        {activeTab === 'settings' && (
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-lg font-bold text-slate-900">Pengaturan</h2><p className="mt-1 text-xs text-slate-500">Kelola profil, keluarga, dan preferensi dashboard.</p></div>
              <span className="text-[11px] text-slate-400">Perubahan disimpan di browser ini</span>
            </div>
            {settingsNotice && <div role="status" className={`rounded-lg border px-4 py-3 text-xs font-medium ${settingsNotice.includes('tidak') || settingsNotice.includes('cocok') || settingsNotice.includes('minimal') || settingsNotice.includes('digunakan') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{settingsNotice}</div>}

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5"><h3 className="text-sm font-bold text-slate-900">Profil akun</h3><p className="mt-1 text-xs text-slate-500">Perbarui nama dan email yang digunakan untuk masuk.</p></div>
              <form key={`${currentUser.email}-${currentUser.name}`} onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">Nama lengkap<input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" name="name" defaultValue={currentUser.name} required /></label>
                <label className="text-xs font-semibold text-slate-700">Email<input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" name="email" type="email" defaultValue={currentUser.email} required /></label>
                <div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-slate-500">Peran keluarga: <span className="font-semibold text-slate-700">{currentUser.role === 'SUAMI' ? 'Suami' : 'Istri'}</span></p><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700">Simpan profil</button></div>
              </form>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4"><h3 className="text-sm font-bold text-slate-900">Keluarga</h3><p className="mt-1 text-xs text-slate-500">Nama rumah tangga dan anggota akun yang sudah terdaftar.</p></div>
                <form key={householdName} onSubmit={handleSaveHousehold} className="flex gap-2">
                  <input name="householdName" defaultValue={householdName} aria-label="Nama keluarga" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" required />
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Simpan</button>
                </form>
                <div className="mt-4 space-y-2">
                  {(familyState?.members || []).map(user => <div key={user._id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${user.role === 'SUAMI' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{user.name}{user.email === currentUser.email ? ' (Anda)' : ''}</p><p className="truncate text-[10px] text-slate-500">{user.email}</p></div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">{user.role === 'SUAMI' ? 'Suami' : 'Istri'}</span>
                  </div>)}
                  {!familyState?.members?.length && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Belum ada anggota terdaftar.</p>}
                </div>
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Kode undangan keluarga</p><p className="mt-1 font-mono text-lg font-black tracking-[0.18em] text-slate-900">{familyState?.household?.inviteCode}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Bagikan kode ini hanya kepada anggota keluarga yang Anda percaya.</p></div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4"><h3 className="text-sm font-bold text-slate-900">Preferensi dashboard</h3><p className="mt-1 text-xs text-slate-500">Pilih rentang grafik yang digunakan saat membuka dashboard.</p></div>
                <label className="block text-xs font-semibold text-slate-700">Rentang grafik bawaan
                  <select value={chartRange} onChange={event => { const range = event.target.value; setChartRange(range); updateChartPreference({ range }).then(() => setSettingsNotice('Preferensi grafik berhasil disimpan.')).catch(error => setSettingsNotice(error.message)); }} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500"><option value="7">7 hari terakhir</option><option value="30">30 hari terakhir</option><option value="all">Semua data</option></select>
                </label>
                <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3.5">
                  <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><div><p className="text-xs font-semibold text-slate-800">Pemeriksaan transaksi duplikat aktif</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Tanggal, nominal, dan keterangan diperiksa sebelum transaksi impor ditambahkan.</p></div></div>
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4"><h3 className="text-sm font-bold text-slate-900">Keamanan akun</h3><p className="mt-1 text-xs text-slate-500">Akun dilindungi Convex Auth. Fitur pemulihan kata sandi melalui email dapat diaktifkan setelah layanan email dikonfigurasi.</p></div>
              <button type="button" onClick={handleLogout} className="rounded-lg border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">Keluar dari akun</button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

