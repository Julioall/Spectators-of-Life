# AI Game Design Document

## Proposta e loop

Jogo observacional 2D em pixel art. Gerar ou carregar mundo; observar ciclos; pausar ou acelerar; inspecionar organismos e regiões; acompanhar linhagens e eventos; comparar cenários e salvar o estado.

Sessões podem ser curtas para inspeção ou longas para acompanhamento. Salvar e retomar evita exigir observação contínua. Checkpoints e eventos entram cedo; navegação completa de replay é uma entrega posterior.

## Mundo natural — primeiro produto

Relevo condiciona escoamento e habitat. Clima e estações alteram temperatura e disponibilidade de água. Solo retém umidade e nutrientes. Plantas germinam, competem, crescem, dispersam sementes e morrem. Animais percebem alimento, água, abrigo, outros animais e risco; consomem, descansam, se reproduzem, envelhecem e morrem.

Detritos e decompositores reciclam nutrientes. Doença simplificada, predação, competição, migração e perturbações modificam populações. A especificação detalhada está em [10-ecologia-e-biologia.md](10-ecologia-e-biologia.md).

O ecossistema não possui topo alimentar obrigatório nem população artificialmente mantida pelo renderer. Sucesso da validação significa comportamento coerente; não exige equilíbrio constante ou sobrevivência universal.

## Primeiro recorte jogável

F1–F2: mapa pequeno por seed, dois habitats contrastantes, água, solo, clima, duas formas vegetais e decomposição agregada. Câmera, pausa, velocidade, inspeção de célula/planta, eventos e save. Sem animais obrigatórios nesse primeiro recorte.

F3–F4 ampliam para fauna com pelo menos três perfis ecológicos, reprodução, mortalidade, aprendizado online e evolução. Faixa inicial de 50–200 animais é um alvo de teste ajustável; não promessa de capacidade validada.

## Humanos — planejamento posterior ao gate natural

F5: sobrevivência, percepção, descanso, coleta, abrigo simples e cuidado de descendentes.
F6: pequenos grupos e tribos, compartilhamento, comunicação, confiança, memória social e transmissão de práticas.
F7: cultivo, armazenamento, construções persistentes, trocas e especialização inicial.
F8: profissões estáveis, cidades, instituições, leis, diplomacia e logística militar.
F9: expansão imperial, administração regional, tributos, disputas de legitimidade, revoltas e fragmentação.

Cada possibilidade exige recursos, conhecimento, custos e regras implementadas. Aprendizado escolhe entre possibilidades; não cria automaticamente novas mecânicas ou código. Agricultura, cidades e impérios não são marcos biológicos obrigatórios.

## Interface e estética

Mapa pixel art desenhado em código como base de produção, com escala e âncoras consistentes. Painéis contextuais integrados à tela, ícones e menus flutuantes. A interface inicial prioriza clima, água, solo, plantas, fauna e linhagens; módulos sociais só exibem dados quando habilitados.
