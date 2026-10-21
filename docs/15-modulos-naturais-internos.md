# Módulos naturais internos

Os motores são código versionado dentro da aplicação, com responsabilidades por domínio. Eles não são bibliotecas npm e não são carregados de uma pasta de pacotes externos.

| Módulo | Local no projeto | Responsabilidade |
| --- | --- | --- |
| Vento | `src/modules/atmosphere/wind/` | Campo compartilhado amostrado pelos renderizadores. |
| Folhas | `src/modules/biosphere/flora/rendering/leaves/` | Geometria, aparência, ciclo visual e rasterização de folhas. |
| Árvores | `src/modules/biosphere/flora/rendering/trees/engine/` | Estruturas, copas, espécies e quadros de crescimento. |
| Vegetação | `src/modules/biosphere/flora/rendering/vegetation/` | Arbustos, herbáceas, rasteiras, cobertura e autotile. |
| Rochas | `src/modules/geosphere/rendering/rocks/` | Geração visual de formações e projeção de depósitos minerais. |

## Dependências e fronteiras

Os imports entre os motores usam caminhos relativos internos. `package.json` contém apenas dependências externas da aplicação. A simulação natural não depende de Phaser nem desses renderizadores; o jogo projeta coortes do estado natural e mantém a biologia no Worker.

Árvores/folhas, gramíneas, arbustos e amostragem do campo de vento já estão ligados ao renderer. A animação contínua de copas ainda está pendente. O estado atual está detalhado em [14 — Motores naturais internos](14-motores-naturais-e-flora.md).

## Proveniência e licença

Os fontes vieram do arquivo de motores compartilhado pelo usuário; o SHA-256 do ZIP original foi `1f3e613c4053082767ee9cc99d4e2aaee23c888160da48e89d1370a1560259f4`. A extração preservou o arquivo de licença incluído junto ao motor de vegetação. Os outros quatro motores não traziam metadados de licença próprios no arquivo fornecido, então essa informação permanece pendente para redistribuição pública.

O gerador de rochas v2.3 também conserva uma referência-fonte arquivada e tem a extração reproduzível descrita em `src/modules/geosphere/rendering/rocks/README.md`. Essa referência não é carregada pelo runtime.

## Verificação

`npm run test:engines` executa os testes dos módulos internos sem workspaces npm. `npm run check` inclui typecheck, testes do jogo, testes dos motores, fronteira headless e build.
