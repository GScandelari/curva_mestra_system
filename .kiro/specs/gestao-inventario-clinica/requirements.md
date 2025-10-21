# Documento de Requisitos - Sistema de Gestão de Inventário para Clínicas de Harmonização

## Introdução

Este documento especifica os requisitos para um sistema de gestão de inventário dedicado a clínicas de harmonização. O sistema tem como objetivo principal controlar o estoque de produtos, gerenciar datas de validade, processar solicitações de materiais e manter registros de pacientes, garantindo eficiência operacional e rastreabilidade completa das movimentações.

## Glossário

- **Sistema_Inventario**: O sistema de software para gestão de inventário em clínicas de harmonização
- **Produto**: Qualquer item médico, cosmético ou material utilizado nos procedimentos da clínica
- **Solicitante**: Profissional autorizado (médico, dentista, etc.) que pode requisitar produtos do inventário
- **Nota_Fiscal**: Documento fiscal obrigatório que comprova a aquisição de produtos
- **Estoque_Minimo**: Quantidade mínima definida para cada produto que, quando atingida, requer reposição
- **Data_Validade**: Data limite para utilização segura de um produto
- **Movimentacao**: Qualquer entrada ou saída de produto do inventário
- **Paciente**: Pessoa que recebe atendimento na clínica e pode ter produtos associados ao seu tratamento

## Requisitos

### Requisito 1

**História do Usuário:** Como administrador da clínica, quero registrar produtos no inventário vinculados a notas fiscais, para que eu possa rastrear a origem e entrada de todos os itens no estoque.

#### Critérios de Aceitação

1. QUANDO um produto for adicionado ao inventário, O Sistema_Inventario DEVERÁ exigir o número da Nota_Fiscal correspondente
2. O Sistema_Inventario DEVERÁ armazenar a data de entrada do produto no momento do registro
3. O Sistema_Inventario DEVERÁ validar que o número da Nota_Fiscal seja único para cada entrada
4. O Sistema_Inventario DEVERÁ registrar automaticamente o usuário responsável pela entrada do produto
5. O Sistema_Inventario DEVERÁ permitir consulta do histórico de entradas por Nota_Fiscal

### Requisito 2

**História do Usuário:** Como profissional da clínica, quero controlar as datas de validade dos produtos, para que eu possa evitar o uso de itens vencidos e reduzir desperdícios.

#### Critérios de Aceitação

1. O Sistema_Inventario DEVERÁ armazenar a Data_Validade para cada produto registrado
2. QUANDO a Data_Validade de um produto estiver a 30 dias do vencimento, O Sistema_Inventario DEVERÁ gerar alerta automático
3. QUANDO a Data_Validade de um produto for ultrapassada, O Sistema_Inventario DEVERÁ marcar o item como vencido
4. O Sistema_Inventario DEVERÁ impedir a utilização de produtos com Data_Validade ultrapassada
5. O Sistema_Inventario DEVERÁ gerar relatório mensal de produtos próximos ao vencimento

### Requisito 3

**História do Usuário:** Como gestor da clínica, quero monitorar as quantidades em estoque, para que eu possa garantir disponibilidade adequada de produtos e evitar rupturas.

#### Critérios de Aceitação

1. O Sistema_Inventario DEVERÁ atualizar automaticamente as quantidades após cada Movimentacao
2. QUANDO a quantidade de um produto atingir o Estoque_Minimo, O Sistema_Inventario DEVERÁ gerar alerta de reposição
3. O Sistema_Inventario DEVERÁ permitir definir Estoque_Minimo específico para cada produto
4. O Sistema_Inventario DEVERÁ exibir quantidade atual disponível em tempo real
5. O Sistema_Inventario DEVERÁ manter histórico de todas as Movimentacoes de estoque

### Requisito 4

**História do Usuário:** Como profissional autorizado, quero solicitar produtos do inventário, para que eu possa obter os materiais necessários para os procedimentos.

#### Critérios de Aceitação

1. QUANDO um Solicitante fizer uma requisição, O Sistema_Inventario DEVERÁ registrar a solicitação com data e hora
2. O Sistema_Inventario DEVERÁ associar cada solicitação ao Solicitante responsável
3. O Sistema_Inventario DEVERÁ exigir aprovação antes de liberar produtos do estoque
4. QUANDO uma solicitação for aprovada, O Sistema_Inventario DEVERÁ deduzir automaticamente a quantidade do estoque
5. O Sistema_Inventario DEVERÁ permitir rastreamento do status de cada solicitação

### Requisito 5

**História do Usuário:** Como recepcionista, quero gerenciar o cadastro de pacientes, para que eu possa associar o consumo de produtos aos tratamentos realizados.

#### Critérios de Aceitação

1. O Sistema_Inventario DEVERÁ permitir cadastro completo de dados do Paciente
2. O Sistema_Inventario DEVERÁ associar Movimentacoes de produtos a Pacientes específicos
3. QUANDO produtos forem utilizados em um procedimento, O Sistema_Inventario DEVERÁ registrar a associação com o Paciente
4. O Sistema_Inventario DEVERÁ gerar relatório de consumo por Paciente
5. O Sistema_Inventario DEVERÁ manter histórico de produtos utilizados por Paciente

### Requisito 6

**História do Usuário:** Como auditor, quero consultar o histórico de notas fiscais, para que eu possa verificar a origem e rastreabilidade de todos os produtos.

#### Critérios de Aceitação

1. O Sistema_Inventario DEVERÁ manter registro completo de todas as Notas_Fiscais recebidas
2. O Sistema_Inventario DEVERÁ permitir busca de produtos por número da Nota_Fiscal
3. O Sistema_Inventario DEVERÁ exibir data de recebimento e valor total de cada Nota_Fiscal
4. O Sistema_Inventario DEVERÁ listar todos os produtos associados a uma Nota_Fiscal específica
5. O Sistema_Inventario DEVERÁ gerar relatório consolidado de compras por período

### Requisito 7

**História do Usuário:** Como administrador do sistema, quero controlar o acesso às funcionalidades, para que apenas usuários autorizados possam realizar operações específicas.

#### Critérios de Aceitação

1. O Sistema_Inventario DEVERÁ autenticar usuários antes de permitir acesso ao sistema
2. O Sistema_Inventario DEVERÁ definir níveis de permissão diferenciados por tipo de usuário
3. QUANDO um usuário tentar acessar funcionalidade não autorizada, O Sistema_Inventario DEVERÁ negar o acesso
4. O Sistema_Inventario DEVERÁ registrar todas as ações realizadas por cada usuário
5. O Sistema_Inventario DEVERÁ permitir que administradores gerenciem permissões de outros usuários