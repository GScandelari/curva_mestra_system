import { NextRequest, NextResponse } from "next/server";

// Forçar uso do Node.js runtime (não Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExtractedProduct {
  code: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    // Importar pdf-parse dinamicamente usando require
    const pdfParse = require('pdf-parse');

    console.log('📄 Iniciando processamento de PDFs...');
    console.log('📦 Tipo do pdf-parse:', typeof pdfParse);
    console.log('📦 pdfParse.default existe?', typeof pdfParse.default);

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    console.log('📂 Número de arquivos recebidos:', files.length);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
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
        console.log('   📦 typeof pdfParse:', typeof pdfParse);
        console.log('   📦 pdfParse é função?', typeof pdfParse === 'function');

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
    const uniqueProducts = Array.from(
      new Map(allProducts.map((p) => [p.code, p])).values()
    );

    console.log(`\n✨ Total de produtos únicos: ${uniqueProducts.length}`);
    console.log('📤 Enviando resposta...\n');

    return NextResponse.json({ products: uniqueProducts });
  } catch (error) {
    console.error("❌ Erro geral ao processar PDFs:", error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { error: "Erro ao processar arquivos PDF" },
      { status: 500 }
    );
  }
}

function extractProductsFromText(text: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  // Dividir o texto em linhas
  const lines = text.split("\n");
  console.log(`\n   🔧 extractProductsFromText - Total de linhas: ${lines.length}`);

  // Regex para identificar código do produto (7-8 dígitos no início da linha)
  const codeRegex = /^(\d{7,8})\s+(.+)/;
  console.log(`   🔧 Regex pattern: ${codeRegex}`);

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
      console.log(`      Nome inicial: ${name.substring(0, 50)}...`);

      // O nome do produto pode continuar nas próximas linhas até encontrar "Lt:" ou "Q:"
      // Vamos coletar até encontrar esses marcadores
      let j = i;
      let fullName = name;

      // Limpar o nome - remover tudo após "Lt:" ou "Q:" se existir na mesma linha
      if (fullName.includes("Lt:") || fullName.includes("Q:")) {
        // Pegar apenas até o marcador
        const ltIndex = fullName.indexOf("Lt:");
        const qIndex = fullName.indexOf("Q:");

        let endIndex = fullName.length;
        if (ltIndex !== -1) endIndex = Math.min(endIndex, ltIndex);
        if (qIndex !== -1) endIndex = Math.min(endIndex, qIndex);

        fullName = fullName.substring(0, endIndex).trim();
      } else {
        // Se não tem marcador na mesma linha, verificar próximas linhas
        j++;
        while (j < lines.length) {
          const nextLine = lines[j].trim();

          // Parar se encontrar marcadores de lote/quantidade
          if (nextLine.includes("Lt:") || nextLine.includes("Q:") || nextLine.includes("Dt. Val")) {
            break;
          }

          // Parar se encontrar outro código de produto
          if (/^\d{7,8}\s/.test(nextLine)) {
            break;
          }

          // Parar se a linha estiver vazia
          if (!nextLine) {
            break;
          }

          // Adicionar a linha ao nome do produto
          fullName += " " + nextLine;
          j++;
        }
      }

      // Limpar o nome final
      fullName = fullName
        .replace(/\s+/g, " ") // Normalizar espaços
        .replace(/Lt:.*$/, "") // Remover tudo após Lt: se ainda existir
        .replace(/Q:.*$/, "") // Remover tudo após Q: se ainda existir
        .replace(/Dt\.\s*Val\..*$/, "") // Remover data de validade se existir
        .trim();

      if (code && fullName) {
        console.log(`      ✓ Produto adicionado: ${code} - ${fullName.substring(0, 50)}...`);
        products.push({
          code,
          name: fullName.toUpperCase(),
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
