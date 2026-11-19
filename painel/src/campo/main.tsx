import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Campo } from './Campo'

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <Campo />
  </StrictMode>,
)
