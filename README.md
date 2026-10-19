# Spectators-of-Life

Um jogo de observação em pixel art top-down sobre um mundo natural vivo e as sociedades que poderão surgir nele. Acompanhe água, clima, solo, plantas, animais e linhagens que aprendem durante a vida. Mais adiante, observe indivíduos humanos sobreviverem, formarem pequenas tribos e desenvolverem sociedades com profissões, instituições e políticas complexas.

O jogador observa, pausa, acelera, inspeciona e acompanha histórias. As decisões pertencem aos indivíduos dentro das possibilidades implementadas.

## Prioridade de desenvolvimento

Mundo físico → ecologia vegetal → animais e biologia → aprendizado e evolução → indivíduos humanos → pequenas tribos → aldeias e especialização → Estados → impérios.

Essa é a ordem de implementação. Dentro do mundo, sociedades podem coexistir em formas diferentes, permanecer pequenas, migrar, se fragmentar ou desaparecer. Impérios são uma possibilidade futura, não um destino obrigatório.

## Estado do projeto

F0 validado localmente em 19/10/2026: runtime headless, Worker, protocolo v1, seed/tick, save/load, projeção Phaser do mundo vazio e CI configurada. O marco não inclui terreno, clima, ecologia, fauna ou sociedade. Humanos dependem da aprovação dos critérios ecológicos de F1–F4.

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

`npm run check` executa typecheck, testes determinísticos, validação da fronteira headless e build de produção. `npm run benchmark:f0` repete as medições do núcleo. A especificação está em [SPEC-000](docs/specs/000-fundacao-runtime.md); evidências e limites estão no [relatório F0](docs/12-validacao-documental.md) e no [baseline de desempenho](docs/evidence/f0-performance-baseline-2026-10-19.json).
