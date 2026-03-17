---
title: O Guia Sem Enrolação de IA na IDE — v2
type: company-guidance
date: 2026-03-15
author: Stephen Fishburn
supersedes: rascunho v1 de 2026-14-03
language: pt-BR
translated-from: 2026-15-03-AI-development.md
---

# O Guia Sem Enrolação de IA na IDE — v2

> **v2** — 15 de março de 2026. Adiciona disciplina de branches, evidência de merge, proteções de confidencialidade, fluxo de atualização diária e padrão canônico CLAUDE.md / AGENTS.md. Substitui o rascunho de 14 de março.

IA não torna engenheiros eficazes por padrão.

**Orquestração estruturada, sim.**

Os desenvolvedores que estão se destacando não são os que usam IA casualmente. São os que usam com **disciplina de papéis, contextos limpos, diffs pequenos, revisão adversarial e responsabilidade humana sobre invariantes**.

IA não está substituindo desenvolvedores.
Está substituindo desenvolvedores que só programam.

---

## A Regra de Ouro: Mate o God Prompt

Nunca peça a um único agente de IA para projetar, implementar, revisar e aprovar implicitamente a mesma mudança em uma única conversa.

Esse é o principal modo de falha.

Um agente não deve:

- definir o plano
- escrever o código
- julgar o diff
- certificar a correção

Divida o trabalho.
Force revisão independente.
Mantenha as sessões limpas.

---

## Escolha Agentes pelo Papel, Não por Fidelidade à Marca

Use o melhor modelo para a tarefa em questão.

Divisão prática atual:

- **GPT-5.3-Codex** — agente forte de implementação para tarefas de código, edições, refatorações e trabalho pontual em funcionalidades
- **Opus 4.6** — forte em planejamento, raciocínio, arquitetura, revisão adversarial e QA do trabalho de implementação
- **Claude Code** — forte em implementação com consciência do repositório, debugging e pressão secundária de QA/revisão

Não idolatre uma ferramenta.
Não use um modelo como planejador, implementador e revisor ao mesmo tempo.

O ponto não é a marca.
O ponto é **vantagem comparativa somada à separação de responsabilidades**.

---

## Antes de Escrever Uma Linha de Código

### Repositório novo ou pull grande do origin?

Faça um passe de reconhecimento primeiro.

Peça a um agente de planejamento somente-leitura para produzir ou atualizar:

- `CLAUDE.md` e `AGENTS.md` — contexto do repositório, pontos de entrada, convenções, zonas proibidas (veja a seção **CLAUDE.md e AGENTS.md** abaixo)
- `ARCHITECTURE.md` — topologia, fronteiras, fluxos críticos, superfícies de confiança
- `RUNBOOK.md` — como executar, testar, migrar, popular dados e recuperar localmente

Se novos commits chegaram, peça um resumo das mudanças:

- o que mudou por área funcional
- quais superfícies de risco foram tocadas
- o que foi mudança de comportamento vs. apenas refatoração
- novos TODOs / FIXMEs / migrações / flags introduzidos

Não comece a trabalhar no escuro.

---

## O Fluxo de Trabalho de 3 Papéis

### Papel 1 — Planejador

**Objetivo:** Definir a mudança. Sem código.

Use uma sessão limpa e somente-leitura.

O planejador deve produzir:

- objetivo
- escopo
- arquivos dentro e fora do escopo
- invariantes
- modos de falha
- caminho de rollback
- testes de aceitação

**Saída:** `PLAN.md`

Para trabalhos maiores, adicione `PLAN-CHECKLIST.md` com etapas faseadas.

Para trabalhos de risco médio e alto, envie o plano para um **agente diferente** para que ele faça o red-team antes da implementação.

Peça ao segundo agente para procurar:

- riscos não identificados
- escopo excessivamente amplo
- lacunas no rollback
- acoplamento oculto
- formas de dividir o trabalho em partes menores

Planos são baratos de corrigir.
Código não.

### Papel 2 — Implementador

**Objetivo:** Produzir o menor diff correto.

Abra uma **sessão limpa**.
Dê ao agente o plano e uma instrução restrita:

> Implemente apenas o próximo passo. Siga os padrões existentes do repositório. Não redesenhe. Pare quando terminar.

Regras:

- sem abstrações especulativas
- sem mudanças de arquitetura a menos que o plano explicitamente permita
- sem expansão oculta de escopo
- commits de checkpoint após etapas significativas validadas

O implementador implementa.
Ele não reinterpreta a missão.

### Papel 3 — Revisor Red-Team

**Objetivo:** Tentar quebrar a mudança.

Abra outra **sessão limpa**.
Forneça o diff e instrua o agente:

> Refute esta mudança. Procure bugs de lógica, mentiras de tipos, falhas de segurança, casos extremos, testes ausentes, desvio arquitetural e mudanças ocultas de comportamento.

Este revisor é um crítico, não um aprovador.

Regras:

- achados voltam para o implementador
- a revisão é refeita após correções
- IA nunca concede aprovação final
- humano aprova ou rejeita

---

## Quando o Fluxo Completo É Obrigatório

Use o fluxo completo Planejador → Implementador → Red-Team para:

- autenticação / autorização
- cobrança ou movimentação de dinheiro
- migrações e backfills
- jobs em background e filas
- mudanças de infraestrutura / deploy / CI
- código sensível à segurança
- cache / retries / concorrência
- refatorações transversais
- qualquer coisa difícil de validar localmente

Use uma versão mais leve para:

- correções isoladas de UI
- mudanças de texto
- testes pequenos
- refatorações pontuais com baixo raio de impacto
- utilitários locais com comportamento óbvio

Regra prática:

**Quanto menos reversível a mudança, mais formal o fluxo de trabalho.**

---

## Hábitos Inegociáveis do Desenvolvedor

### Restrições no prompt, não vibes

Declare:

- objetivo
- arquivos no escopo
- padrões a seguir
- movimentos proibidos
- critérios de aceitação
- o que não pode quebrar

### Paralelize leituras, não escritas

Múltiplos agentes escaneando, rastreando, fazendo grep e resumindo: útil.
Múltiplos agentes editando o mesmo caminho de código ao mesmo tempo: caos.

Use branches ou worktrees separados para experimentos de escrita em paralelo.

### Disciplina de branches e fluxo de merge

Use nomenclatura explícita de branches e um caminho de promoção previsível.

- prefixos de branch: `feature/`, `bug/`, `hotfix/`, `chore/`, `docs/`, `refactor/`, `test/`
- fluxo de branch: branch de trabalho -> `dev` -> `main`
- evite pushes diretos para `main` em repositórios colaborativos

Trate `dev` como integração e `main` como release/estável, a menos que a política do repositório diga o contrário.

### Mantenha a verdade do repositório atualizada

Antes de mudanças significativas, atualize sua visão local do origin.

- faça fetch e prune do estado remoto
- verifique a branch atual e o upstream
- verifique a branch padrão no origin para o repositório
- confirme que você está editando o repositório e a branch corretos

Trabalhar com estado local desatualizado é como bons diffs quebram produção.

### Higiene de contexto

Não arraste uma conversa de 50 turnos por planejamento, codificação e revisão.
Use sessões limpas entre os papéis.
Passe artefatos, não resíduo de chat.

### Priorize checkpoints diários significativos

Tenda a fazer pelo menos um checkpoint significativo no git por dia.
Pode ser código, testes, documentação ou um artefato de plano fundamentado.

### Commits de checkpoint durante trabalho com IA

Não espere por um único commit gigante final.
Faça checkpoint após incrementos validados.
Isso preserva pontos de rollback e mantém os diffs revisáveis.

### Log de trabalho de fim de dia

Use um agente para reconciliar o trabalho a partir do `git log`, não da memória.
Gere um log de trabalho datado com:

1. escopo e repositórios incluídos
2. registro de commits
3. resultados entregues

### Autoridade final humana

O humano é dono de:

- arquitetura
- fronteiras de confiança
- autoridade de merge
- responsabilidade sobre produção

Você não pode delegar responsabilidade a um modelo.

---

## Padrão de Evidência de Merge

Todo PR não-trivial deve incluir um bloco de evidências, não apenas a afirmação de que "funciona".

Evidência mínima:

1. verificações executadas (lint, tipos, testes, build)
2. prova de comportamento (screenshots, logs, respostas de API ou passos de reprodução)
3. notas de risco (o que pode falhar, como detectar)
4. nota de rollback (como reverter rapidamente)

Se a evidência estiver faltando, a mudança não está pronta.

---

## Artefatos Operacionais do Repositório

Para repositórios com trabalho recorrente assistido por IA, mantenha estes atualizados:

- `CLAUDE.md` **e** `AGENTS.md` (ambos obrigatórios — veja a seção abaixo)
- `ARCHITECTURE.md`
- `RUNBOOK.md`
- `PLAN.md` para mudanças substanciais
- `PLAN-CHECKLIST.md` para trabalho faseado
- `DAILY-UPDATE-TEMPLATE.md` por membro da equipe (veja `ontic-docs/<nome>/`)
- logs de trabalho datados (`YYYY-DD-MM-work-log.md`) reconciliados a partir do `git log`

Estes não são burocracia.
São superfícies de controle.

---

## CLAUDE.md e AGENTS.md — Orientação Canônica de IA

Todo repositório deve ter dois arquivos de instrução de IA na raiz:

### `CLAUDE.md` — Fonte Canônica da Verdade

`CLAUDE.md` é a **referência autoritativa única** para orientação de IA no nível do projeto. Ele define:

- propósito do projeto, arquitetura e fronteiras principais
- stack tecnológico e dependências críticas
- estrutura de diretórios e responsabilidades dos módulos
- convenções de código e padrões a seguir
- zonas proibidas e padrões vedados
- estratégia de testes e requisitos de verificação
- topologia de deploy e detalhes de ambiente

Este arquivo é o que qualquer agente de IA lê primeiro ao entrar no repositório. Mantenha-o atualizado, preciso e conciso. Se o `CLAUDE.md` estiver errado ou desatualizado, toda sessão de IA começa a partir de uma mentira.

### `AGENTS.md` — Instruções Operacionais de IA

`AGENTS.md` fornece instruções operacionais para agentes de IA trabalhando no repositório. Ele deve:

- referenciar `CLAUDE.md` como a fonte canônica: _"CLAUDE.md é a fonte canônica da verdade para a orientação de IA deste projeto."_
- definir regras rígidas específicas ao comportamento do agente (ex.: "nunca modifique arquivos de migração diretamente")
- especificar etapas de validação e verificação que os agentes devem executar
- listar fronteiras de escopo e áreas fora dos limites
- incluir checklists de deploy e segurança quando aplicável

### Relacionamento

`CLAUDE.md` descreve o **quê** — contexto do projeto, arquitetura, convenções.
`AGENTS.md` descreve o **como** — comportamento do agente, regras, verificação, segurança.

Ambos os arquivos ficam na raiz do repositório. Ambos devem existir em todo repositório em desenvolvimento ativo. Ao atualizar um, verifique se o outro ainda está consistente.

---

## Template de Checklist de PR

Adicione isto ao `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
### Checklist de Fluxo de Trabalho com IA e Segurança

- [ ] **1. Artefato de Planejamento:** Um `PLAN.md` (ou equivalente) existe para trabalho de risco médio/alto e define escopo, invariantes e caminho de rollback. Para trabalhos substanciais, foi revisado por um agente separado antes da implementação.

- [ ] **2. Execução com Escopo Restrito:** Este diff permanece dentro do escopo aprovado. Sem mudanças de arquitetura não autorizadas, abstrações especulativas ou expansão oculta de escopo.

- [ ] **3. Revisão Adversarial por IA:** O diff foi revisado por uma sessão de IA separada e limpa, explicitamente instruída a fazer red-team. Achados substantivos foram tratados antes de abrir o PR.

- [ ] **4. Verificação Mecânica:** Lint, tipos, testes, builds e verificações de runtime relevantes passaram. Sucesso de compilação sozinho não foi tratado como prova de correção.

- [ ] **5. Responsabilidade Humana:** Eu pessoalmente revisei e entendi este diff, verifiquei os invariantes críticos e assumo responsabilidade pelo seu comportamento em produção.
```

---

## Confidencialidade e Higiene de Dados

Agentes de IA processam tudo que você cola ou referencia. Trate toda sessão como semi-pública.

**Nunca envie a um agente de IA:**

- segredos, chaves de API, tokens ou credenciais
- PII de clientes ou dados financeiros
- achados internos de revisão de segurança literalmente
- strings de conexão de banco de dados de produção

**Seguro enviar:**

- código, formatos de configuração (com valores omitidos), descrições de arquitetura
- mensagens de erro, stack traces, saída de testes
- documentação pública e referências open-source

Se você não tem certeza se algo é seguro, omita primeiro.

---

## O Que Desenvolvedores Devem Parar de Fazer

- usar um modelo para design + código + revisão
- aceitar reescritas gigantes geradas por IA
- fazer merge de código que não conseguem explicar
- tratar sucesso de compilação como prova de correção
- permitir que IA invente arquitetura no meio da tarefa
- carregar contexto desatualizado entre fases

---

## O Padrão

IA na IDE não é mais apenas autocomplete.
É **orquestração sob controle**.

O desenvolvedor produtivo é aquele que consegue:

- atribuir o trabalho certo ao agente certo
- manter cada agente dentro do seu papel
- forçar revisão independente
- manter mudanças pequenas e verificáveis
- preservar a integridade do sistema
- tomar a decisão final pessoalmente

---

## Regra em Uma Linha

> Use um agente para planejar, outro para construir, outro para quebrar — e nunca deixe nenhum deles fazer merge.
