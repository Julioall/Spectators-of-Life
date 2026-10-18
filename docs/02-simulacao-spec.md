# Especificação da simulação

Core é puro e determinístico. Web Worker possui o estado, aplica comandos, avança ticks e emite snapshots/deltas. Phaser não cria, destrói ou decide entidades.

## Ordem de tick

1. Relógio, luz e clima.
2. Água, solo e disponibilidade.
3. Crescimento, decomposição e regeneração.
4. Percepção e necessidades.
5. Escolha de ação e movimento.
6. Alimentação, predação, conflito, cooperação e construção.
7. Dano, doença, envelhecimento e morte.
8. Reprodução, herança e mutação.
9. Eventos, métricas e snapshot.

A ordem é contrato e qualquer mudança exige ADR e testes.

## Estado

Versão; seed; tick; clima e água; mapa; recursos; entidades; populações; grupos; assentamentos; relações; fila de eventos; métricas; configuração de cenário.

## Determinismo e invariantes

IDs não dependem de índices. Cada sistema recebe RNG derivado de seed, tick, sistema e ID. A mesma versão, seed e comandos geram o mesmo checksum e eventos. Valores ficam em faixas válidas; morto não escolhe; ação impossível é mascarada; recursos são debitados uma vez; referências são limpas; IDs são únicos.

## Eventos e save

Evento tem ID, tick, tipo, atores, local, causa, impacto e severidade. Tipos iniciais: nascimento, morte, alimento, migração, conflito, aliança, doença, fundação, construção, colheita, guerra, tratado, sucessão e colapso. Salvar apenas dados de simulação, cérebro, genoma, config, seed, versão e histórico necessário; nunca sprites ou cenas.

Usar deltas, lotes e checkpoints. Entidades fora da câmera podem ser menos renderizadas, nunca menos simuladas.