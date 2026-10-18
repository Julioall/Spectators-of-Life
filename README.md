# Spectators-of-Life

Um jogo de observação em pixel art top-down sobre um mundo natural vivo e as sociedades que poderão surgir nele. Acompanhe água, clima, solo, plantas, animais e linhagens que aprendem durante a vida. Mais adiante, observe indivíduos humanos sobreviverem, formarem pequenas tribos e desenvolverem sociedades com profissões, instituições e políticas complexas.

O jogador observa, pausa, acelera, inspeciona e acompanha histórias. As decisões pertencem aos indivíduos dentro das possibilidades implementadas.

## Prioridade de desenvolvimento

Mundo físico → ecologia vegetal → animais e biologia → aprendizado e evolução → indivíduos humanos → pequenas tribos → aldeias e especialização → Estados → impérios.

Essa é a ordem de implementação. Dentro do mundo, sociedades podem coexistir em formas diferentes, permanecer pequenas, migrar, se fragmentar ou desaparecer. Impérios são uma possibilidade futura, não um destino obrigatório.

## Estado do projeto

Fundação documental; os sistemas descritos são especificações e objetivos, ainda não funcionalidades implementadas. O marco atual é F0. Humanos dependem da aprovação dos critérios ecológicos de F1–F4.

- [Índice da documentação](docs/README.md)
- [Roadmap e critérios de avanço](docs/09-roadmap.md)
- [Ecologia e biologia](docs/10-ecologia-e-biologia.md)
- [Contrato para IAs](AGENTS.md)

Stack definida: Phaser + TypeScript + Vite, simulação em Web Worker e interface DOM/CSS. Redes neurais aprendem no próprio jogo.
