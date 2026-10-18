# IA, biologia e evolução dos indivíduos

## Escopo por fase

F1–F2: plantas e decomposição por regras biológicas, sem rede por planta ou microrganismo.
F3: indivíduos animais com corpo, metabolismo, percepção e controlador heurístico de referência.
F4: redes individuais aprendendo durante a vida e experimentos de herança.
F5 em diante: humanos estendem o indivíduo biológico; ações culturais e sociais entram gradualmente.

O baseline heurístico mede o aprendizado; não substitui a meta de controladores neurais online.

## Separação dos dados

Genoma: parâmetros herdáveis como metabolismo, tamanho, sentidos, resistência e custo de movimento; cada traço precisa de uma regra explícita de expressão, limites e mutação.
Estado corporal: idade, massa/tamanho estrutural, reservas energéticas, hidratação, condição térmica quando modelada, saúde, desenvolvimento e condição reprodutiva.
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

Cada animal mantém pesos próprios. Atualizações e experiências são limitadas por orçamento determinístico; falhas numéricas geram diagnóstico. Não há pré-treino externo ou inferência remota. O tempo até uma mudança ambiental, a cadência das decisões e o ritmo de atualização da rede são variáveis diferentes e devem ser declarados.

## Herança e aprendizado

Tratar dois eixos independentes:
- Aprendizado em vida: ligado ou desligado no cenário.
- Herança: traços genéticos; ou traços mais transferência experimental de pesos compatíveis.

Condição padrão: a reprodução transmite os traços herdáveis segundo o modelo da espécie; experiências, memória episódica e pesos aprendidos não são copiados. O controlador do descendente segue uma regra de inicialização registrada.

Separar duas hipóteses: (1) aprendizagem durante a vida pode alterar o comportamento e, por consequência, quais traços herdáveis são favorecidos pela reprodução, mesmo sem copiar pesos; (2) a transferência direta de parte dos pesos parentais é um experimento de transferência de controlador, configurável e comparado ao padrão. A segunda condição não é herança genética nem, por si só, demonstra o efeito Baldwin. Registrar a origem de cada peso herdado. Cultura humana futura transmite práticas por mecanismos sociais próprios, sem cópia automática da memória completa.

Seleção decorre de sobrevivência e reprodução custosas no ambiente. Não eliminar automaticamente indivíduos por ranking de recompensa. Mudanças corporais possuem compensações: capacidade maior implica custo correspondente no modelo.

## Comparação experimental de F4

Comparar controlador heurístico, rede congelada sem atualização, rede com aprendizagem online sem transferência de pesos e rede com transferência direta de pesos. Usar os mesmos cenários, perfis e populações iniciais em seeds pareadas, mantendo explícitas as diferenças de RNG entre condições.

Incluir disponibilidade estável e cíclica de recursos. Medir o tempo de adaptação do controlador e testar ciclos ambientais mais lentos e mais rápidos que essa janela; não presumir que aprendizagem sempre melhora sobrevivência ou que uma velocidade de ciclo produz um resultado universal. Congelar a rede na avaliação e reportar separadamente comportamento aprendido, aptidão reprodutiva, traços herdáveis, diversidade, condição corporal, causas de morte e extinção. O protocolo completo está em [08-pesquisa-e-validacao.md](08-pesquisa-e-validacao.md).

## Recompensa e avaliação

Usar mudanças de necessidades, riscos e custos de ação; evitar recompensa repetida por ficar próximo de comida ou por apenas iniciar uma ação. Reprodução e sucesso populacional são também métricas independentes; recompensa não é sinônimo de aptidão biológica.

Medir sobrevivência, consumo por distância, nascimentos viáveis, diversidade, perdas de energia, causas de morte e distribuição de resultados entre seeds. Avaliação congelada desliga updates e é rotulada separadamente de treino online.

## Humanos futuros

F5 reutiliza percepção e sobrevivência; F6 adiciona relações e aprendizagem social; F7 habilidades práticas e divisão de trabalho; F8–F9 instituições e papéis. Profissões são adquiridas e sustentadas socialmente, não castas genéticas. Nenhuma espécie animal precisa ser convertida automaticamente em humano.

Mudança de vetores, topologia ou significado dos pesos exige versão e migração explícita; incompatibilidade nunca é ignorada.
