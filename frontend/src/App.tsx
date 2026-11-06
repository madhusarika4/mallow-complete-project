import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { AppProvider } from './lib/app'
import { ToastProvider } from './ui'
import Home from './pages/Home'
import ChildRouter from './pages/ChildRouter'
import ParentShell from './pages/ParentShell'

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/child/:id/*" element={<ChildRouter />} />
            <Route path="/parent/*" element={<ParentShell />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  )
}
