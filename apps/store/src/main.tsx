import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@nexus/ui/tokens.css'
import '@nexus/ui/base.css'
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('No se encontró el elemento #root')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
