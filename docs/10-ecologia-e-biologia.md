# Escopo do mundo natural

Status: especificação de produção, não modelo científico validado. Define o que precisa existir antes de humanos. Cada sistema registra unidades, parâmetros, cadência, estoques, fontes, perdas e limitações.

## Sistemas obrigatórios de F1–F4

| Domínio | Modelo inicial | Interações e evidência |
| --- | --- | --- |
| Terreno/habitat | Altitude, inclinação, substrato, permeabilidade e cobertura por célula | Relevo muda escoamento, acesso e distribuição de habitats |
| Clima | Luz diária, estações, temperatura e umidade regional com variação por seed | Estações e eventos alteram demanda hídrica, atividade e crescimento |
| Água | Chuva, infiltração, água do solo, escoamento, corpos d'água, evaporação e transpiração | Balanço por reservatório; secas, inundação e recuperação |
| Solo | Retenção, fertilidade/nutriente agregado, matéria orgânica e erosão simplificada | Vegetação e chuva alteram retenção; erosão transporta material |
| Plantas | Sementes, germinação, desenvolvimento, crescimento, reserva, reprodução e morte | Aptidão por luz, água, temperatura e substrato; competição por espaço e recursos |
| Decomposição | Detritos e atividade decompositora agregada por célula | Cadáveres e folhas retornam nutrientes em ritmo condicionado pelo ambiente |
| Fauna | Corpo, sentidos, metabolismo, hidratação, termorregulação simplificada e descanso | Movimento/atividade gastam energia; falta de recurso tem efeitos corporais |
| Alimentação | Dieta compatível, busca, captura, consumo, assimilação e resíduos | Teia alimentar; presas e predadores têm custos e risco; sem topo universal fixo |
| Ciclo de vida | Nascimento, dependência juvenil, maturação, reprodução custosa, envelhecimento e morte | Descendentes dependem de condições; biomassa nova tem origem contabilizada |
| Saúde | Dano e uma doença simplificada com exposição, transmissão, recuperação e mortalidade | Contato/densidade e condição corporal afetam o cenário; sem microbiologia detalhada |
| Populações | Competição, deslocamento por recurso, predação, reprodução e extinção local | Capacidade de suporte emerge dos recursos; nenhum respawn oculto |
| Adaptação | Aprendizado animal, traços herdáveis, mutações e linhagens | Mudanças medidas separadamente por vida e geração; ver especificação de IA |

## Simplificações explícitas

Mapa 2D em células; reservatórios hídricos agregados; nutrientes representados inicialmente por um estoque agregado; decompositores em densidade/atividade, sem simular cada microrganismo. Plantas podem ser patches com idade/biomassa/sementes quando o custo individual for excessivo.

A simulação não reproduz química molecular, tectônica, atmosfera tridimensional ou todos os ciclos biogeoquímicos. Incêndios, polinizadores especializados, parasitas adicionais, genética complexa e especiação automática são expansões planejáveis, não gates ocultos.

Faixas climáticas e biológicas são parâmetros de jogo até calibração. A documentação não afirma validação científica apenas por usar termos ecológicos.

## Fluxos

Luz e condições ambientais permitem produção vegetal; nutrientes e água limitam a produção. Consumo transfere parte da biomassa para reservas do consumidor e resíduos. Metabolismo dissipa energia. Morte produz detritos; decomposição disponibiliza nutrientes. Água tem entradas, transferências e perdas explícitas.

Balanceamento pode usar fontes e sumidouros de borda, desde que apareçam nas métricas. Não fabricar matéria ou animais para sustentar uma aparência de equilíbrio.

## Representação e observação

Sobreposições: temperatura, umidade, água, fertilidade, cobertura vegetal, biomassa, detritos, distribuição de espécies e mortalidade. Inspeção distingue estoque atual, fluxo por intervalo e capacidade máxima.

Selecionar uma planta mostra estágio e fatores limitantes. Selecionar um animal mostra necessidades, ação, percepção e história. O painel de população mostra distribuição etária, nascimentos, mortes, migração e linhagens.

## Cenários de aceite

Chuva após seca; escoamento para área baixa; vegetação em solo inadequado; competição vegetal; morte e decomposição; herbivoria; perseguição com gasto energético; reprodução sem reserva suficiente; doença em grupos densos; recuperação após redução de consumo.

Cada cenário declara seed, parâmetros, duração, expectativa direcional, tolerâncias e invariantes. Referência quantitativa e tolerância são fixadas antes do teste. Uma trajetória específica de população não deve ser imposta a todas as seeds.
