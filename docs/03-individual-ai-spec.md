# IA, biologia e evolução dos indivíduos

## Escopo por fase

F1–F2: plantas e decomposição por regras biológicas, sem rede por planta ou microrganismo.
F3: indivíduos animais com corpo, metabolismo, percepção e controlador heurístico de referência.
F4: redes individuais aprendendo durante a vida e experimentos de herança.
F5 em diante: humanos estendem o indivíduo biológico; ações culturais e sociais entram gradualmente.

O baseline heurístico mede o aprendizado; não substitui a meta de controladores neurais online.

## Separação dos dados

Genoma: parâmetros herdáveis como metabolismo, tamanho, sentidos, resistência e custo de movimento.
Estado corporal: idade, reservas, hidratação, saúde, desenvolvimento e condição reprodutiva.
Controlador: pesos, hiperparâmetros, memória, exploração, transição pendente e métricas.
Linhagem: pais, geração, alterações herdadas e nascimento.
Cultura futura: práticas e habilidades aprendidas por experiência ou contato, separadas de genes.

Usar componentes opcionais. Plantas têm ciclo biológico e hereditariedade, mas não precisam de controlador animal.

## Percepção e ação

Fauna percebe apenas sinais disponíveis aos seus sensores: recursos, temperatura, água, risco, indivíduos próximos e memória de locais. Observações são normalizadas, versionadas e limitadas ao alcance de percepção.

Ações iniciais: deslocar, explorar, alimentar-se, beber, descansar, buscar abrigo, fugir, perseguir e interagir/reproduzir quando elegível. Movimento usa um executor e navegação com custos; a rede escolhe ações ou intenções em uma cadência própria.

Capacidades e precondições determinam ações legais. Se nenhuma for legal, usar espera segura explicitamente registrada. Conhecimento de reputação política, plantio ou profissão não integra o vetor animal.

## Hipótese de algoritmo para F4

Candidato inicial: MLP pequena com uma saída Q por ação discreta e escolha epsilon-greedy entre ações legais. Atualização TD após transição; alvo terminal não inclui valor futuro. Para ações de duração variável, desconto usa o intervalo lógico.

Não misturar logits de política com saídas Q. A adoção definitiva depende de experimentos: aproximação neural e múltiplos agentes aprendendo não garantem convergência. Dimensões, limites, taxa de aprendizado, clipping e memória serão fixados no contrato de experimento antes de implementar.

Cada animal mantém pesos próprios. Atualizações e experiências são limitadas por orçamento determinístico; falhas numéricas geram diagnóstico. Não há pré-treino externo ou inferência remota.

## Herança e aprendizado

Tratar dois eixos independentes:
- Aprendizado em vida: ligado ou desligado no cenário.
- Herança: traços genéticos; ou traços mais transferência experimental de pesos compatíveis.

Referência biológica: traços são herdados, experiências e pesos aprendidos não são copiados por reprodução. O efeito do aprendizado sobre seleção pode ser investigado sem essa cópia.

Modo de jogo Lamarckiano: descendente recebe parte dos pesos aprendidos com mistura/ruído limitado; é uma abstração explícita, configurável e comparada ao baseline. Não afirmar que genes e pesos são o mesmo mecanismo. Cultura humana futura transmite práticas, sem cópia automática de memória completa.

Seleção decorre de sobrevivência e reprodução custosas no ambiente. Não eliminar automaticamente indivíduos por ranking de recompensa. Mudanças corporais possuem compensações: capacidade maior implica custo correspondente no modelo.

## Recompensa e avaliação

Usar mudanças de necessidades, riscos e custos de ação; evitar recompensa repetida por ficar próximo de comida ou por apenas iniciar uma ação. Reprodução e sucesso populacional são também métricas independentes; recompensa não é sinônimo de aptidão biológica.

Medir sobrevivência, consumo por distância, nascimentos viáveis, diversidade, perdas de energia, causas de morte e distribuição de resultados entre seeds. Avaliação congelada desliga updates e é rotulada separadamente de treino online.

## Humanos futuros

F5 reutiliza percepção e sobrevivência; F6 adiciona relações e aprendizagem social; F7 habilidades práticas e divisão de trabalho; F8–F9 instituições e papéis. Profissões são adquiridas e sustentadas socialmente, não castas genéticas. Nenhuma espécie animal precisa ser convertida automaticamente em humano.

Mudança de vetores, topologia ou significado dos pesos exige versão e migração explícita; incompatibilidade nunca é ignorada.
