# ADR-0016 — ASTERRA: biblioteca visual sem ecologia duplicada

Estado: implementação incremental em branch de integração.

## Decisão
A simulação de coortes em src/core/natural/vegetation-system.ts
permanece a única fonte de verdade, executada no Web Worker.
A biblioteca pura src/lib/asterra/vegetation/grass-autotile.ts
converte a biomassa já simulada em máscara visual de oito vizinhos.
O adaptador Phaser src/render/asterra-grass-overlay.ts só renderiza
essa máscara em uma CanvasTexture reutilizada.

As bibliotecas reutilizáveis completas são Wind, Leaves, Vegetation,
Trees e Rocks. Leaves continua separada: Trees e Vegetation
consomem Leaves, jamais o contrário.

## Garantias
- Nenhuma mudança no schema de save ou no núcleo da ecologia.
- Mesma seed e snapshot geram a mesma cobertura.
- Solo sem biomassa de gramínea permanece descoberto.
- Não aparece gramado em água acumulada nem rocha exposta.
- A textura só é reconstruída quando o snapshot de entrada muda.
- A visibilidade e o cache da câmera não influenciam o Worker.

## Próximos gates
Migrar pacotes ASTERRA v0.2.0 completos via workspace versionado em PRs
separados; medir P50/P95 visual, LOD e streaming; validar efeitos
de luz, vento e sombra; preservar a suite de saves antigos.
