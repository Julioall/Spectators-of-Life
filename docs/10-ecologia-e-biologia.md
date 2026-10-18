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
| Adaptação | F3: baseline de comportamento; F4: aprendizado online, traços herdáveis, mutações e linhagens | Efeito durante a vida separado de mudanças entre gerações; ver especificação de IA |

## Contrato biológico por espécie

Cada perfil declara as condições e restrições que realmente entram no modelo: dieta, habitat, faixa térmica, necessidades de água e alimento, sentidos, custos de movimento, ciclo de vida e estratégia reprodutiva. Para plantas, registra-se preferência por luz, água, temperatura e substrato; para animais, também tamanho corporal, maturação, sazonalidade reprodutiva, quantidade de descendentes e cuidado parental quando representados. Uma simplificação por espécie deve ser explícita, não presumida como regra de todos os animais.

F3 valida perfis e ciclos de vida com comportamento de referência; F4 acrescenta aprendizagem online e variação herdável. Diferenças populacionais em F3 não devem ser descritas como evolução genética se genoma, herança e mutação ainda estiverem desligados.

## Simplificações explícitas

Mapa 2D em células; reservatórios hídricos agregados; nutrientes representados inicialmente por um estoque agregado; decompositores em densidade/atividade, sem simular cada microrganismo. Plantas podem ser patches com idade/biomassa/sementes quando o custo individual for excessivo.

A simulação não reproduz química molecular, tectônica, atmosfera tridimensional ou todos os ciclos biogeoquímicos. Incêndios, polinizadores especializados, parasitas adicionais, genética complexa e especiação automática são expansões planejáveis, não gates ocultos.

Faixas climáticas e biológicas são parâmetros de jogo até calibração. A documentação não afirma validação científica apenas por usar termos ecológicos.

## Fluxos e orçamentos biológicos

Luz e condições ambientais permitem produção vegetal; água e nutrientes limitam essa produção. Consumo remove biomassa comestível disponível. Cada cenário declara quais partes são modeladas e usa unidades compatíveis.

Manter registros separados para:
- **Matéria/biomassa:** produção vegetal, consumo, crescimento corporal, descendentes, resíduos, detritos e decomposição. Transferências internas têm origem e destino explícitos; fontes e perdas de borda são registradas.
- **Energia utilizável:** assimilação do alimento e alocação para manutenção, termorregulação quando modelada, movimento, reparo, crescimento e reprodução. Eficiência de assimilação e custos devem ser parâmetros explícitos; metabolismo dissipa energia do sistema.
- **Água:** ingestão, armazenamento corporal quando modelado, perdas e disponibilidade ambiental.

O tamanho ou massa estrutural do corpo não é a mesma coisa que reserva energética. Crescimento e reprodução consomem recursos; nascimento não pode criar biomassa sem custo ou fonte declarada. Isso não exige implementar a teoria completa de Dynamic Energy Budget (DEB): o protótipo pode usar um orçamento simplificado, desde que as unidades, fluxos, limites e perdas estejam visíveis e sejam testáveis.

Balanceamento pode usar fontes e sumidouros de borda, desde que apareçam nas métricas. Não fabricar matéria ou animais para sustentar uma aparência de equilíbrio.

## Representação e observação

Sobreposições: temperatura, umidade, água, fertilidade, cobertura vegetal, biomassa, detritos, distribuição de espécies e mortalidade. Inspeção distingue estoque atual, fluxo por intervalo e capacidade máxima.

Selecionar uma planta mostra estágio e fatores limitantes. Selecionar um animal mostra necessidades, ação, percepção e história. O painel de população mostra distribuição etária, nascimentos, mortes, migração e linhagens.

## Cenários de aceite

Chuva após seca; escoamento para área baixa; vegetação em solo inadequado; competição vegetal; morte e decomposição; herbivoria; perseguição com gasto energético; alimentação seguida de manutenção, crescimento e reprodução; resíduos e mortalidade retornando ao estoque de detritos; reprodução sem reserva suficiente; doença em grupos densos; recuperação após redução de consumo.

Cada cenário declara seed, parâmetros, duração, expectativa direcional, tolerâncias e invariantes. Referência quantitativa e tolerância são fixadas antes do teste. Uma trajetória específica de população não deve ser imposta a todas as seeds.
