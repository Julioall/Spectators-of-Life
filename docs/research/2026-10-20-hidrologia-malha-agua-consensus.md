# Faça uma revisão científica aplicada ao desenvolvimento de uma simulação determi

**Question:** Faça uma revisão científica aplicada ao desenvolvimento de uma simulação determinística de mundo natural em grade 2D, renderizada em Phaser/TypeScript, com o estado autoritativo em Web Worker e renderer como projeção. O objetivo é melhorar a malha e o escoamento de água (rios, córregos, lagos, secas, confluências, erosão e bordas) e a representação visual no mapa (leito, margens, largura, água ativa versus seca, animação sutil e leitura de fluxo). Revise literatura peer-reviewed, preferencialmente de 2000 a 2026, cobrindo: comparação D8, D-infinity e Multiple Flow Direction; preenchimento/breaching de depressões e tratamento de planícies; acumulação de fluxo e limiares de início de canal; largura de canais, confluências, meandros e erosão/sedimento; secagem de rios e lagos; e técnicas de visualização de redes fluviais e superfícies de água em mapas discretos/jogos. Retorne uma síntese com evidência, limitações e trade-offs, lista de artigos com autores/ano/DOI ou URL, e um checklist prático para implementação sem modelos pré-treinados, preservando determinismo, testabilidade headless e compatibilidade com uma simulação por mensagens tipadas. Não invente referências.

# Revisão **aplicada** para **hidrologia 2D** determinística

A literatura se divide aqui em três frentes: **roteamento de fluxo**, **morfologia e secagem**, e **representação visual** orientada por um estado autoritativo discreto. Para uma simulação 2D em grade com determinismo forte, a evidência favorece um núcleo simples e estável no worker, com complexidade geomorfológica adicionada como estados e campos derivados, não como solver contínuo completo [[1.1]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/) [[2.1]](https://consensus.app/papers/influence-of-dem-resolution-on-drainage-network-ariza-villaverde-jiménez-hornero/6a31896f7d705cb2821cb021d988bdea/) [[3.1]](https://consensus.app/papers/novel-mathematical-model-for-longterm-hydrodynamic-alsultani-hasan/4af10a9c61015c3a822838c5ed1ec13b/).

## Roteamento E Condicionamento

D8 continua atraente quando o requisito principal é **consistência topológica, simplicidade e custo previsível**, porque preserva sub-bacias e convergência de forma estável, embora introduza viés direcional alinhado à grade [[1.1]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/) [[1.2]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/) [[4.1]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/). D∞ e variantes MFD reduzem parte desse viés e tendem a representar melhor terreno complexo, mas os trabalhos comparativos mostram um trade-off recorrente: algoritmos de fluxo múltiplo melhoram área contribuinte em muitos cenários, enquanto dispersam demais a posição do caminho d’água; já os de fluxo único produzem linhas mais nítidas, porém menos realistas fora de eixos da malha [[5.1]](https://consensus.app/papers/similarity-analysis-of-flow-route-algorithms-for-xue-jun/27dac7ea25e4533eb35341da146d3de2/) [[6.1]](https://consensus.app/papers/evaluating-the-area-and-position-accuracy-of-surface-water-li-yang/7ce4df64c90f5bbea6e72163aaa5953c/) [[6.2]](https://consensus.app/papers/evaluating-the-area-and-position-accuracy-of-surface-water-li-yang/7ce4df64c90f5bbea6e72163aaa5953c/) [[6.3]](https://consensus.app/papers/evaluating-the-area-and-position-accuracy-of-surface-water-li-yang/7ce4df64c90f5bbea6e72163aaa5953c/) [[7.1]](https://consensus.app/papers/a-complex-synthetic-surface-for-assessing-flow-direction-song-yang/65cd902c4f2a5b5385400e7448e6ce5b/).

- Use **D8/iGD8** no estado autoritativo se a prioridade for determinismo, depuração e canais legíveis [[4.2]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/) [[4.3]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/) [[4.4]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/).
- Use **MFD ou D∞** apenas em campos derivados, como umidade potencial ou expansão lateral sazonal [[6.4]](https://consensus.app/papers/evaluating-the-area-and-position-accuracy-of-surface-water-li-yang/7ce4df64c90f5bbea6e72163aaa5953c/) [[5.1]](https://consensus.app/papers/similarity-analysis-of-flow-route-algorithms-for-xue-jun/27dac7ea25e4533eb35341da146d3de2/) [[1.3]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/).
- Em planícies e flats, agregação por células irregulares ou regras explícitas de empate evitam ambiguidades de roteamento célula a célula [[8.1]](https://consensus.app/papers/selective-depression-filling-for-terrainderived-liu-naar/b32f49bba817522bb9ce0123371dcb8a/) [[8.2]](https://consensus.app/papers/selective-depression-filling-for-terrainderived-liu-naar/b32f49bba817522bb9ce0123371dcb8a/).

Depressões e lagos não devem ser simplesmente apagados por fill global quando o objetivo inclui **rios intermitentes, poças, secas e conectividade sazonal**. A revisão e os estudos comparativos mostram que não existe algoritmo universal, e que fill, breach e híbridos mudam fortemente áreas contribuintes e caminhos de drenagem; em relevo baixo, o breaching prévio reduz a quantidade de células artificialmente elevadas [[9.1]](https://consensus.app/papers/review-on-algorithms-of-dealing-with-depressions-in-grid-wang-qin/73f5a285489e535483d131abac5d619a/) [[10.1]](https://consensus.app/papers/evaluating-dem-conditioning-techniques-elevation-source-woodrow-lindsay/0de193b39c135d9abe3eef7666cc806b/) [[10.2]](https://consensus.app/papers/evaluating-dem-conditioning-techniques-elevation-source-woodrow-lindsay/0de193b39c135d9abe3eef7666cc806b/) [[11.1]](https://consensus.app/papers/an-outlet-breaching-algorithm-for-the-treatment-of-closed-martz-garbrecht/7825ffc4184755babf71589998284772/) [[11.2]](https://consensus.app/papers/an-outlet-breaching-algorithm-for-the-treatment-of-closed-martz-garbrecht/7825ffc4184755babf71589998284772/).

**Figure 1.** The schematic diagram of the depression-processing algorithms with the DEM-revising strategy. a) Smoothing filter. b) Depression Filling. c) Depression Breaching (or Carving). d) Drainage enforcement. [[9]](https://consensus.app/papers/review-on-algorithms-of-dealing-with-depressions-in-grid-wang-qin/73f5a285489e535483d131abac5d619a/)

*How to read: O esquema separa estratégias de tratamento de depressões por tipo de modificação no DEM. Leia da esquerda para a direita: suavização, preenchimento, breaching e enforcement de drenagem.*

- Para **bloqueios espúrios estreitos**, breach limitado por comprimento é mais realista que fill puro [[11.3]](https://consensus.app/papers/an-outlet-breaching-algorithm-for-the-treatment-of-closed-martz-garbrecht/7825ffc4184755babf71589998284772/) [[11.4]](https://consensus.app/papers/an-outlet-breaching-algorithm-for-the-treatment-of-closed-martz-garbrecht/7825ffc4184755babf71589998284772/).
- Para **lagos e flats fisicamente desejados**, preserve depressões selecionadas em vez de remover tudo [[12.1]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/) [[12.2]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/) [[12.3]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/).
- Modele conectividade como **estados fill-spill-connect**, não como binário seco/molhado [[8.3]](https://consensus.app/papers/selective-depression-filling-for-terrainderived-liu-naar/b32f49bba817522bb9ce0123371dcb8a/) [[8.4]](https://consensus.app/papers/selective-depression-filling-for-terrainderived-liu-naar/b32f49bba817522bb9ce0123371dcb8a/) [[8.5]](https://consensus.app/papers/selective-depression-filling-for-terrainderived-liu-naar/b32f49bba817522bb9ce0123371dcb8a/).

## Início De Canais E Rede

O limiar de acumulação de fluxo é um dos parâmetros que mais alteram a geometria extraída da rede, e a evidência mostra que **não deve ser constante por padrão**. Estudos recentes associam FAT a armazenamento hídrico, NDVI, relevo e outras variáveis ambientais, enquanto trabalhos em múltiplas resoluções mostram que o limiar adequado muda com a resolução do DEM e com a densidade da drenagem [[13.1]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[13.2]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[1.4]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/) [[2.2]](https://consensus.app/papers/influence-of-dem-resolution-on-drainage-network-ariza-villaverde-jiménez-hornero/6a31896f7d705cb2821cb021d988bdea/).

| Abordagem | Vantagem | Limitação | Uso na simulação |
|---|---|---|---|
| FAT fixo | Reprodutível e barato | Super ou subextrai canais | Protótipos pequenos [[13.3]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) |
| FAT adaptativo | Rede mais plausível | Exige calibração regional | Geração offline de mapas [[13.4]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[13.5]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) |
| FAT por resolução/bioma | Mantém estilo consistente | Heurística, não física completa | Jogos determinísticos escaláveis [[2.2]](https://consensus.app/papers/influence-of-dem-resolution-on-drainage-network-ariza-villaverde-jiménez-hornero/6a31896f7d705cb2821cb021d988bdea/) [[14.1]](https://consensus.app/papers/an-approach-for-determination-of-the-drainage-network-akay-koçyiğit/d774b8d5d8a55c979b02b624ccaa55e7/) |

**Figure 1:** Comparação de estratégias de limiar de início de canal para uma malha discreta autoritativa.

Para implementação, a melhor síntese é separar **extração estrutural** de **dinâmica hídrica**. Gere uma rede-base com FAT adaptado por relevo/bioma/resolução; depois permita ativação sazonal por armazenamento local, déficit hídrico e conectividade a montante, em vez de recriar a topologia a cada tick [[13.6]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[13.7]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[14.1]](https://consensus.app/papers/an-approach-for-determination-of-the-drainage-network-akay-koçyiğit/d774b8d5d8a55c979b02b624ccaa55e7/) [[12.4]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/).

- Extraia o **thalweg estrutural** offline e serialize arestas/células-canônicas [[13.8]](https://consensus.app/papers/adaptive-determination-of-the-flow-accumulation-zhang-li/9fa25acf6dc25582872d6dec0477ca5a/) [[1.5]](https://consensus.app/papers/setting-the-flow-accumulation-threshold-based-on-zhang-loáiciga/b114c178b2ef5b4884220c28075cae49/).
- Atualize em runtime só **estado hídrico**: vazão, largura, ativo/seco, lago conectado/isolado [[12.5]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/) [[12.6]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/).
- Valide sempre contra mudanças de **resolução da grade**, porque elas alteram área contribuinte e morfologia da rede [[10.3]](https://consensus.app/papers/evaluating-dem-conditioning-techniques-elevation-source-woodrow-lindsay/0de193b39c135d9abe3eef7666cc806b/) [[10.4]](https://consensus.app/papers/evaluating-dem-conditioning-techniques-elevation-source-woodrow-lindsay/0de193b39c135d9abe3eef7666cc806b/) [[2.2]](https://consensus.app/papers/influence-of-dem-resolution-on-drainage-network-ariza-villaverde-jiménez-hornero/6a31896f7d705cb2821cb021d988bdea/).

## Morfologia, Secagem E Visualização

A literatura morfodinâmica indica que largura de canal, confluência, sedimento e erosão mudam a resposta do rio de modo que modelos 1D simples não capturam bem. Incorporar ajuste de largura e algum balanço sedimento/erosão reduz sensibilidade excessiva e produz transientes mais plausíveis; em confluências, ângulo e razão de descargas controlam scour central, barras de separação e segregação de sedimentos [[15.1]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/) [[15.2]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/) [[15.3]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/) [[16.1]](https://consensus.app/papers/sediment-transport-and-bed-morphology-at-river-channel-best/8ee4ea9c224a5b8ea83bdfca8e9a4f29/) [[16.2]](https://consensus.app/papers/sediment-transport-and-bed-morphology-at-river-channel-best/8ee4ea9c224a5b8ea83bdfca8e9a4f29/) [[16.3]](https://consensus.app/papers/sediment-transport-and-bed-morphology-at-river-channel-best/8ee4ea9c224a5b8ea83bdfca8e9a4f29/).

**Figure 2.** Schematic model setup. (a) Typical 1-D stream power river pro fi le model for which channel width ( W ) varies with drainage area only. (b) Schematic of model represented by the methods proposed here. Both channel width and sediment cover evolve in response to transient perturbations such as increases in the rate of rock-uplift ( U ). (c) The change in elevation ( z ) with time depends on local rock-uplift and either the (left) conservation of sediment thickness, h , or the (right) erosion of bedrock, E . In both cases, sediment fl uxes ( Qs and Qt ) are calculated to predict if the model cell is completely covered by sediment or if bedrock is exposed, except for the detachment-li [[15]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/)

*How to read: O esquema compara um modelo 1D típico com um modelo que deixa largura e cobertura sedimentar evoluírem. Leia os painéis da esquerda para a direita e depois a dependência temporal indicada abaixo.*

- Faça a **largura visual** crescer com área contribuinte e estado de vazão, não só com classe fixa de rio [[15.4]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/) [[15.3]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/).
- Em confluências, desenhe **poço central, barra interna e zona de separação** como motivos estáveis de tile/sprite [[16.1]](https://consensus.app/papers/sediment-transport-and-bed-morphology-at-river-channel-best/8ee4ea9c224a5b8ea83bdfca8e9a4f29/) [[16.4]](https://consensus.app/papers/sediment-transport-and-bed-morphology-at-river-channel-best/8ee4ea9c224a5b8ea83bdfca8e9a4f29/) [[17.1]](https://consensus.app/papers/numerical-investigation-on-the-hydraulic-yuan-tian/243233532cc3559e9b59211e05bdd628/).
- Para meandros e margens, use erosão na margem externa e deposição na interna como regra lenta e determinística por estação [[18.1]](https://consensus.app/papers/integrated-modelling-of-river-morphology-and-sediment-bekmuratova/d9ac8d76f62754048f5d9605a9e74d24/) [[3.2]](https://consensus.app/papers/novel-mathematical-model-for-longterm-hydrodynamic-alsultani-hasan/4af10a9c61015c3a822838c5ed1ec13b/) [[3.3]](https://consensus.app/papers/novel-mathematical-model-for-longterm-hydrodynamic-alsultani-hasan/4af10a9c61015c3a822838c5ed1ec13b/).

Para **secagem de rios e lagos**, a evidência mais direta neste conjunto vem dos trabalhos de depressões preservadas: incluir armazenamento superficial preserva ponding, aumenta armazenamento, atrasa pico de vazão e diferencia melhor corpos d’água conectados de isolados [[12.5]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/) [[12.4]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/) [[12.6]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/). Em um jogo em grade, isso sugere representar cada célula de água com pelo menos quatro estados: leito seco, umidade residual, água corrente rasa e água represada, com renderer tratando animação apenas como projeção do vetor de fluxo e da energia local.

### Checklist Prático

- Fixe um **passo determinístico** no worker e use inteiros ou ponto fixo para vazão, armazenamento e sedimento.
- Pré-processe DEM/malha com **breach limitado + preservação seletiva** de depressões importantes [[19.1]](https://consensus.app/papers/efficient-hybrid-breaching‐filling-sink-removal-methods-lindsay/2689e581d88c50fc8df6200e4c09fa26/) [[12.1]](https://consensus.app/papers/topographic-hydroconditioning-to-resolve-surface-jiang-hsu/3c411c447de45d18bd72f759663929e8/).
- Use **D8 ou iGD8** para direção autoritativa; derive campos laterais com MFD/D∞ offline [[4.1]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/) [[4.3]](https://consensus.app/papers/an-improved-method-for-single-flow-direction-calculation-shin-paik/b29e78b9f2065cf780b3a93aa3deb4b1/) [[5.1]](https://consensus.app/papers/similarity-analysis-of-flow-route-algorithms-for-xue-jun/27dac7ea25e4533eb35341da146d3de2/).
- Separe dados tipados em mensagens: `TerrainStatic`, `DrainageGraph`, `WaterState`, `MorphologyState`, `RenderHints`.
- Modele cada tick em fases puras: entrada hídrica, routing, spill/connect, armazenamento, erosão/deposição lenta, emissão de diffs.
- Trate **largura, margens e animação** como derivados de estado, não como verdade física independente [[15.4]](https://consensus.app/papers/the-dynamics-of-channel-slope-width-and-sediment-in-yanites/b34a5ec415eb5962b7b2d38ec0ececb1/) [[3.4]](https://consensus.app/papers/novel-mathematical-model-for-longterm-hydrodynamic-alsultani-hasan/4af10a9c61015c3a822838c5ed1ec13b/).
- Teste headless com snapshots de bacia, confluência, lago terminal, floodplain e seca sazonal.
- Faça calibração por estilo, porque a literatura é clara que algoritmo, resolução e condicionamento mudam muito o resultado [[10.5]](https://consensus.app/papers/evaluating-dem-conditioning-techniques-elevation-source-woodrow-lindsay/0de193b39c135d9abe3eef7666cc806b/) [[9.1]](https://consensus.app/papers/review-on-algorithms-of-dealing-with-depressions-in-grid-wang-qin/73f5a285489e535483d131abac5d619a/) [[7.2]](https://consensus.app/papers/a-complex-synthetic-surface-for-assessing-flow-direction-song-yang/65cd902c4f2a5b5385400e7448e6ce5b/).

## Artigos-Chave

| Artigo | Relevância prática | DOI / URL |
|---|---|---|
| Tarboton 1997 | Base de D∞; citado na revisão de depressões | https://doi.org/10.1029/96WR03137 |
| Lindsay 2016 | Híbridos breach-fill eficientes | Paper listado; DOI não fornecido no trecho |
| Woodrow, Lindsay, Berg 2016 | Efeito de conditioning e resolução | Paper listado; DOI não fornecido no trecho |
| Jiang et al. 2023 | Preservação de depressões e ponding | Paper listado; DOI não fornecido no trecho |
| Li et al. 2020 | Erros de área e posição em algoritmos de fluxo | Paper listado; DOI não fornecido no trecho |
| Song et al. 2024 | Superfície sintética complexa para comparar TCA | Paper listado; DOI não fornecido no trecho |
| Zhang et al. 2021 | FAT adaptativo por regressão/potência | https://doi.org/10.3390/rs13112024 |
| Zhang et al. 2021 | FAT com fatores ambientais e morfológicos | https://doi.org/10.3390/ijgi10030186 |
| Best 1988 | Morfologia de confluências | Paper listado; DOI não fornecido no trecho |
| Yanites 2018 | Largura de canal e sedimento em erosão | https://doi.org/10.1029/2001JB000162 |

**Figure 2:** Artigos mais acionáveis para um pipeline determinístico de geração e simulação hidrológica em grade.

Para a sua simulação, a combinação mais defensável é **roteamento autoritativo simples**, **depressões seletivamente preservadas**, **rede estrutural offline com ativação sazonal**, e **visualização derivada de largura, energia e conectividade**. Isso preserva determinismo, testabilidade headless e mensagens tipadas, sem perder os fenômenos visuais e hidrológicos que a literatura mostra serem mais sensíveis: flats, confluências, limiar de canal, armazenamento em depressões e largura variável.
 
_These search results were found and analyzed using Consensus, an AI-powered search engine for research. Try it at https://consensus.app. © 2026 Consensus NLP, Inc. Personal, non-commercial use only; redistribution requires copyright holders’ consent._
 
## References
 
`1.` Zhang H, Loáiciga H, Feng L, He J, Du Q. Setting the Flow Accumulation Threshold Based on Environmental and Morphologic Features to Extract River Networks from Digital Elevation Models. *ISPRS Int. J. Geo Inf..* 2021;10:186. doi:10.3390/ijgi10030186
 
> [1.1] The D8 algorithm is relatively simple and convenient and has found wide applicability in hydrologic analysis. (Discussion)
 
> [1.2] Its popularity stems from its simplicity and reasonable representation for convergent flow conditions, and it preserves the consistency between the flow patterns, calculated contributing area, and spatial delineation of subcatchments [44,78]. (Discussion)
 
> [1.3] Other algorithms (e.g., D ¥ and MD ¥ ) may improve the calculation of flow directions on a topographic surface, and their evaluation is the topic of future research. (Discussion)
 
> [1.4] Our results reveal key local features useful for river network extraction within the context of complex geomorphologic characteristics at relatively small spatial scales and establish the importance of properly choosing explanatory geomorphologic characteristics in river network extraction. (Abstract)
 
> [1.5] GeoNet [10] is a well-developed and representative open-source software for extracting channel networks based on geodesic minimization principles. (Introduction)
 
`2.` Ariza-Villaverde AB, Jiménez-Hornero FJ, De Ravé EG. Influence of DEM resolution on drainage network extraction: A multifractal analysis. *Geomorphology.* 2015;241:243-254. doi:10.1016/j.geomorph.2015.03.040
 
> [2.1] This algorithm has certain advantages such as simplicity, the provision of a reasonable representa- tion for convergent flow conditions and consistency among flow patterns, calculated contributing areas and the spatial representation of subcatchments. (Abstract)
 
> [2.2] Therefore, this study tested three DEM resolutions for four drainage basins with different levels of drainage network distribution by comparing the Renyi spectra of the drainage networks that were ob- tained with the D8algorithmagainstthose determined byphotogrammetric restitution.According totheresults, DEM resolution influences the selected flow accumulation threshold value and the simulated network morphol- ogy.Thesuitable flowaccumulationthresholdvalue increasesastheDEMresolutionincreasesandshowsgreater variability for basins with lower drainage densities. (Abstract)
 
`3.` Alsultani R, Hasan RF. Novel mathematical model for long-term hydrodynamic evolution of sediment transport and its impact on meandering geometry. *Journal of Water and Land Development.* 2025. doi:10.24425/jwld.2026.156059
 
> [3.1] SELECTION OF MODELLING FRAMEWORK The modelling scheme is based on a two-dimensional (2D) depthaverage finite element model that offers sensible trade-offs between the computational and spatial resolution. (Body)
 
> [3.2] The hydrodynamic solver is an approximation of the Saint-Venant equations (shallow water equations) and the sediment transport solver contains the Exner equation of bed evolution. (Body)
 
> [3.3] The model integrates Saint-Venant shallow water equations and Exner sediment continuity equation with an empirical bank erosion module based on excess shear stress. (Abstract)
 
> [3.4] Latex, the 2D approach solves the lateral variation in the velocity of the flowing water, height of the water surface, transportation of water sediments and the distribution of shear stress that are significant in the modelling of meandering dynamics. (Body)
 
`4.` Shin S, Paik K. An improved method for single flow direction calculation in grid digital elevation models. *Hydrological Processes.* 2017;31:1650 - 1661. doi:10.1002/hyp.11135
 
> [4.1] Among single flow direction methods, the standard D8 method, in which the flow direction is set based on the steepest local slope, results in bias on surfaces that do not align with the grid directions. (Abstract)
 
> [4.2] This paper presents improvements to the global D8 (GD8) method for calculating single flow directions in a grid digital elevation model. (Abstract)
 
> [4.3] The improved method is found to be effective in resolving the problems encountered with GD8 and to be more efficient than a previously proposed alternative method (least transversal deviation (LTD) based D8, namely D8‐LTD) that uses recursive searching for the largest upstream area when multiple flow paths converge. (Abstract)
 
> [4.4] The proposed improved GD8 method offers the opportunity for improved analysis and modeling of topographically driven hydrological processes by providing better foundational flow directions for these analyses. (Abstract)
 
`5.` Xue-Jun JBWYL. Similarity analysis of flow route algorithms for extracting drainage network from grid-based terrain model. *Geographical Research.* 2008;27:1347-1357. doi:10.11821/yj2008060014
 
> [5.1] 3) multiple flow direction(MFD) algorithm is more suitable to estimate catchment area in complex terrain area than single flow direction(SFD) algorithm does that.So if the condition permits or accurate results are needed,high resolution DEM and fine MFD should be used effectively.This study also points out that the choice of flow routing algorithm has potentially important consequences for the calculation of upslope contributing areas,sediment transport capacity,topographic wetness,and several other topographic indices. (Abstract)
 
`6.` Li Z, Yang T, Xu C, et al. Evaluating the area and position accuracy of surface water paths obtained by flow direction algorithms. *Journal of Hydrology.* 2020;583:124619. doi:10.1016/j.jhydrol.2020.124619
 
> [6.1] In contrast, the SWPs extracted by MFD algorithms show excessive artificial dispersion. (Abstract)
 
> [6.2] The cross compensation of SWP area induced by artificial dispersion leads to relatively high area accuracy but relatively low position accuracy of MFD algorithms. (Abstract)
 
> [6.3] The maximum is gained by D8 or FDFM approach, and the minimum by D8-LTD or D∞ approach. (Abstract)
 
> [6.4] Several widely used flow direction algorithms including three single flow direction (SFD) algorithms (i.e. D8, Rho8 and D8-LTD approaches) and three multiple flow direction (MFD) algorithms (i.e. FDFM, MFD-md and D∞ approaches) are implemented to extract SWPs. (Abstract)
 
`7.` Song Y, Yang T, Li Z, Xu C. A complex synthetic surface for assessing flow direction algorithms based on total contributing area. *Geomorphology.* 2024. doi:10.1016/j.geomorph.2024.109080
 
> [7.1] Results indicate that the largest and smallest mean size errors are obtained by Random eight-node (Rho8) (i.e. 82.6 %) and Freeman multiple flow direction (FMFD) (i.e. 17.9 %), while the largest and smallest mean extent errors by Eight drainage directions (D8) (i.e. 128.2 %) and Eight drainage directions, least transversal deviation (D8-LTD) (i.e.55.4 %). (Abstract)
 
> [7.2] Most mean errors are larger than 20.0 %, which may not be satisfactory in practice. (Abstract)
 
`8.` Liu JZ, Naar D. Selective Depression Filling for Terrain-Derived Surface-Water Connectivity States: An Irregular-Cell Routing Framework. *Sustainability.* 2026. doi:10.3390/su18179139
 
> [8.1] SDF aggregates 8-connected DEM cells with identical elevations into irregular cells (ICs), preserving the lateral geometry of flats, lakes, and channels, and uses a catchment-to-destination area (C/D) ratio to control depression-filling levels. (Abstract)
 
> [8.2] Both methods avoid ambiguous cellwise routing across flat and low-gradient features. (Abstract)
 
> [8.3] Surface-water networks evolve as depressions fill, spill, and connect, whereas conventional digital elevation model (DEM) routing often treats flats and depressions through preprocessing or complete filling. (Abstract)
 
> [8.4] This study introduces selective depression filling (SDF), a terrain-based framework that generates routing states characterized by depression extent, network connectivity, and geometric fill-to-spill volume. (Abstract)
 
> [8.5] Depression filling changes connectivity and contributing-area propagation as depressions transition from internal termini to widened flow-path components at spillover. (Abstract)
 
`9.` Wang Y, Qin C, Zhu A. Review on algorithms of dealing with depressions in grid DEM. *Annals of GIS.* 2019;25:83 - 97. doi:10.1080/19475683.2019.1604571
 
> [9.1] Currently, there is still no one algorithm which can satisfactorily deal with depressions in grid DEMs under various application contexts (such as the application target of the processed DEM, the study area characteristics, and the characteristics of data). (Body)
 
`10.` Woodrow K, Lindsay JB, Berg A. Evaluating DEM conditioning techniques, elevation source data, and grid resolution for field-scale hydrological parameter extraction. *Journal of Hydrology.* 2016;540:1022-1029. doi:10.1016/j.jhydrol.2016.07.018
 
> [10.1] Three conditioning techniques, including depression filling (DF), depression breaching (DB), and stream burning (SB), were examined. (Abstract)
 
> [10.2] Differences in derived contributing areas and flowpaths among various conditioning techniques increased substantially at finer grid resolutions, with the largest disagreement among mapped contributing areas occurring between the 1 m resolution DB DEM and the SB DEM (37% disagreement) and the DB-DF comparison (36.5% disagreement in mapped areas). (Abstract)
 
> [10.3] The results showed that variation in DEM grid resolution resulted in significant differences in the spatial and statistical distributions of contributing areas and the distributions of downslope flowpath length. (Abstract)
 
> [10.4] Degrading the grid resolution of the LiDAR data from 1 m to 10 m resulted in a disagreement in mapped contributing areas of between 29.4% and 37.3% of the study area, depending on the DEM conditioning technique. (Abstract)
 
> [10.5] These results demonstrate that the decision to use one DEM conditioning technique over another, and the constraints of available DEM data resolution and source, can greatly impact the modeled surface drainage patterns at the scale of individual fields. (Abstract)
 
`11.` Martz L, Garbrecht J. An outlet breaching algorithm for the treatment of closed depressions in a raster DEM. *Computers & Geosciences.* 1999;25:835-844. doi:10.1016/s0098-3004(99)00018-7
 
> [11.1] Application of this breaching algorithm prior to depression filling can substantially reduce the number and size of depressions that need to be filled, especially in low relief terrain.Removing or reducing the size of a depression by breaching implicitly assumes that the depression is due to a spurious flow blockage caused by elevation overestimation. (Abstract)
 
> [11.2] The use of the breaching algorithm during DEM pre-processing substantially reduced the number of cells that needed to be subsequently raised in elevation to remove depressions. (Abstract)
 
> [11.3] Although the breaching algorithm cannot distinguish between overestimation and underestimation errors in a DEM, a constraining parameter for breaching length can be used to restrict breaching to closed depressions caused by narrow blockages along well-defined drainage courses. (Abstract)
 
> [11.4] Applying the constrained breaching algorithm prior to a conventional depression-filling algorithm allows both positive and negative elevation adjustments to be used to remove depressions.The breaching algorithm was incorporated into the DEM pre-processing operations of the TOPAZ software system. (Abstract)
 
`12.` Jiang A, Hsu K, Sanders B, Sorooshian S. Topographic hydro-conditioning to resolve surface depression storage and ponding in a fully distributed hydrologic model. *Advances in water resources.* 2023;176. doi:10.1016/j.advwatres.2023.104449
 
> [12.1] To address this gap, we present the Depression-Preserved DEM Processing (D2P) algorithm, a novel automated workflow that provides a representation of the land surface consistent with hydrologic processes being resolved while removing small-scale, non-physical variability in the DEM for computational efficiency. (Body)
 
> [12.2] The proposed D2P algorithm provides a systematic means to balance the need to process DEM for ease of computation and the preservation of surface depressions of interest. (Body)
 
> [12.3] From a case study in the Goodwin Creek Experimental Watershed, D2P successfully resolved 86% of the ponds at a DEM resolution of 10 m. (Abstract)
 
> [12.4] Our case study of a test rainfall event clearly suggests that the treatment of surface depressions and the choice of method for smoothening topographic variability (e.g., filling and breaching) have a significant influence on the hydrologic simulation results. (Body)
 
> [12.5] In addition, the use of the D2P-processed DEM in a distributed hydrologic model also highlights the difference that the incorporation of depressions makes to the simulated ponding, water storage and streamflow. (Body)
 
> [12.6] Furthermore, hydrologic simulation using a D2P processed DEM resulted in a more robust characterization on surface water dynamics based on higher surface water storage as well as an attenuated and delayed peak streamflow. (Abstract)
 
`13.` Zhang W, Li W, Loáiciga H, et al. Adaptive Determination of the Flow Accumulation Threshold for Extracting Drainage Networks from DEMs. *Remote. Sens..* 2021;13:2024. doi:10.3390/rs13112024
 
> [13.1] A key variable in the extraction of drainage networks from DEMs is the flow accumulation threshold (FAT) [3]. (Introduction)
 
> [13.2] The results show that: (1) water storage change and NDVI have high correlation with the drainage length, and the coefficient of determination (R2) ranges between 0.85 and 0.87; (2) the drainage length obtained from the Multiple Regression model using water storage change, NDVI, and topography as influence factors is similar to the actual drainage length, featuring a coefficient of determination (R2) equal to 0.714; (3) the MR-AP method calculates suitable FATs for each sub-basin in Hubei province, with a drainage length error equal to 5.13%. (Abstract)
 
> [13.3] The FAT represents the minimum number of upslope cells flowing into a flow-receiving cell that is part of a drainage network (notice the FAT is a dimensionless variable). (Introduction)
 
> [13.4] This work presents the MR-AP (Multiple Regression and Adaptive Power) method for choosing suitable FAT when extracting drainage from DEMs. (Abstract)
 
> [13.5] Power functions are fit to calculate the FAT of each sub-basin. (Abstract)
 
> [13.6] Selecting the flow accumulation threshold (FAT) plays a central role in extracting drainage networks from Digital Elevation Models (DEMs). (Abstract)
 
> [13.7] Moreover, drainage network extraction by the MR-AP method mainly depends on the water storage change and the NDVI, thus being consistent with the regional water-resources change. (Abstract)
 
> [13.8] Applying an FAT to flow accumulation values delineates the drainage network from a DEM. (Introduction)
 
`14.` Akay H, Koçyiğit MB. An Approach for Determination of the Drainage Network Effect on GIUH Using Hesitant Probabilistic Fuzzy Linguistic Sets. *Water Resources Management.* 2021;35:3873-3902. doi:10.1007/s11269-021-02935-y
 
> [14.1] It was found that the As value affected the stream order as expected and a stream order of maximum 3 was adequate for estimation of the runoff hydrograph with acceptable accuracy without unreasonably increasing the computational effort. (Abstract)
 
`15.` Yanites B. The Dynamics of Channel Slope, Width, and Sediment in Actively Eroding Bedrock River Systems. *Journal of Geophysical Research: Earth Surface.* 2018;123:1504 - 1527. doi:10.1029/2017jf004405
 
> [15.1] One potential drawback of this model is that it does not incorporate the effects of changes in channel width or the role of sediment transport dynamics. (Abstract)
 
> [15.2] Generally, the results show that incorporating channel width adjustment or sediment transport dynamics lowers the sensitivity of a river profile to rock‐uplift rate. (Abstract)
 
> [15.3] The approach produces transient responses that reveal distinct patterns of width and slope, which may provide valuable insight into the limiting physical mechanisms of bedrock erosion in a region. (Abstract)
 
> [15.4] Here I present a new method for modeling the influence of channel width on river dynamics to explore how variable width and sediment transport impact river profile evolution. (Abstract)
 
`16.` Best J. Sediment transport and bed morphology at river channel confluences. *Sedimentology.* 1988;35:481-498. doi:10.1111/j.1365-3091.1988.tb00999.x
 
> [16.1] Bed morphology at channel confluences is characterized by three distinct elements: avalanche faces at the mouth of each confluent channel, a deep central scour and a bar within the separation zone formed at the downstream junction corner. (Abstract)
 
> [16.2] These elements are controlled predominantly by the confluence angle and the ratio of discharges between the tributary and mainstream channels. (Abstract)
 
> [16.3] This segregation of sediment loads is accompanied by the retreat of the main channel avalanche face from the confluence, an increase in the scour depth, a change in the orientation of the scour and an increase in the size of the separation zone bar. (Abstract)
 
> [16.4] A model of sediment transport and bed morphology links these features to the fluid dynamics of these sites. (Abstract)
 
`17.` Yuan H, Tian H, Huang W, Zhang Z, Hu R. Numerical investigation on the hydraulic characteristics of curved open channel confluence with different main channel widths. *Physics of Fluids.* 2025. doi:10.1063/5.0281510
 
> [17.1] The scale of the separation zone increases with increase in W1 or q*. (Abstract)
 
`18.` Bekmuratova G. Integrated modelling of river morphology and sediment transport dynamics in meandering rivers.
 
> [18.1] The results highlighted significant erosion on outer banks (Up to 4.1 m/year) and deposition on inner banks (Up to 2.5 m/year), with suspended sediment transport dominating during high-flow events. (Abstract)
 
`19.` Lindsay JB. Efficient hybrid breaching‐filling sink removal methods for flow path enforcement in digital elevation models. *Hydrological Processes.* 2016;30:846 - 857. doi:10.1002/hyp.10648
 
> [19.1] Flow enforcement techniques include filling methods, which raise elevations within depressions, breaching, which carves channels through blockages, and hybrid methods. (Abstract)

