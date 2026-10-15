import { getNomeCompletoMasterProduct, validateProductCode } from '@/types/masterProduct';
import type { MasterProduct } from '@/types/masterProduct';
import { Timestamp } from 'firebase/firestore';

const baseProduct: MasterProduct = {
  id: 'test-id',
  code: '1162957',
  name: 'NABOTA 100U 150MG',
  active: true,
  fragmentavel: false,
  created_at: Timestamp.now(),
  updated_at: Timestamp.now(),
};

describe('getNomeCompletoMasterProduct', () => {
  it('retorna o nome base para produto não fragmentável', () => {
    const result = getNomeCompletoMasterProduct(baseProduct);
    expect(result).toBe('NABOTA 100U 150MG');
  });

  it('retorna nome com sufixo de unidades para produto fragmentável', () => {
    const product: MasterProduct = {
      ...baseProduct,
      name: 'SCREW 27GX50X70 5-0',
      fragmentavel: true,
      unidades_por_embalagem: 60,
    };
    const result = getNomeCompletoMasterProduct(product);
    expect(result).toBe('SCREW 27GX50X70 5-0 60 UND');
  });

  it('retorna nome base quando fragmentavel=true mas sem unidades_por_embalagem (fallback seguro)', () => {
    const product: MasterProduct = {
      ...baseProduct,
      fragmentavel: true,
      unidades_por_embalagem: undefined,
    };
    const result = getNomeCompletoMasterProduct(product);
    expect(result).toBe('NABOTA 100U 150MG');
  });

  it('retorna nome base quando fragmentavel=false mesmo com unidades_por_embalagem definido', () => {
    const product: MasterProduct = {
      ...baseProduct,
      fragmentavel: false,
      unidades_por_embalagem: 60,
    };
    const result = getNomeCompletoMasterProduct(product);
    expect(result).toBe('NABOTA 100U 150MG');
  });
});

describe('validateProductCode', () => {
  it.each(['9274598', '123456', '0123456', '1'])('accepts %p', (code) => {
    expect(validateProductCode(code)).toBe(true);
  });

  it.each(['', '0', '0000000', '12345678', '12A4567', '123-456'])('rejects %p', (code) => {
    expect(validateProductCode(code)).toBe(false);
  });
});
