import {
  renderTemplate,
  extractVariableKeys,
  validateTemplateVariables,
} from '@/lib/emailTemplateRendering';

describe('renderTemplate', () => {
  it('substitui todas as ocorrências de {{chave}} pelo valor correspondente', () => {
    const result = renderTemplate('Olá {{nome}}, seu link é {{link}}.', {
      nome: 'Maria',
      link: 'https://x.com',
    });
    expect(result).toBe('Olá Maria, seu link é https://x.com.');
  });

  it('substitui múltiplas ocorrências da mesma chave', () => {
    const result = renderTemplate('{{nome}} - Olá {{nome}}!', { nome: 'João' });
    expect(result).toBe('João - Olá João!');
  });

  it('mantém a chave literal quando não há valor correspondente', () => {
    const result = renderTemplate('Olá {{nome}}, {{ausente}}.', { nome: 'Ana' });
    expect(result).toBe('Olá Ana, {{ausente}}.');
  });

  it('retorna o texto inalterado quando não há variáveis', () => {
    expect(renderTemplate('Texto sem variáveis.', {})).toBe('Texto sem variáveis.');
  });

  it('aceita espaços dentro das chaves, ex.: {{ nome }}', () => {
    expect(renderTemplate('Olá {{ nome }}!', { nome: 'Léo' })).toBe('Olá Léo!');
  });
});

describe('extractVariableKeys', () => {
  it('lista as chaves usadas, sem duplicados', () => {
    expect(extractVariableKeys('{{a}} e {{b}} e {{a}} de novo')).toEqual(['a', 'b']);
  });

  it('retorna vazio quando não há variáveis', () => {
    expect(extractVariableKeys('texto simples')).toEqual([]);
  });

  it('preserva a ordem de primeira ocorrência', () => {
    expect(extractVariableKeys('{{c}} {{a}} {{b}} {{a}}')).toEqual(['c', 'a', 'b']);
  });
});

describe('validateTemplateVariables', () => {
  it('válido quando todas as chaves usadas são permitidas e todas as obrigatórias aparecem', () => {
    const result = validateTemplateVariables(
      'Assunto {{nome}}',
      'Corpo {{link}}',
      ['nome', 'link'],
      ['link']
    );
    expect(result).toEqual({ valid: true });
  });

  it('inválido quando uma variável fora da lista permitida é usada', () => {
    const result = validateTemplateVariables('Assunto', 'Corpo {{hacker}}', ['nome'], []);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Variável {{hacker}} não é permitida para este template');
  });

  it('inválido quando uma variável obrigatória é removida', () => {
    const result = validateTemplateVariables(
      'Assunto',
      'Corpo sem o link',
      ['nome', 'link'],
      ['link']
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Variável obrigatória {{link}} foi removida');
  });

  it('considera subject e body juntos para checar variáveis usadas e obrigatórias', () => {
    const result = validateTemplateVariables(
      '{{nome}}',
      'sem o link aqui',
      ['nome', 'link'],
      ['nome', 'link']
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Variável obrigatória {{link}} foi removida');
  });
});
