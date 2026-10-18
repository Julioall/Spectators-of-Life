# ADR 0003 — Separar simulação e renderização

Status: aceita.

Decisão: estado em core no Web Worker; Phaser e DOM recebem snapshots/deltas e enviam comandos tipados. Objetos visuais são reconstruíveis.

Consequência: mais contratos, mas determinismo, replay, testes e performance tornam-se viáveis.