import { NextResponse } from "next/server";

// Chave pública gerada para integração PagSeguro
// Formato: x.509 (SPKI), 2048 bits
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqqKUCqbVCWM0qWG3wMVZ
niXS/dOwZu7472oTh1hBi9Xmqy0685WDOOGWDY9c8ONegxiSXP9EZ7GrxINymooy
R25To7UJdbcWyPYaWA8MEmVqhMYg5JSKw8U1D8Ke5irFD+QYiHlPD3XurPQjIK3k
OjW/FOdpwAMXU4kIc40w18N78CSd59GkK2ZWzlw3T152SzdNhAKnWw4NyxsemPis
iKgbowU3nJSjCA9Cy2h7ftfBpG5LINAuay0+8dnb8WeZs2RqmMTBQx2F8PnLsJPm
y8VhiDc8eA3AhuI9924OaQiZS89Zsqs92KCnhHRlPAm3+p9Cb2UhVfRvmj+wMeeq
WwIDAQAB
-----END PUBLIC KEY-----`;

// Data de criação da chave (timestamp em milliseconds)
// Gerada em: 29/01/2026 22:23:22 UTC
const CREATED_AT = 1769657002000;

/**
 * GET /api/pagseguro/public-key
 * Endpoint público para disponibilizar a chave pública para o PagSeguro
 */
export async function GET() {
  return NextResponse.json(
    {
      public_key: PUBLIC_KEY,
      created_at: CREATED_AT,
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
