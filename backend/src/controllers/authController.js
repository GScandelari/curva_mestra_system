const { User } = require('../models');
const { generateTokenPair, verifyToken } = require('../utils/jwt');

/**
 * User login
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'AUTH_001'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Usuário inativo',
        code: 'AUTH_002'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'AUTH_001'
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Log successful login
    console.log(`User ${user.username} logged in successfully`);

    res.json({
      message: 'Login realizado com sucesso',
      user: user.toJSON(),
      ...tokens
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = verifyToken(refreshToken);

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Usuário não encontrado ou inativo',
        code: 'AUTH_002'
      });
    }

    // Generate new token pair
    const tokens = generateTokenPair(user);

    res.json({
      message: 'Token renovado com sucesso',
      ...tokens
    });

  } catch (error) {
    if (error.message === 'Token inválido' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token inválido ou expirado',
        code: 'AUTH_002'
      });
    }

    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: user.toJSON()
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Change user password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Validate current password
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Senha atual incorreta',
        code: 'INVALID_PASSWORD'
      });
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    console.log(`User ${user.username} changed password successfully`);

    res.json({
      message: 'Senha alterada com sucesso'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Logout (client-side token invalidation)
 */
const logout = (req, res) => {
  // In a stateless JWT implementation, logout is handled client-side
  // by removing the token from storage
  console.log(`User ${req.user.username} logged out`);
  
  res.json({
    message: 'Logout realizado com sucesso'
  });
};

module.exports = {
  login,
  refreshToken,
  getProfile,
  changePassword,
  logout
};