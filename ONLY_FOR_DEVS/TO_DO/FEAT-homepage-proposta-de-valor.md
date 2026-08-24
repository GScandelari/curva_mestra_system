# Feature: Homepage — Proposta de Valor (curvamestra.com.br)

**Projeto:** Curva Mestra
**Data:** 08/05/2026
**Autor:** Claude (originado em Notas_gerais)
**Status:** Planejamento
**Tipo:** Feature
**Branch sugerida:** `feature/homepage-proposta-de-valor`
**Prioridade:** Alta

> A homepage atual em `/` existe mas não comunica o valor da plataforma de forma estruturada para os dois públicos-alvo: clínicas de HOF e consultores Rennova. Esta feature reformula a landing page com uma narrativa clara de proposta de valor, preparando o terreno para a apresentação à Rennova e para captação dos primeiros usuários piloto.

---

## Contexto

O domínio `curvamestra.com.br` está ativo. A página inicial é a primeira impressão para um potencial cliente ou para a diretoria da Rennova ao avaliar o produto. O conteúdo atual não reflete a identidade estratégica nem os diferenciais competitivos definidos para o MVP.

A homepage precisa comunicar, de forma simples e premium, que o Curva Mestra resolve um problema real das clínicas (gestão de inventário) e cria valor direto para o consultor Rennova (parceria estratégica baseada em dados).

---

## Escopo (Macro)

A página deve ser estruturada nas seguintes seções, nessa ordem:

### 1. Hero (Headline + Subtítulo + CTA)
- **Headline:** focada na dor principal das clínicas de HOF (gestão de estoque e procedimentos).
- **Subtítulo:** reforça a entrega de inteligência estratégica, não apenas controle.
- **CTA primário:** "Quero saber mais" ou "Solicitar demonstração" (leva a um formulário ou contato direto).
- **Estética:** clean, premium, compatível com o universo da harmonização facial.

### 2. Benefícios para a Clínica
- Controle de estoque automatizado ao registrar procedimentos.
- Alertas de reposição antes de faltar produto.
- Visão de lucratividade real por procedimento.
- Relatórios estratégicos de consumo.

### 3. Benefícios para o Consultor Rennova
- Visibilidade do estoque Rennova da clínica em tempo real.
- Sugestão de pedido baseada no consumo histórico.
- Posicionamento como parceiro estratégico, não apenas vendedor.

### 4. Diferenciais / Como funciona (opcional)
- Seção breve mostrando o fluxo: importa NF → estoque atualizado → relatório pronto.
- Pode ser implementada como uma sequência de 3 steps visuais.

### 5. Call to Action final
- Repetir o CTA com variação de copy (ex: "Seja um dos primeiros / Entre na lista de espera").

### Formulário de contato / captação
- Campo de nome, e-mail e mensagem opcional.
- Dados salvos no Firestore ou enviados por e-mail (via Firebase Extension Trigger Email).
- Não requer autenticação.

---

## Critérios de Aceite (Alto Nível)

- [ ] Homepage possui as seções Hero, Benefícios Clínica, Benefícios Consultor e CTA final
- [ ] O copy reflete a identidade do Curva Mestra (HOF, Rennova, gestão inteligente)
- [ ] Formulário de captação funciona e registra o contato (Firestore ou e-mail)
- [ ] A página é responsiva e funciona bem em mobile
- [ ] A estética é clean e premium, alinhada ao universo de harmonização facial
- [ ] Não requer login para acessar
- [ ] A rota `/` continua sendo a homepage pública (sem redirecionamento para `/login`)
