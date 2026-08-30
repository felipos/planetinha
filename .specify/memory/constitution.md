<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Rationale: Initial ratification — first concrete constitution for this project (MINOR/MAJOR
not applicable; treated as initial adoption per governance policy).

Modified principles: N/A (initial adoption, no prior ratified version)

Added sections:
  - Core Principles I–V
    I.   TypeScript Estrito (Type Safety First)
    II.  Chaves Obrigatórias em Estruturas de Controle (Anti-Goto Fail)
    III. Arquitetura em Camadas (Clean Architecture)
    IV.  Mobile-First
    V.   Acessibilidade Não-Negociável (a11y)
  - Restrições Técnicas Adicionais
  - Fluxo de Desenvolvimento e Guia de Decisões de Front-end
  - Governance

Removed sections: none

Deferred / TODO placeholders: none — all template tokens resolved.

Templates requiring follow-up review (not modified by this command; read constitution at
runtime, so no edits made here):
  - .specify/templates/plan-template.md — verify its Constitution Check section reflects
    Principles I–V (typing, braces/lint gate, layering, mobile-first, a11y).
  - .specify/templates/spec-template.md — no direct constitution reference expected; check
    if acceptance criteria should call out a11y/mobile-first for UI features.
  - .specify/templates/tasks-template.md — verify task categorization can accommodate
    Domain/Use Cases/Data Sources/Presentation layering from Principle III.
-->

# Vento Constitution

## Core Principles

### I. TypeScript Estrito (Type Safety First)

Todo o código MUST ser escrito em TypeScript com `"strict": true` habilitado no `tsconfig.json`
(incluindo `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`). O uso de `any` é
PROIBIDO exceto com justificativa explícita em comentário no próprio código; nesses casos,
`unknown` combinado com narrowing MUST ser preferido. Tipos de domínio (entidades, value
objects, DTOs) e assinaturas de funções exportadas em fronteiras entre camadas MUST ser
explicitamente tipados, não apenas inferidos.

Rationale: tipagem forte é a principal ferramenta de qualidade disponível antes de o projeto
ter cobertura extensa de testes; erros pegos em tempo de compilação não chegam a produção.

### II. Chaves Obrigatórias em Estruturas de Controle (Anti-Goto Fail)

Todo `if`, `else`, `for`, `while` e `do-while` MUST usar chaves `{}` explícitas, mesmo quando o
corpo é uma única instrução. Blocos de controle sem chaves são PROIBIDOS. Essa regra MUST ser
reforçada automaticamente por lint (ESLint `curly: ["error", "all"]`) configurado para quebrar o
build/CI quando violada — a conformidade não pode depender apenas de revisão manual.

Rationale: bugs históricos como o "goto fail" da Apple (2014) nasceram de um `if` sem chaves,
onde uma linha extra escapava silenciosamente do escopo condicional. Chaves obrigatórias
eliminam essa classe inteira de erro por construção.

### III. Arquitetura em Camadas (Clean Architecture)

O código MUST ser organizado nas seguintes camadas, com dependências apontando sempre para
dentro (regra da dependência):

- **Domain**: entidades e regras de negócio puras; MUST NOT depender de framework, UI ou
  infraestrutura.
- **Use Cases (Application)**: orquestram as regras de negócio; dependem apenas de Domain e de
  interfaces (ports) definidas pela própria camada de aplicação/domínio.
- **Data Sources (Infrastructure)**: implementações concretas de acesso a dados, APIs externas
  e storage; implementam as interfaces (ports) definidas pela camada de Use Cases.
- **Presentation**: componentes de UI, view models/hooks e roteamento; depende de Use Cases
  apenas através de interfaces, nunca o contrário.

Camadas internas (Domain, Use Cases) MUST NOT importar código de camadas externas (Data
Sources, Presentation). Nas fronteiras entre camadas, inversão de dependência MUST ser usada:
a interface é definida pela camada interna e implementada pela externa.

Rationale: isolar regras de negócio de detalhes de UI e infraestrutura mantém o sistema
testável e permite trocar framework de UI, biblioteca de dados ou fonte de dados sem reescrever
a lógica de negócio.

### IV. Mobile-First

Toda interface MUST ser desenhada e implementada primeiro para a menor viewport-alvo (telas de
smartphone, aproximadamente 360–390px de largura), expandindo progressivamente para telas
maiores via media queries `min-width` — nunca `max-width` como base do layout. Toda mudança de
UI MUST ser verificada visualmente em viewport mobile antes de ser considerada concluída.

Como o responsável pelo produto não tem background em front-end, decisões de design com impacto
visível (breakpoints, hierarquia visual, padrões de interação, escolha de componente) MUST ser
apresentadas com uma recomendação objetiva e, quando relevante, as principais alternativas
consideradas e por que foram descartadas — nunca decididas e aplicadas silenciosamente sem essa
explicação.

Rationale: a maioria dos usuários finais tende a acessar via dispositivos móveis; desenhar
mobile-first evita o retrabalho de "encolher" um layout pensado para desktop e força a
priorização do conteúdo essencial desde o início.

### V. Acessibilidade Não-Negociável (a11y)

Toda interface de usuário MUST atender, no mínimo, às diretrizes WCAG 2.1 nível AA. Isso inclui,
sem se limitar a: uso de HTML semântico antes de `div`/`span` genéricos; todo elemento
interativo MUST ser operável via teclado (foco visível, ordem de tab lógica); toda imagem ou
ícone informativo MUST ter texto alternativo; contraste de cor MUST atender proporção mínima de
4.5:1 para texto normal; todo campo de formulário MUST ter label associado. Ferramentas
automatizadas de checagem (ex.: `eslint-plugin-jsx-a11y` ou equivalente, e axe) MUST fazer parte
do fluxo de revisão, com o entendimento de que checagem automatizada é necessária mas não
suficiente — revisão humana/manual continua obrigatória para os aspectos que a automação não
cobre.

Rationale: acessibilidade corrigida depois é significativamente mais cara que construída desde
o início; e, como o responsável pelo produto não é desenvolvedor front-end, esta regra existe
para que agentes e colaboradores garantam esse padrão de forma consistente, sem depender de o
dono do produto saber cobrá-lo.

## Restrições Técnicas Adicionais

- **Stack**: TypeScript + Vite. Qualquer biblioteca de UI (React, Vue, Svelte, etc.) escolhida
  MUST viver majoritariamente na camada de Presentation, isolada do restante da arquitetura.
- **Build & Lint**: ESLint MUST incluir, no mínimo, a regra `curly: ["error", "all"]`
  (Princípio II) e regras de acessibilidade (Princípio V) configuradas como bloqueantes no
  CI/build. `tsconfig.json` MUST manter `"strict": true` (Princípio I).
- **Fronteiras de arquitetura**: à medida que o projeto crescer, ferramentas de lint de
  arquitetura (ex.: `eslint-plugin-boundaries` ou `dependency-cruiser`) SHOULD ser adotadas para
  reforçar automaticamente a regra da dependência do Princípio III.

## Fluxo de Desenvolvimento e Guia de Decisões de Front-end

- Como o dono do produto não é desenvolvedor front-end, qualquer decisão de UI/UX com impacto
  visível (layout, componente novo, padrão de interação, biblioteca de componentes) MUST vir
  acompanhada de uma recomendação objetiva com a razão da escolha e, quando relevante, as
  alternativas descartadas — nunca implementada silenciosamente sem essa explicação.
- Toda revisão de código MUST verificar aderência aos cinco princípios (tipagem estrita, chaves
  obrigatórias, respeito às camadas, mobile-first e acessibilidade) antes de aprovar o merge.
- Qualquer violação da arquitetura em camadas (ex.: import direto de Data Source dentro de
  Domain) MUST ser justificada explicitamente na descrição do PR ou corrigida antes do merge.

## Governance

Esta constituição prevalece sobre qualquer outra prática, convenção de equipe ou preferência
individual em conflito. Toda mudança de arquitetura, escolha de stack ou padrão de qualidade que
contradiga um princípio aqui definido MUST passar por uma emenda formal a este documento antes
de ser adotada.

**Processo de emenda**: alterações são propostas via PR neste arquivo, descrevendo motivação e
impacto; a versão MUST ser incrementada conforme a política de versionamento semântico abaixo
antes do merge.

**Versionamento semântico**:
- MAJOR: remoção ou redefinição incompatível de um princípio existente.
- MINOR: adição de novo princípio ou expansão material de um princípio existente.
- PATCH: esclarecimentos, correções de texto ou ajustes não semânticos.

**Conformidade**: toda revisão de código (humana ou por agente) MUST verificar conformidade com
os princípios listados acima. Complexidade adicional (nova camada, nova dependência, exceção a
uma regra) MUST ser justificada por escrito no PR correspondente.

**Version**: 1.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
