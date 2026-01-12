import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mysten/dapp-kit/dist/index.css'
import './index.css'
import App from './App.tsx'
import { Providers } from './providers'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
)