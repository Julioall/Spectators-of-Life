# SPEC-100 — Mundo físico: terreno, clima e água

**Fase:** F1  
**Estado:** rascunho de contrato; parâmetros ambientais aguardam cenário de referência.  
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

Para cada reservatório, registrar estoque inicial, entradas, transferências, saídas e estoque final. Transferência entre células reduz o doador e aumenta o receptor pela mesma quantidade. Overflow, evaporação, drenagem e saída da borda são sinks explícitos. Valores negativos ou fluxos maiores que o estoque causam diagnóstico, sem clamp silencioso.

Escoamento segue gradiente hidráulico usando elevação mais lâmina superficial. Regras para depressões, lagos temporários, divisores e bordas devem ser determinísticas e constar na configuração. A condição de borda pode reter, refletir ou remover fluxo, mas não pode ficar implícita.

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
