# Testes, mods e roadmap

## Testes

Pirâmide: unitários do core; cenários com seed; integração Worker/save/protocolo; screenshots de canvas; experimentos longos de evolução e performance. Smoke test: abrir, gerar seed, pausar, avançar, acelerar, selecionar, abrir painel, salvar/recarregar e repetir a seed.

IA deve testar NaN, máscara de ação, exploração, serialização, mutação, herança, memória cheia, morte durante update e irmãos. Visual deve testar âncora, escala, biomas, HUD, janela estreita, pausa e reduced-motion. Alvo inicial: 60 FPS no desktop de referência e budget explícito por tick.

## Mods

A primeira API é data-first: espécies, biomas, plantas, recursos, construções, eventos, recompensas e cenários declarativos. Mod contém manifest, schemas, data, assets, localization e previews. IDs são namespaced; validação checa schemas, referências, ciclos, limites e versão; save registra mods, versões e checksums. Código arbitrário fica fora do primeiro escopo.

## Fases

0 Fundação: contratos, Worker, seed, schemas, CI e cenário vazio.
1 Mundo observável: mapa, biomas, água, clima, câmera, pausa e inspeção.
2 Cadeia alimentar: necessidades, percepção, ações, plantas, animais, morte e reprodução.
3 Aprendizado: MLP, update online, memória, mutação, herança e métricas.
4 Sociedades: grupos, trabalho, plantio, construção, reputação, diplomacia e guerra.
5 História: timeline, replay, genealogia, filtros e causalidade.
6 Mods e escala: schemas públicos, loader, exemplos, compatibilidade e otimização.

Cada gate exige documentação, cenário reproduzível, testes, playtest, métricas e riscos registrados.