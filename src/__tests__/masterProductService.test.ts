import {
  formatProductCode,
  getNomeCompletoMasterProduct,
  isCatalogProductCode,
  validateProductCode,
} from '@/types/masterProduct';
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
  it.each(['9274598', '12345', '12345678', '00012345', '309960', '0123456', ' 3076528 '])(
    'accepts %p',
    (code) => {
      expect(validateProductCode(code)).toBe(true);
    }
  );

  it.each(['', '0', '0000000', '1', '1234', '00001234', '123456789', '12A4567', '123-456'])(
    'rejects %p',
    (code) => {
      expect(validateProductCode(code)).toBe(false);
    }
  );
});

describe('isCatalogProductCode', () => {
  it.each([
    ['12345', true],
    ['12345678', true],
    ['309960', true],
    ['1234', false],
    ['123456789', false],
    ['012345', false],
    ['A1234', false],
    ['0', false],
  ])('%p → %p', (code, esperado) => {
    expect(isCatalogProductCode(code)).toBe(esperado);
  });
});

describe('formatProductCode', () => {
  it('keeps digits only, up to 8', () => {
    expect(formatProductCode('12a34-5678 99')).toBe('12345678');
  });
});
