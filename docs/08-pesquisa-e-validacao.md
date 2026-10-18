# Pesquisa e validação

## Hipóteses

- Redes pequenas aprendem online de forma legível.
- Aprendizagem em vida pode alterar a seleção de traços herdáveis mesmo sem transferência de pesos; a cópia direta de pesos parentais é uma hipótese separada de transferência de controlador, não herança genética.
- Plasticidade responde a clima variável, mas pode reduzir especialização.
- Relações sociais e ecologia geram feedbacks que produzem histórias não roteirizadas.
- UI contextual torna causas compreensíveis sem virar um painel administrativo.

## Protocolo

Cada experimento declara pergunta, seed, versão, cenário, algoritmo, hiperparâmetros, política de herança, população, duração, métricas e critério de encerramento. Comparar baseline heurístico e políticas alternativas em mais de uma execução, com cenários e populações iniciais pareados sempre que possível. O número de replicações deve acompanhar a variabilidade observada; não inferir generalidade de uma execução ou de uma única média.

Medir sobrevivência, reprodução, diversidade, consumo, migração, extinção, cooperação, conflito, entropia de ação, custo por tick e legibilidade.

A bibliografia deve cobrir aprendizado online, aprendizado incremental, evolução digital, plasticidade fenotípica, herança de controladores e evolução de redes sociais. Artigos formulam hipóteses; não substituem testes no domínio.

Decisão vigente: Phaser + TypeScript e redes pequenas no runtime por portabilidade, inspeção, determinismo e evolução observável. Modelos externos são pesquisa futura, não requisito.

## Ordem dos experimentos

Primeiro validar água/solo, produção vegetal, consumo, decomposição e ciclos de vida. Depois medir o efeito do aprendizado animal sobre sobrevivência e reprodução. Separar alterações do ambiente, do genoma, dos pesos e da política de herança.

O experimento de F4 compara: controlador heurístico; rede sem atualização; rede aprendendo em vida sem transferência de pesos; rede aprendendo com transferência experimental de pesos. Parear cenário, população inicial e seed; manter explícitas as diferenças de RNG e reportar distribuições, não apenas a melhor execução. Incluir recursos estáveis e cíclicos, variando a duração do ciclo em relação ao tempo medido de adaptação da rede. Avaliar também em modo congelado para separar aprendizagem online de desempenho final.

Pesquisa social detalhada começa após o gate natural e deve distinguir práticas aprendidas, habilidades e instituições de características genéticas. Não assumir evolução inevitável de tribos para impérios.

## Referências consultadas

- Martin, B. T., Zimmer, E. I., Grimm, V. & Jager, T. (2012). [Dynamic Energy Budget theory meets individual-based modelling: a generic and accessible implementation](https://doi.org/10.1111/j.2041-210X.2011.00168.x). O modelo DEB-IBM representa assimilação, manutenção, crescimento e reprodução em interação com a disponibilidade de alimento. Aplicação ao projeto: separar esses fluxos no contrato de cada animal. Limite: usar como referência conceitual não obriga o jogo a implementar DEB completo.
- Malishev, M., Bull, C. M. & Kearney, M. R. (2018). [An individual-based model of ectotherm movement integrating metabolic and microclimatic constraints](https://doi.org/10.1111/2041-210X.12909). O estudo acopla orçamento de massa/energia, microclima e decisão de movimento e compara previsões com dados de movimento de lagartos. Aplicação: movimento, alimentação e termorregulação podem depender conjuntamente do estado corporal e do micro-habitat. Limite: é um estudo de uma espécie ectotérmica e não fornece parâmetros universais para nossa fauna.
- Aguilar, L., Bennati, S. & Helbing, D. (2019). [How learning can change the course of evolution](https://doi.org/10.1371/journal.pone.0219502). Um modelo computacional de forrageamento com recursos sazonais mostra que a relação entre ritmo de aprendizagem e frequência ambiental pode alterar tanto a trajetória quanto o resultado evolutivo. Aplicação: testar explicitamente a escala dos ciclos ambientais em relação à adaptação da rede. Limite: é um modelo abstrato, não uma demonstração empírica de evolução em animais reais.

Esses trabalhos fundamentam decisões de modelagem e hipóteses, mas não validam os parâmetros nem o comportamento do nosso jogo. Resultados do projeto continuam dependentes de testes próprios.
