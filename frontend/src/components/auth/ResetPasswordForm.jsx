import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Key, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const ResetPasswordForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { resetPassword, loading } = useAuth()
  
  const token = searchParams.get('token')
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setFocus
  } = useForm()

  const password = watch('password')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    setFocus('password')
  }, [token, navigate, setFocus])

  const onSubmit = async (data) => {
    const result = await resetPassword(token, data.password)
    if (result.success) {
      setResetSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    }
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Senha alterada!
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Sua senha foi alterada com sucesso.
            </p>
            <p className="mt-4 text-center text-sm text-gray-500">
              Você será redirecionado para a página de login em alguns segundos...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <Key className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Redefinir senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digite sua nova senha
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* New Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nova senha
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password', {
                    required: 'Nova senha é obrigatória',
                    minLength: {
                      value: 8,
                      message: 'Senha deve ter pelo menos 8 caracteres'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Digite sua nova senha"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar nova senha
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('confirmPassword', {
                    required: 'Confirmação de senha é obrigatória',
                    validate: value => value === password || 'As senhas não coincidem'
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Confirme sua nova senha"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Requisitos da senha:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center">
                <span className={`mr-2 ${password && password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>
                  •
                </span>
                Pelo menos 8 caracteres
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /[a-z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                  •
                </span>
                Uma letra minúscula
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /[A-Z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                  •
                </span>
                Uma letra maiúscula
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /\d/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                  •
                </span>
                Um número
              </li>
            </ul>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando senha...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Alterar senha
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordForm