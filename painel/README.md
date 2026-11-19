# Painel do Sistema MOGI

Painel da prefeitura em React + Vite + MapLibre GL (ADR 0004 e 0013): mapa 3D de Itamogi com prédios extrudados do OpenStreetMap pelo OpenFreeMap, pins ao vivo pelo WebSocket do backend, mapa de calor, filtros por nível, contador por bairro, fila de revisão humana e detalhe do chamado.

```bash
npm install
npm run dev     # http://localhost:5173, proxy /api para http://localhost:8080
npm test        # vitest
npm run lint    # oxlint
npm run build   # tsc e build estático em dist/
```

Outro backend: `MOGI_API=http://ip:8080 npm run dev`. Passo a passo completo no README da raiz.
