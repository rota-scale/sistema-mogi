import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { carregarMapLibre } from './carga'
import './relatar.css'
import Relatar from './Relatar.tsx'

// O mapa é a tela inicial: o MapLibre começa a descer antes do primeiro desenho.
void carregarMapLibre().catch(() => {})

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <Relatar />
  </StrictMode>,
)
