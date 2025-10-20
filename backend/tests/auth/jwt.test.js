const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyToken, 
  generateTokenPair 
} = require('../../src/utils/jwt');

describe('JWT Utilities', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    role: 'doctor'
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user data in token payload', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken({ id: mockUser.id });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include only user ID in refresh token', () => {
      const token = generateRefreshToken({ id: mockUser.id });
      const decoded = verifyToken(token);
      
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.username).toBeUndefined();
      expect(decoded.email).toBeUndefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid tokens', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockUser.id);
    });

    it('should throw error for invalid tokens', () => {
      expect(() => {
        verifyToken('invalid.token.here');
      }).toThrow('Token inválido');
    });

    it('should throw error for malformed tokens', () => {
      expect(() => {
        verifyToken('not-a-jwt-token');
      }).toThrow('Token inválido');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokenPair(mockUser);
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should generate tokens with correct payloads', () => {
      const tokens = generateTokenPair(mockUser);
      
      const accessDecoded = verifyToken(tokens.accessToken);
      const refreshDecoded = verifyToken(tokens.refreshToken);
      
      // Access token should have full user data
      expect(accessDecoded.id).toBe(mockUser.id);
      expect(accessDecoded.username).toBe(mockUser.username);
      expect(accessDecoded.role).toBe(mockUser.role);
      
      // Refresh token should only have user ID
      expect(refreshDecoded.id).toBe(mockUser.id);
      expect(refreshDecoded.username).toBeUndefined();
    });
  });
});