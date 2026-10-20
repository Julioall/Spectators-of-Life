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

Clima e água calculam fluxos a partir do estado anterior do intervalo e aplicam deltas de modo determinístico. O solver em cascata da versão 1.11 permite que uma célula receba e encaminhe escoamento no mesmo passo, processando a rede em ordem decrescente de carga hidráulica; versões anteriores mantêm o encaminhamento de um passo por vez.

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

Escoamento usa carga hidráulica em metros: `elevação_m + lâmina_mm / 1000`. Na versão 1.11 cada célula encaminha parte do excedente ao vizinho com menor carga, e a água percorre vários trechos no mesmo passo; se não há vizinho mais baixo, a água permanece numa depressão fechada e pode elevar o nível até formar um lago ou alcançar sua soleira. Borda aberta descarrega somente nos limites do mapa. As rotas são D8 e determinísticas; não há entrada exterior implícita.

## 6. Eventos e inspeção

Eventos mínimos: começo/fim de estação, chuva, seca, saturação, escoamento relevante e inundação. Cada evento inclui tick, região/células, fluxo ou estoque antes/depois, regra causadora e seed/cenário de origem.

A inspeção distingue estoque atual (mm), fluxo no intervalo (mm por célula por período), capacidade de armazenamento e acumulado da janela. Camadas de mapa podem exibir relevo, temperatura, umidade, água superficial, água do solo, precipitação e direção de fluxo.

## 7. Cenários de aceite

- Chuva em terreno seco aumenta estoque superficial/solo respeitando infiltração e conservação por reservatório.
- Água em encosta escoa para células mais baixas; transferências internas fecham o balanço.
- Uma rota permanente de rio acompanha sucessivos vizinhos de menor relevo até uma saída, uma depressão ou um lago.
- Chuva que escoa percorre mais de uma célula no mesmo passo; depressões sem saída acumulam água como lago, e saídas abertas descarregam pela borda.
- A apresentação agrupa água temporária em formas contínuas e mostra correnteza alinhada ao caminho hidráulico, sem desenhar cada célula como quadrado isolado.
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

O renderer compõe uma textura-base determinística por classe de superfície, mistura bordas por dither a partir das oito células vizinhas e aplica uma máscara de nove bits para arredondar as margens de água. O módulo visual `terrain-lighting.ts` calcula inclinação por diferenças centrais, aplica hillshade com direção solar configurável e acrescenta uma aproximação de oclusão de até quatro células. Um pincel ponderado suaviza os fatores entre células e a textura interpola a luz em escala de pixel. A textura do solo recebe o fator multiplicativo por canal RGB; alfa, paleta, altitude, clima e hidrologia permanecem inalterados. O padrão é luz a 315° e força 3. O controle pode desativar a iluminação e oferece ângulo entre 0° e 345° em passos de 15° e força entre 0 e 8 em passos de 0,5. O campo é recalculado ao criar/carregar outro mundo, mudar um controle ou detectar mudança de altitude igual ou superior a 0,25 m; não é executado por frame. Mudanças locais repintam uma vizinhança limitada às dependências do gradiente, oclusão e pincel; alterações em mais de 60% do mapa fazem uma atualização completa. As opções são estado de apresentação e não entram no save nem no Worker. A oclusão é uma aproximação de renderização, não sombra física. A vista diagnóstica Altitude usa a elevação bruta numa rampa hipsométrica contínua, mantém as curvas de nível e sobrepõe a paleta com 48% de opacidade, mantendo iluminação, água, vegetação e minérios legíveis por baixo; ela não altera dados ou a câmera top-down. A camada Relevo continua exibindo faixas hipsométricas e curvas de nível na vista natural. A técnica de composição segue o fluxo do protótipo Asterra v4; a folha sem mapa de recortes não é usada como atlas de runtime. Variações decorativas dependem de coordenadas e de uma seed visual estável, separada do RNG da simulação. Nenhum bitmask, sprite ou detalhe visual determina substrato, altitude, infiltração ou fluxo.

As camadas Altitude e Relevo suavizam o campo de altura com o pincel ponderado 5×5 e interpolam a rampa por pixel antes de compor as cores do solo; curvas de nível continuam lendo a altitude bruta. Rios e lagos recebem uma textura auxiliar com máscara nas células molhadas, pincel de profundidade limitado a essa máscara e amostragem bilinear da cor e da iluminação topográfica a dez amostras por célula. Um feather discreto integra as margens; a geometria e o estado de água continuam sendo os mesmos do mapa lógico. Esses efeitos são projeções visuais, sem alteração de altitude, lâmina, erosão ou escoamento.

Essa orientação é independente do solver hidrológico. As referências sobre [templates de autotile](https://opengameart.org/content/gamemaker-autotile-templates), [camadas e tiles](https://www.madwomb.com/tutorials/GameDesign_Unity2DTilemap.html) e [bitmasks de vizinhança](https://excaliburjs.com/blog/Autotiling%20Technique/) ajudam a escolher uma técnica de apresentação; não definem parâmetros ou critérios de aceite para a simulação.

## 11. Implementação inicial — cenário de referência

`data/scenarios/natural-temperate-valley.v1.11.json` fixa um mapa de 80×56 células de 250 m (20×14 km no parâmetro do jogo), borda aberta com saídas identificadas, quatro ticks por dia e 30 dias por estação. Os cenários `1.0.0` (32×24 células de 100 m) e `1.1.0` a `1.10.0` continuam aceitos em saves existentes; novas criações usam `natural:temperate-valley@1.11.0`. Essas escalas são parâmetros de jogo, não afirmações de escala ecológica real.

As versões `1.2.0` e `1.3.0` geram campos espaciais amplos e médios para relevo, geologia, solo, chuva e potencial florestal. A versão `1.3.0` também grava potencial mineral por célula: províncias regionais, rocha hospedeira e afloramentos orientam veios específicos de cobre, ferro, prata e ouro. Na versão `1.8.0`, a prospectividade combina esse campo regional com altitude, declive, exposição da rocha e rocha hospedeira, fazendo as manchas minerais acompanharem o relevo sem tornar cada ponto alto automaticamente rico. Na versão `1.9.0`, habitats, solos e famílias visuais usam um campo regional derivado de uma vizinhança gaussiana de 5×5; 75% da classificação segue essa forma ampla e 25% preserva a altitude local. A altitude física e o declive local não são suavizados: vales, encostas e áreas altas ficam mais contínuos sem apagar afloramentos, canais e outras feições locais. Essa versão de regionalização está registrada na [ADR 0011](../adr/0011-regionalizacao-alinhada-ao-relevo.md). Veios variam em comprimento, largura, reserva, teor, profundidade e classe de tamanho; ocorrências pequenas nas bordas dão lugar a núcleos maiores em áreas mais favoráveis. A camada Potencial mineral mostra prospectividade estimada, enquanto Minérios mostra apenas os afloramentos gerados. Isso é uma simplificação geológica de jogo, não uma previsão de depósitos reais.

A projeção de rochas executa as funções originais do motor ASTERRA v2.3, extraídas literalmente do HTML do autor e verificadas por SHA-256. O adaptador lê células com rocha exposta e depósitos minerais expostos, relaciona materiais/biomas/geologia e usa os perfis e pegadas originais. `drawOutcrop`, `rockSprite` e `pixelFinish` conservam paletas, famílias, cinco variantes, malhas, fraturas, musgo, cristais, enterramento e composição com pedras de apoio. A família de paleta é escolhida pela superfície que o renderer do projeto já desenha (`loam`, `meadow`, `desert`, `wetland`, `rock` etc.), com basalto encaminhado à família vulcânica; a tabela compartilhada evita que a rocha e o solo usem classificações diferentes. Em superfícies cinza (`mountain` e `volcanic`), o adaptador ambienta a base geológica para acompanhar o cinza do terreno, preservando os veios característicos de cobre, ferro, prata e ouro e os pixels verdes de musgo. Habitats de floresta recebem mais musgo pelo mesmo parâmetro ASTERRA, sem alterar o estado físico. Famílias pontiagudas ficam restritas a biomas e habitats secos. Uma passagem adicional distribui pedregulhos pequenos em células sem água, e formações grandes recebem acompanhantes pequenos/médios em células rochosas próximas. A seleção compacta os grupos e aumenta a probabilidade de cascalho junto a margens de rios, escoamento, sedimento, incisão e erosão recente. O cascalho não é colocado dentro da água. O campo regional suavizado em blocos de oito células filtra terreno isolado e concentra a projeção em manchas contínuas, mantendo a exceção para drenagem e erosão. Quando uma pegada ou o corpo visual toca um rio ou lago, o adaptador tenta âncoras vizinhas determinísticas para manter a pedra na margem e deixar o leito visível. O adaptador agrupa células expostas em manchas conectadas, distribui âncoras com espaçamento determinístico e usa tiers normais, pequenos e escalas reduzidas nas bordas para fazer a transição gradual até os núcleos maiores. A escala reduzida afeta somente a projeção, enquanto a pegada nativa continua sendo calculada por `footprintAt`. Árvores e rochas compartilham uma profundidade derivada da base no eixo Y; a base mais baixa fica à frente e, em empate, a rocha fica à frente. As pegadas de formações `large` e `macro` ocultam árvores e cobertura visual dentro delas sem alterar os cohorts salvos. O Phaser mantém a relação original de 16 pixels por célula, permitindo formações multi-célula. As pegadas reservam espaço entre formações visuais; peças de apoio podem ultrapassar seus limites e não existe colisão física de rochas. Perfis normal/raro/épico afetam somente o desenho. O gerador visual não grava estado, não consome RNG da simulação e não altera reservas, teor, solo, relevo ou fluxo. O mapa fixo e os controles da demonstração não substituem o cenário físico. O atlas antigo e os PNGs de comparação do HTML não são carregados pelo jogo; ver [ADR 0008](../adr/0008-amontoados-procedurais-de-rocha.md) e [documentação do motor](../../src/render/asterra/README.md).

O fator regional de chuva fica salvo por célula e determina precipitação sazonal, umidade e parte da classificação do bioma: regiões muito úmidas favorecem pântanos em baixadas e bacias, zonas intermediárias formam floresta ou pradaria, e chuva baixa forma terras secas e desertos. Solo arenoso é favorecido por aridez e argila por baixadas úmidas. Altitude, declividade e bacia modulam esses limites. A rocha exposta é uma barreira de estabelecimento arbóreo; o solo rochoso sem afloramento apenas reduz a afinidade, com tolerância maior para pinheiros e bétulas. Esses limites são abstrações do jogo, não calibração ecológica.

`src/core/natural/generation.ts` gera relevo multiescala com cristas e vales curvos definidos por seed, chuva regional, substrato, rocha, direções D8 de descida, bacias, lagos iniciais e províncias de cobre, ferro, prata e ouro. Desde `1.11.0`, os cursos permanentes são selecionados a partir da acumulação de chuva e seguem as próprias direções de drenagem do terreno até um lago ou sumidouro; a rota artificial escolhida por distância entre bordas deixou de forçar o traçado e escavar canais que não correspondiam à topografia. A contribuição acumulada considera chuva regional, declive e fração de escoamento do solo. A versão `1.10.0` já alargava o leito onde células vizinhas drenam diretamente para canais, com expansão maior a jusante e nos encontros. O renderer conecta o leito ao lago, desenha remansos visuais em confluências e agora também mostra cursos temporários pela rota hidráulica ativa, com largura variável, contorno suavizado e pequenos reflexos que percorrem a corrente. Na versão `1.11.0`, o cenário encaminha de 82% a 98% da água superficial disponível após a infiltração quando existe um vizinho mais baixo; a fração varia com o escoamento do solo e a inclinação hidráulica. Lagos ocupam depressões conectadas; os lagos iniciais continuam definidos pela geração procedural e essa versão também forma lagos dinâmicos em depressões fechadas quando o estoque acumulado ultrapassa o volume da depressão. A água que excede a soleira volta a escoar; saídas abertas no limite do mapa descarregam o excedente. A versão `1.7.0` introduziu a descarga auditada de cursos e lagos de borda, enquanto a `1.6.0` permanece fechada para saves antigos. A lâmina continua armazenada em milímetros. Células de rio ou lago não recebem árvores; pequenas lâminas temporárias desaparecem com infiltração e evaporação quando a chuva cessa. Sombreamento, faixas de altitude, curvas de nível e o pincel de água são projeções visuais do relevo e do estoque; não alteram o estado lógico. `environment-systems.ts` aplica erosão mineral dependente de escoamento, declive, área contribuinte e resistência do substrato; margens adjacentes a canais acumulam incisão mais rapidamente, e canais novos surgem quando incisão e área contribuinte passam os limiares do cenário. Sedimentos móveis percorrem a drenagem, depositam-se em baixios e aumentam a elevação local. A matéria orgânica e o nitrogênio seguem o escoamento; sedimentos e água de rios/lagos alimentam o solo de margens suaves, que passam a habitat úmido e podem sustentar vegetação de margem. A descarga de borda é contabilizada no fluxo de cada passo, nos totais naturais, nas métricas do mundo e no evento de hidrologia; o sedimento continua depositando na célula de borda conforme a regra agregada atual. Os valores são abstrações de jogo, sem calibração geológica. O escoamento escolhe o vizinho com menor carga hidráulica (`elevação + lâmina superficial`); desde `1.11.0`, a água pode percorrer vários trechos no mesmo passo em ordem hidráulica descendente. Precipitação entra, infiltra ou escoa, e evaporação/transpiração saem do balanço hídrico.

O escoamento dinâmico usa vizinhança D8 local e um solver em cascata, mas não há solver subdiário, aquífero ou drenagem profunda. O remanso desenhado nas confluências continua sendo uma projeção, não uma bacia lógica. Larguras físicas são limitadas pela resolução de 250 m por célula. Lagos iniciais e cursos permanentes gerados permanecem identificados durante a simulação; novos canais erosivos ainda exigem incisão acumulada e área contribuinte mínima. Cursos pequenos de chuva continuam temporários e desaparecem conforme a água infiltra ou evapora; depressões sem saída podem virar lagos dinâmicos, e ultrapassar a soleira libera água para jusante. A deposição e a incisão usam taxas agregadas, sem granulometria, transporte em suspensão pela velocidade, cheias ou recalibração de bacias em escala fina. Margens úmidas recebem infiltração transferida dos corpos d'água e favorecem plantas terrestres; ainda não há espécies aquáticas nem colonização vegetal entre células. A seca visual é representada pela redução da lâmina e exposição de leitos persistentes; calibração hidrológica e validação visual de múltiplas seeds, zooms e estações continuam pendentes, então a SPEC-100 permanece em revisão.
