import { NextRequest, NextResponse } from 'next/server';

// Forçar uso do Node.js runtime (não Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExtractedProduct {
  code: string;
  name: string;
  lote?: string;
  quantidade?: number;
  dt_validade?: string;
  valor_unitario?: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Iniciando processamento de PDFs...');

    // Importar pdf-parse - debugging completo
    let pdfParse: any;
    const pdfParseModule = require('pdf-parse');

    console.log('📦 Tipo do módulo:', typeof pdfParseModule);
    console.log('📦 Keys do módulo:', Object.keys(pdfParseModule));
    console.log('📦 Tem default?', 'default' in pdfParseModule);
    console.log('📦 Tipo do default:', typeof pdfParseModule.default);

    // Tentar acessar de várias formas
    if (typeof pdfParseModule === 'function') {
      pdfParse = pdfParseModule;
      console.log('✅ Módulo é a função');
    } else if (typeof pdfParseModule.default === 'function') {
      pdfParse = pdfParseModule.default;
      console.log('✅ default é a função');
    } else if (pdfParseModule.constructor && typeof pdfParseModule.constructor === 'function') {
      pdfParse = pdfParseModule.constructor;
      console.log('✅ constructor é a função');
    } else {
      // Tentar pegar a primeira key que seja função
      for (const key of Object.keys(pdfParseModule)) {
        if (typeof pdfParseModule[key] === 'function') {
          pdfParse = pdfParseModule[key];
          console.log(`✅ Encontrada função em: ${key}`);
          break;
        }
      }
    }

    console.log('📦 pdfParse final - tipo:', typeof pdfParse);
    console.log('📦 pdfParse final - é função?', typeof pdfParse === 'function');

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    console.log('📂 Número de arquivos recebidos:', files.length);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const allProducts: ExtractedProduct[] = [];

    // Processar cada arquivo PDF
    for (const file of files) {
      console.log(`\n📝 Processando arquivo: ${file.name}`);
      console.log(`   Tamanho: ${file.size} bytes`);
      console.log(`   Tipo: ${file.type}`);

      const buffer = Buffer.from(await file.arrayBuffer());
      console.log(`   Buffer criado: ${buffer.length} bytes`);

      try {
        console.log('   🔄 Chamando pdf-parse...');

        const data = await pdfParse(buffer);
        console.log('   📦 Dados retornados:', typeof data);
        console.log('   📦 data.text existe?', 'text' in data);

        const text = data.text;
        console.log('   📦 Tipo do texto:', typeof text);

        console.log(`   ✅ PDF extraído com sucesso!`);
        console.log(`   📏 Texto total: ${text.length} caracteres`);
        console.log(`   📄 Número de páginas: ${data.numpages || 'N/A'}`);
        console.log(`   🔍 Primeiros 500 caracteres:`);
        console.log(text.substring(0, 500));
        console.log(`   🔍 Últimos 300 caracteres:`);
        console.log(text.substring(Math.max(0, text.length - 300)));

        // Extrair produtos do texto
        const products = extractProductsFromText(text);
        console.log(`   🎯 Produtos extraídos: ${products.length}`);
        products.forEach((p, idx) => {
          console.log(`      ${idx + 1}. ${p.code} - ${p.name.substring(0, 50)}...`);
        });

        allProducts.push(...products);
      } catch (error) {
        console.error(`   ❌ Erro ao processar ${file.name}:`, error);
        console.error('   Stack:', error instanceof Error ? error.stack : 'N/A');
      }
    }

    // Remover duplicados baseado no código
    const uniqueProducts = Array.from(new Map(allProducts.map((p) => [p.code, p])).values());

    console.log(`\n✨ Total de produtos únicos: ${uniqueProducts.length}`);
    console.log('📤 Enviando resposta...\n');

    return NextResponse.json({ products: uniqueProducts });
  } catch (error) {
    console.error('❌ Erro geral ao processar PDFs:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json({ error: 'Erro ao processar arquivos PDF' }, { status: 500 });
  }
}

function extractProductsFromText(text: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  // Dividir o texto em linhas
  const lines = text.split('\n');
  console.log(`\n   🔧 extractProductsFromText - Total de linhas: ${lines.length}`);

  // Regex conforme especificação Rennova no CLAUDE.md
  const codeRegex = /^(\d{7,8})\s+(.+)/; // Código do produto no início da linha
  const lotRegex = /Lt:\s*([A-Z0-9\-]+)/; // Lote
  const qtdRegex = /Q:\s*([\d,]+)/; // Quantidade
  const valRegex = /Dt\.\s*Val\.:\s*(\d{2}\/\d{2}\/\d{4})/; // Data de validade
  const valorRegex = /R\$\s*([\d,.]+)/; // Valor unitário

  let matchCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(codeRegex);

    if (match) {
      matchCount++;
      console.log(`\n   ✓ Match ${matchCount} na linha ${i + 1}: ${line.substring(0, 80)}...`);

      const code = match[1];
      let name = match[2];
      console.log(`      Código: ${code}`);

      // Extrair lote, quantidade e validade da linha ou próximas linhas
      let lote: string | undefined;
      let quantidade: number | undefined;
      let dt_validade: string | undefined;
      let valor_unitario: number | undefined;

      // Variável para acumular o contexto (linha atual + próximas)
      let context = line;
      let j = i + 1;

      // Coletar mais linhas para buscar lote, quantidade e validade
      while (j < lines.length && j < i + 10) {
        // Buscar nas próximas 10 linhas
        const nextLine = lines[j].trim();

        // Parar se encontrar outro código de produto
        if (/^\d{7,8}\s/.test(nextLine)) {
          break;
        }

        context += ' ' + nextLine;
        j++;
      }

      // Extrair lote
      const lotMatch = context.match(lotRegex);
      if (lotMatch) {
        lote = lotMatch[1];
        console.log(`      Lote: ${lote}`);
      }

      // Extrair quantidade
      const qtdMatch = context.match(qtdRegex);
      if (qtdMatch) {
        const qtdStr = qtdMatch[1].replace(',', '.');
        quantidade = parseFloat(qtdStr);
        console.log(`      Quantidade: ${quantidade}`);
      }

      // Extrair data de validade
      const valMatch = context.match(valRegex);
      if (valMatch) {
        dt_validade = valMatch[1];
        console.log(`      Validade: ${dt_validade}`);
      }

      // Extrair valor unitário
      const valorMatch = context.match(valorRegex);
      if (valorMatch) {
        const valorStr = valorMatch[1].replace('.', '').replace(',', '.');
        valor_unitario = parseFloat(valorStr);
        console.log(`      Valor: R$ ${valor_unitario}`);
      }

      // Limpar o nome do produto
      let fullName = name;

      // Remover marcadores e dados após o nome
      fullName = fullName
        .replace(/Lt:.*$/, '')
        .replace(/Q:.*$/, '')
        .replace(/Dt\.\s*Val\..*$/, '')
        .replace(/R\$.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Se o nome está muito curto, pode estar quebrado em várias linhas
      // Vamos coletar as linhas até encontrar os marcadores
      if (fullName.length < 20 && !context.includes('Lt:')) {
        let k = i + 1;
        while (k < lines.length && k < i + 5) {
          const nextLine = lines[k].trim();

          // Parar se encontrar marcadores
          if (nextLine.includes('Lt:') || nextLine.includes('Q:') || nextLine.includes('Dt. Val')) {
            break;
          }

          // Parar se encontrar outro código
          if (/^\d{7,8}\s/.test(nextLine)) {
            break;
          }

          if (nextLine && !nextLine.match(/^[A-Z]{2}\s*\d/)) {
            // Ignora linhas que parecem ser dados
            fullName += ' ' + nextLine;
          }
          k++;
        }

        // Limpar novamente
        fullName = fullName
          .replace(/Lt:.*$/, '')
          .replace(/Q:.*$/, '')
          .replace(/Dt\.\s*Val\..*$/, '')
          .replace(/R\$.*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (code && fullName) {
        console.log(`      ✓ Produto completo: ${code} - ${fullName.substring(0, 50)}...`);
        products.push({
          code,
          name: fullName.toUpperCase(),
          lote,
          quantidade,
          dt_validade,
          valor_unitario,
        });
      } else {
        console.log(`      ✗ Produto ignorado (código ou nome vazio)`);
      }
    }
  }

  console.log(`\n   📊 Resumo da extração:`);
  console.log(`      Total de matches: ${matchCount}`);
  console.log(`      Produtos extraídos: ${products.length}`);

  if (matchCount === 0) {
    console.log(`\n   ⚠️ AVISO: Nenhum match encontrado!`);
    console.log(`   📝 Amostra de linhas do texto para debug:`);
    lines.slice(0, 50).forEach((line, idx) => {
      if (line.trim()) {
        console.log(`      Linha ${idx + 1}: ${line.substring(0, 100)}`);
      }
    });
  }

  return products;
}
