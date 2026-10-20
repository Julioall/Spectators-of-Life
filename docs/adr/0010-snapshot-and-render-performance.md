# ADR 0010 — Usar a fronteira do Worker como cópia do snapshot

Status: aceita.

Contexto: no cenário natural, o snapshot atravessa um Web Worker por `postMessage`, que já faz uma cópia estruturada para a thread do cliente. Cloná-lo dentro de `WorkerEngine` antes desse envio criava uma cópia integral redundante. A checagem de tamanho também serializava o mesmo snapshot no método e novamente no limitador de respostas.

Decisão: a instância de produção do Worker usa `snapshotOwnership: 'post-message'`; a instância autônoma mantém o padrão `caller`, que entrega snapshot independente. No modo do Worker, a resposta reutiliza o estado imutável até `postMessage` fazer a cópia para o cliente. O cliente só solicita snapshots quando o lote cruza um tick da agenda de sistemas; entre esses limites, avança o contador de ticks sem transferir o estado inteiro. Esse atalho depende do limite de estado de 8 MiB, validado na criação, em cada commit e ao restaurar um save, e da folga de mais de 1 MiB até o limite de resposta de 9 MiB. Se esses limites ou o envelope da resposta mudarem, revalidar a margem antes de alterar o atalho.

Na fronteira transacional de `stepWorld`, o estado de entrada é validado uma vez e sua cópia profunda usa `structuredClone`, seguida da normalização de `-0` exigida pelo JSON canônico. Isso evita criar uma string canônica completa e analisá-la de volta em cada atualização diária; a validação e a medição canônica do estado resultante continuam obrigatórias.

As camadas dinâmicas do mapa são redesenhadas quando muda a identidade do mundo ou o dia simulado, e também em criação/recarga forçada. Avanços de tick entre atualizações diárias só atualizam o estado observado e a interface textual. O painel separa duração lógica medida no Worker, ida e volta do snapshot, render Phaser e P50/P95 móveis das últimas 120 amostras. O benchmark headless usa a seed fixa do vale natural e mede simulação e cópia estruturada separadamente; o render é medido no navegador.

Consequências: remove-se a cópia integral redundante dentro do Worker e também se evitam snapshots em ticks sem alterações de sistemas. O mapa deixa de reconstruir Graphics a cada tick. Chamadores autônomos continuam protegidos contra mutação do estado interno. A cópia exigida na comunicação entre Worker e cliente permanece nos limites de atualização ambiental. O benchmark de render requer navegador ativo e não deve ser inferido a partir dos tempos do Node.

Validação: testes confirmam isolamento do modo autônomo, cópia no limite de `structuredClone`, validade do snapshot entregue, semântica canônica de `-0`, imutabilidade do estado inicial, política determinística de snapshot por agenda, revisão visual diária e cálculo determinístico de P50/P95. `npm run benchmark:natural` documenta separadamente tempos de simulação, preparação de snapshot e cópia simulada da fronteira.
