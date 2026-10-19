# SPEC-100 — Mundo físico: terreno, clima e água

**Fase:** F1  
**Estado:** implementação inicial no cenário de referência; critérios hidráulicos e calibração continuam em revisão.
**Depende de:** [SPEC-000](000-fundacao-runtime.md), [SPEC-001](001-relogio-e-metricas.md), [escopo natural](../10-ecologia-e-biologia.md).

## 1. Objetivo e limites

Construir uma paisagem 2D reproduzível com relevo, habitats físicos, luz, temperatura, precipitação e reservatórios hídricos. O mapa deve gerar padrões observáveis de escoamento, retenção, seca e inundação.

F1 não contém plantas, decompositores, animais, redes neurais ou pessoas. Evapotranspiração vegetal fica desligada; a evaporação física pode ser representada. A atmosfera é uma forçante climática simplificada, não um modelo meteorológico tridimensional.

## 2. Espaço e estado por célula

O mundo usa grade 2D regular. Cada cenário declara dimensões em células, tamanho da célula em metros e condição de borda. Não inferir escala física da resolução visual do pixel art.

Cada célula registra:

- elevação relativa em metros;
- gradiente do terreno;
- classe de substrato e parâmetro de infiltração;
- lâmina de água superficial em mm equivalentes;
- água armazenada no solo em mm;
- parâmetros locais de retenção e capacidade hídrica;
- índices climáticos no intervalo, como temperatura e umidade relativa.

Armazenar mapas em estruturas de dados da simulação. Cores, sprites, detalhes de pedra e variação de desenho são dados de renderização; não mudam elevação, permeabilidade ou fluxo.

## 3. Unidades, calendário e cadência

Usar SI ou unidade explicitamente conversível: metros, graus Celsius, milímetros de água, umidade relativa entre 0 e 1, e energia solar acumulada em MJ/m². Precipitação e evaporação são profundidades de água; o volume correspondente usa a área declarada da célula.

O cenário declara ticks por dia, duração das estações em dias e período de cada sistema em ticks. F1 não define um número universal enquanto a duração lógica do tick e a escala do mapa não forem aprovadas. Todo parâmetro climático e hidrológico tem unidade, faixa válida e versão.

Clima e água usam estado anterior do intervalo para calcular fluxos e aplicam deltas depois do cálculo. Uma célula não pode encaminhar no mesmo passo a água recém-recebida de outra célula, salvo se a regra explícita de solver permitir isso.

## 4. Clima

O cenário fornece forçantes sazonais de temperatura, umidade, precipitação e energia solar. A localização, elevação, orientação e seed modulam essas condições por regras declaradas. Variação aleatória vem do fluxo RNG do sistema climático, nunca da câmera ou do tempo de parede.

Eventos como seca e excesso de chuva são parâmetros/eventos com início, duração, região e intensidade registrados. F1 pode usar séries e curvas simples por região; não deve alegar previsão meteorológica ou clima realista sem validação específica.

## 5. Balanço hídrico

Cada atualização calcula, por célula:

- precipitação e outras entradas explícitas;
- infiltração de água superficial para o solo, limitada pela permeabilidade e capacidade restante;
- escoamento superficial entre células e saída de borda;
- evaporação da superfície;
- evaporação do solo e drenagem profunda como perdas separadas.

Para cada reservatório, registrar estoque inicial, entradas, transferências, saídas e estoque final. Transferência entre células reduz o doador e aumenta o receptor pela mesma quantidade. Overflow interno permanece na superfície ou é transferido a outro reservatório; só vira perda quando cruza uma borda declarada. Evaporação, drenagem fora do domínio e saída da borda são sinks explícitos. Valores negativos ou fluxos maiores que o estoque causam diagnóstico, sem clamp silencioso.

Escoamento usa carga hidráulica em metros: `elevação_m + lâmina_mm / 1000`. Regras para depressões, lagos temporários, divisores e bordas devem ser determinísticas e constar na configuração. A fixture escolhe borda fechada (fluxo externo zero) ou aberta com saídas identificadas e auditadas; não há entrada exterior implícita.

## 6. Eventos e inspeção

Eventos mínimos: começo/fim de estação, chuva, seca, saturação, escoamento relevante e inundação. Cada evento inclui tick, região/células, fluxo ou estoque antes/depois, regra causadora e seed/cenário de origem.

A inspeção distingue estoque atual (mm), fluxo no intervalo (mm por célula por período), capacidade de armazenamento e acumulado da janela. Camadas de mapa podem exibir relevo, temperatura, umidade, água superficial, água do solo, precipitação e direção de fluxo.

## 7. Cenários de aceite

- Chuva em terreno seco aumenta estoque superficial/solo respeitando infiltração e conservação por reservatório.
- Água em encosta escoa para células mais baixas; transferências internas fecham o balanço.
- Saturação impede infiltração além da capacidade declarada e encaminha o excedente segundo a regra de overflow.
- Período sem chuva reduz estoques apenas pelos sinks ativos; secagem é reproduzível por seed.
- Repetir a mesma seed/configuração em execução particionada e não particionada produz o mesmo mapa e estado.
- Alterar velocidade visual 1×/8× sem alterar ticks processados produz estado idêntico.
- Câmera, FPS e render desligado não alteram qualquer fluxo.

Cada fixture fixa mapa, seed, calendário, condição de borda, parâmetros, duração, tolerância antes da execução e balanço esperado.

## 8. Decisões ainda necessárias antes da calibração

A primeira fixture de referência deve fixar dimensões, tamanho de célula, calendário (ticks por dia e dias por estação), tipos de substrato, perfil climático, bordas e tolerâncias numéricas. Esses valores serão propriedades do cenário e de sua versão, não “constantes naturais” do projeto.

## 9. Integração de unidades e competição entre fluxos

Para área A em m²: `volume_L = lâmina_mm × A`; `volume_mL = lâmina_mm × A × 1000`. Conversão de ingestão animal deve descontar o volume equivalente do reservatório. Parâmetro de infiltração informa mm/dia; capacidade de armazenamento informa mm. Converter taxas pelo tempo lógico decorrido, nunca pelo FPS.

Calcular propostas de saída a partir do mesmo estoque inicial; infiltração, evaporação e escoamento disputam esse estoque. Resolver a soma por regra documentada antes de aplicar deltas, sem exceder o doador. Água recebida de vizinhos fica disponível no próximo passo do solver. Em F2, transpiração é uma transferência auditada para a fronteira atmosférica; não descontar o mesmo consumo novamente no sistema de água.

A fixture fixa tolerância absoluta com unidade e tolerância relativa adimensional para resíduos de arredondamento. Resíduo numérico fica no diagnóstico; qualquer ajuste permitido precisa de regra explícita e fluxo contabilizado. Tolerância não autoriza criar recurso ou ocultar estoque inválido.

Além dos parâmetros ambientais, bloquear a aceitação da implementação até definir solver, alocação de fluxos concorrentes, integração temporal e fixture numérica de referência. Testar explicitamente conversões m/mm/L/mL e múltiplas saídas simultâneas.

## 10. Referência visual do terreno procedural

As imagens fornecidas em [data/assets/environment](../../data/assets/environment/README.md) servem como referência de arte, não como mapa físico. A folha de autotiling mede 192 × 896 px e sugere uma grade de 64 × 64 px, mas não declara a função dos recortes nem sua correspondência com classes e máscaras; ela permanece fora do runtime até esse mapeamento estar definido.

O renderer compõe uma textura-base determinística por classe de superfície, mistura bordas por dither a partir das oito células vizinhas e aplica uma máscara de nove bits para arredondar as margens de água. A textura recebe sombreado direcional calculado a partir das altitudes vizinhas; a camada Relevo mostra faixas hipsométricas e curvas de nível a partir do mesmo campo físico. A técnica segue o fluxo do protótipo Asterra v4; a folha sem mapa de recortes não é usada como atlas de runtime. Variações decorativas dependem de coordenadas e de uma seed visual estável, separada do RNG da simulação. Nenhum bitmask, sprite ou detalhe visual determina substrato, altitude, infiltração ou fluxo.

Essa orientação é independente do solver hidrológico. As referências sobre [templates de autotile](https://opengameart.org/content/gamemaker-autotile-templates), [camadas e tiles](https://www.madwomb.com/tutorials/GameDesign_Unity2DTilemap.html) e [bitmasks de vizinhança](https://excaliburjs.com/blog/Autotiling%20Technique/) ajudam a escolher uma técnica de apresentação; não definem parâmetros ou critérios de aceite para a simulação.

## 11. Implementação inicial — cenário de referência

`data/scenarios/natural-temperate-valley.v1.6.json` fixa um mapa de 80×56 células de 250 m (20×14 km no parâmetro do jogo), borda fechada, quatro ticks por dia e 30 dias por estação. Os cenários `1.0.0` (32×24 células de 100 m), `1.1.0` (64×48 células de 250 m) e `1.2.0` a `1.5.0` continuam aceitos em saves existentes; novas criações usam `natural:temperate-valley@1.6.0`. Essas escalas são parâmetros de jogo, não afirmações de escala ecológica real.

As versões `1.2.0` e `1.3.0` geram campos espaciais amplos e médios para relevo, geologia, solo, chuva e potencial florestal. A versão `1.3.0` também grava potencial mineral por célula: províncias regionais, rocha hospedeira e afloramentos orientam veios específicos de cobre, ferro, prata e ouro. Veios variam em comprimento, largura, reserva, teor, profundidade e classe de tamanho; ocorrências pequenas nas bordas dão lugar a núcleos maiores em áreas mais favoráveis. A camada Potencial mineral mostra prospectividade estimada, enquanto Minérios mostra apenas os afloramentos gerados. Isso é uma simplificação geológica de jogo, não uma previsão de depósitos reais.

O fator regional de chuva fica salvo por célula e determina precipitação sazonal, umidade e parte da classificação do bioma: regiões muito úmidas favorecem pântanos em baixadas e bacias, zonas intermediárias formam floresta ou pradaria, e chuva baixa forma terras secas e desertos. Solo arenoso é favorecido por aridez e argila por baixadas úmidas. Altitude, declividade e bacia modulam esses limites. A rocha exposta e o solo rochoso reduzem estabelecimento e crescimento arbóreo, com tolerância maior para pinheiros e bétulas. Esses limites são abstrações do jogo, não calibração ecológica.

`src/core/natural/generation.ts` gera relevo multiescala com cristas e vales curvos definidos por seed, chuva regional, substrato, rocha, direções D8 de descida, bacias, lagos iniciais e províncias de cobre, ferro, prata e ouro. A rede fluvial combina a drenagem local com um curso principal sinuoso entre lados opostos do mapa e afluentes que partem de regiões altas e úmidas. O caminho é escolhido por custo de distância, altitude e subida; o relevo recebe um entalhe descendente estreito para alinhar o canal à drenagem física. A contribuição acumulada de cada célula considera chuva regional, declive e fração de escoamento do solo: cabeceiras começam estreitas e os canais alargam gradualmente a jusante e após confluências. Lagos ocupam partes baixas e crescem como manchas conectadas; lagos menores podem transbordar para lagos maiores ou para um rio quando a soleira de saída pode ser alcançada sem elevar a água inicial mais de 25 m acima do fundo do lago. As ligações são estáticas no mapa gerado; o nível de lago não tem solver próprio durante a simulação. A borda continua fechada: cursos que chegam à margem são recortados visualmente, sem contabilizar perda de água para fora do mundo. A água de cada célula guarda lâmina em milímetros; a camada visual suaviza as margens, grada a profundidade e largura dos rios e usa reflexos discretos. A inspeção mostra tipo e água superficial separadamente da umidade do solo. Células classificadas como rio ou lago não recebem vegetação arbórea. O sombreado, as faixas de altitude e as curvas de nível são projeções visuais do relevo numérico. `environment-systems.ts` aplica erosão mineral dependente de escoamento, declive, área contribuinte e resistência do substrato; sedimentos móveis percorrem a drenagem, depositam-se em baixios e aumentam a elevação local. A incisão atualiza declives e direções de fluxo, e forma novas células de rio somente quando a incisão e a área contribuinte passam os limiares do cenário. A matéria orgânica e o nitrogênio seguem o escoamento; sedimentos e água de rios/lagos alimentam o solo de margens suaves, que passam a habitat úmido e podem sustentar vegetação de margem. As transferências de água e sedimento permanecem dentro da borda fechada. Os valores são abstrações de jogo, sem calibração geológica. O escoamento escolhe o vizinho com menor carga hidráulica (`elevação + lâmina superficial`) e direciona cada saída a partir do mesmo estado inicial do intervalo; a água recebida fica disponível no passo seguinte. Precipitação entra e evaporação/transpiração saem do balanço hídrico.

O escoamento dinâmico ainda usa vizinhança D8 local; não há solver de nível de lago, aquífero, drenagem profunda, neve ou continuidade fluvial subdiária. Lagos e rios gerados permanecem identificados durante a simulação; canais novos exigem incisão acumulada e área contribuinte mínima. Cursos de chuva pequenos e sem erosão suficiente continuam temporários e desaparecem conforme a água infiltra ou evapora. A deposição e a incisão usam taxas agregadas, sem granulometria, transporte em suspensão por velocidade, cheias ou recalibração de bacias em escala fina. Margens úmidas recebem água de infiltração transferida dos corpos d'água e favorecem plantas terrestres já presentes; ainda não há espécies aquáticas nem colonização vegetal entre células. Não há eventos próprios de seca ou saturação. A leitura visual inicial foi conferida no navegador e refinada; calibração hidrológica, outros zooms e cenários quantitativos ainda precisam de revisão, então a SPEC-100 continua em revisão e não foi aceita.
