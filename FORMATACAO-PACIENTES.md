# Formatação Automática - Cadastro de Pacientes

## Objetivo
Adicionar formatação automática aos campos de telefone, CPF e data de nascimento no formulário de cadastro de pacientes, melhorando a experiência do usuário.

## Alterações Implementadas

### Arquivo: `src/app/(clinic)/clinic/patients/new/page.tsx`

### 1. Funções de Formatação Adicionadas

#### **formatPhone()**
Formata telefone conforme o usuário digita:
- **Entrada**: Apenas números
- **Saída**:
  - 10 dígitos: `(11) 1234-5678`
  - 11 dígitos: `(11) 91234-5678`
- **Limite**: 15 caracteres

```typescript
function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return cleaned
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .slice(0, 15);
}
```

#### **formatCPF()**
Formata CPF conforme o usuário digita:
- **Entrada**: Apenas números
- **Saída**: `123.456.789-00`
- **Limite**: 14 caracteres

```typescript
function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  return cleaned
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
    .slice(0, 14);
}
```

#### **formatDate()**
Formata data de nascimento conforme o usuário digita:
- **Entrada**: Apenas números
- **Saída**: `DD/MM/AAAA`
- **Limite**: 10 caracteres

```typescript
function formatDate(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  return cleaned
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3")
    .slice(0, 10);
}
```

### 2. Campos Atualizados

#### Campo Telefone
```tsx
<Input
  value={formData.telefone}
  onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })}
  placeholder="(00) 00000-0000"
  maxLength={15}
/>
```

#### Campo CPF
```tsx
<Input
  value={formData.cpf}
  onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
  placeholder="000.000.000-00"
  maxLength={14}
/>
```

#### Campo Data de Nascimento
```tsx
<Input
  value={formData.data_nascimento}
  onChange={(e) => setFormData({ ...formData, data_nascimento: formatDate(e.target.value) })}
  placeholder="DD/MM/AAAA"
  maxLength={10}
/>
```

## Comportamento

### Telefone
- Usuário digita: `11912345678`
- Campo mostra: `(11) 91234-5678`
- Aceita tanto fixo (10 dígitos) quanto celular (11 dígitos)

### CPF
- Usuário digita: `12345678900`
- Campo mostra: `123.456.789-00`
- Remove automaticamente caracteres não numéricos

### Data de Nascimento
- Usuário digita: `25121990`
- Campo mostra: `25/12/1990`
- Remove automaticamente caracteres não numéricos

## Validações Mantidas

As formatações são apenas visuais. O formulário continua com as mesmas validações:
- Nome é obrigatório
- Demais campos são opcionais
- Dados são salvos no Firestore com a formatação aplicada

## Benefícios

1. ✅ **UX Melhorada**: Usuário vê formatação em tempo real
2. ✅ **Menos Erros**: Formato visual ajuda a identificar erros de digitação
3. ✅ **Consistência**: Todos os telefones, CPFs e datas seguem o mesmo padrão
4. ✅ **Validação Visual**: Usuário sabe exatamente quantos caracteres faltam
5. ✅ **Compatibilidade**: Aceita colar dados com ou sem formatação

## Arquivos Modificados

- `src/app/(clinic)/clinic/patients/new/page.tsx`

## Data da Implementação

28/11/2025
