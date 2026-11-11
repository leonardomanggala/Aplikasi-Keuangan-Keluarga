import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const root = ReactDOM.createRoot(document.getElementById('root'))

if (convexUrl) {
  const convex = new ConvexReactClient(convexUrl)
  root.render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </React.StrictMode>,
  )
} else {
  root.render(
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-black text-white">DK</div>
        <h1 className="text-xl font-bold">Sambungkan ke Convex</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Backend Convex belum tersambung. Setelah proyek Convex dibuat, jalankan <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run convex:dev</code> untuk mengisi URL deployment lokal.</p>
        <p className="mt-4 text-xs text-slate-500">URL Convex disimpan sebagai <code>VITE_CONVEX_URL</code> di berkas lingkungan lokal. Jangan menaruh kunci rahasia pada variabel yang diawali VITE_.</p>
      </div>
    </div>,
  )
}

