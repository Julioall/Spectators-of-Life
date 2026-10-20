# Spectators-of-Life

Um jogo de observação em pixel art top-down sobre um mundo natural vivo e as sociedades que poderão surgir nele. Acompanhe água, clima, solo, plantas, animais e linhagens que aprendem durante a vida. Mais adiante, observe indivíduos humanos sobreviverem, formarem pequenas tribos e desenvolverem sociedades com profissões, instituições e políticas complexas.

O jogador observa, pausa, acelera, inspeciona e acompanha histórias. As decisões pertencem aos indivíduos dentro das possibilidades implementadas.

## Prioridade de desenvolvimento

Mundo físico → ecologia vegetal → animais e biologia → aprendizado e evolução → indivíduos humanos → pequenas tribos → aldeias e especialização → Estados → impérios.

Essa é a ordem de implementação. Dentro do mundo, sociedades podem coexistir em formas diferentes, permanecer pequenas, migrar, se fragmentar ou desaparecer. Impérios são uma possibilidade futura, não um destino obrigatório.

## Estado do projeto

F0 foi validado localmente em 19/10/2026. F1–F2 têm agora uma implementação inicial em revisão: vale procedural determinístico, clima sazonal, água e solo, minerais e vegetação agregada com renderização/inspeção no jogo. O protótipo ainda não representa calibração ecológica, fauna ou sociedade; os gates naturais continuam abertos antes de F5.

- [Índice da documentação](docs/README.md)
- [Roadmap e critérios de avanço](docs/09-roadmap.md)
- [Ecologia e biologia](docs/10-ecologia-e-biologia.md)
- [Contrato para IAs](AGENTS.md)

Stack definida: Phaser + TypeScript + Vite, simulação em Web Worker e interface DOM/CSS. Redes neurais aprendem no próprio jogo.

## Executar

Use Node.js 24 ou posterior e npm 11 ou posterior. As dependências têm versões exatas e `package-lock.json` deve ser respeitado.

```sh
npm ci
npm run dev
```

`npm run check` executa typecheck, testes determinísticos, validação da fronteira headless e build de produção. `npm run benchmark:natural` avança 30 dias do cenário natural com seed fixa e mede separadamente o tempo do Worker, a preparação do snapshot e sua cópia na fronteira de `postMessage`; também gera um manifesto conforme a [SPEC-001](docs/specs/001-relogio-e-metricas.md). O render Phaser é medido no painel de desempenho do navegador, com P50/P95 móveis. `npm run benchmark:f0` continua como alias de compatibilidade. Os [baselines F0](docs/evidence/f0-performance-baseline-2026-10-19.json) e [SPEC-001](docs/evidence/spec-001-performance-baseline-2026-10-19.json) são históricos e usam o mundo vazio/fixtures sintéticas.
