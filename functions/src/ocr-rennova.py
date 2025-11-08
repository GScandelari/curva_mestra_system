#!/usr/bin/env python3
"""
Parser DANFE Rennova - RegEx Oficial v4.0
NUNCA altere as RegEx sem testar com a NF-e 026229
"""

import re
import sys
import json
from typing import List, Dict, Optional
import argparse

# RegEx Oficial v4.0 - NUNCA altere sem teste
LOT_REGEX = r"Lt:\s*([A-Z0-9\-]+)"
QTD_REGEX = r"Q:\s*([\d,]+)"
VAL_REGEX = r"Dt\. Val\.:\s*(\d{2}/\d{2}/\d{4})"
COD_REGEX = r"^(\d{7,8})\s"
VALOR_UNIT_REGEX = r"R\$\s*([\d,.]+)"

class ProdutoRennova:
    """Representa um produto extraído do DANFE Rennova"""
    def __init__(
        self,
        codigo: str,
        nome_produto: str,
        lote: str,
        quantidade: float,
        dt_validade: str,
        valor_unitario: float
    ):
        self.codigo = codigo
        self.nome_produto = nome_produto
        self.lote = lote
        self.quantidade = quantidade
        self.dt_validade = dt_validade
        self.valor_unitario = valor_unitario

    def to_dict(self) -> Dict:
        return {
            "codigo": self.codigo,
            "nome_produto": self.nome_produto,
            "lote": self.lote,
            "quantidade": self.quantidade,
            "dt_validade": self.dt_validade,
            "valor_unitario": self.valor_unitario
        }

class NFRennova:
    """Representa uma NF-e Rennova completa"""
    def __init__(self, numero: str, produtos: List[ProdutoRennova]):
        self.numero = numero
        self.produtos = produtos

    def to_dict(self) -> Dict:
        return {
            "numero": self.numero,
            "produtos": [p.to_dict() for p in self.produtos]
        }

def extract_numero_nf(text: str) -> Optional[str]:
    """Extrai o número da NF-e do texto"""
    match = re.search(r"NF-e\s*(?:N[ºo°]\.?\s*)?(\d+)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None

def parse_produto(linha: str) -> Optional[ProdutoRennova]:
    """
    Parse de uma linha de produto do DANFE Rennova
    Formato esperado: CODIGO NOME_PRODUTO Lt: LOTE Q: QTD Dt. Val.: DATA R$ VALOR
    """
    # Extrair código
    codigo_match = re.search(COD_REGEX, linha)
    if not codigo_match:
        return None
    codigo = codigo_match.group(1)

    # Extrair lote
    lote_match = re.search(LOT_REGEX, linha)
    if not lote_match:
        return None
    lote = lote_match.group(1)

    # Extrair quantidade
    qtd_match = re.search(QTD_REGEX, linha)
    if not qtd_match:
        return None
    quantidade_str = qtd_match.group(1).replace(",", ".")
    quantidade = float(quantidade_str)

    # Extrair validade
    val_match = re.search(VAL_REGEX, linha)
    if not val_match:
        return None
    dt_validade = val_match.group(1)

    # Extrair valor unitário
    valor_match = re.search(VALOR_UNIT_REGEX, linha)
    if not valor_match:
        return None
    valor_str = valor_match.group(1).replace(".", "").replace(",", ".")
    valor_unitario = float(valor_str)

    # Extrair nome do produto (tudo entre código e "Lt:")
    nome_inicio = len(codigo_match.group(0))
    nome_fim = linha.find("Lt:")
    nome_produto = linha[nome_inicio:nome_fim].strip()

    return ProdutoRennova(
        codigo=codigo,
        nome_produto=nome_produto,
        lote=lote,
        quantidade=quantidade,
        dt_validade=dt_validade,
        valor_unitario=valor_unitario
    )

def parse_rennova_danfe(text: str) -> NFRennova:
    """
    Parse completo do DANFE Rennova
    """
    # Extrair número da NF
    numero_nf = extract_numero_nf(text)
    if not numero_nf:
        raise ValueError("Não foi possível extrair o número da NF-e")

    # Parse de produtos
    produtos = []
    linhas = text.split("\n")

    for linha in linhas:
        produto = parse_produto(linha)
        if produto:
            produtos.append(produto)

    if not produtos:
        raise ValueError("Nenhum produto encontrado no DANFE")

    return NFRennova(numero=numero_nf, produtos=produtos)

def main():
    """Função principal para teste via linha de comando"""
    parser = argparse.ArgumentParser(
        description="Parser DANFE Rennova - RegEx Oficial v4.0"
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Caminho para o arquivo PDF ou texto do DANFE"
    )
    parser.add_argument(
        "--text",
        type=str,
        help="Texto direto do DANFE para parse"
    )

    args = parser.parse_args()

    if args.file:
        # TODO: Implementar extração de texto do PDF
        # Usar pytesseract + pdf2image + OpenCV
        print("Extração de PDF ainda não implementada", file=sys.stderr)
        sys.exit(1)
    elif args.text:
        text = args.text
    else:
        # Ler do stdin
        text = sys.stdin.read()

    try:
        nf = parse_rennova_danfe(text)
        print(json.dumps(nf.to_dict(), ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"Erro ao processar DANFE: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
