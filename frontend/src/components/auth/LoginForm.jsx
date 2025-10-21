import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useFormError } from '../../contexts/ErrorContext'
import ErrorDisplay, { FieldError } from '../common/ErrorDisplay'
import { ButtonSpinner } from '../common/LoadingSpinner'
import { useSuccessNotification } from '../common/NotificationToast'

const LoginForm = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { login, isAuthenticated, getDefaultRedirectPath } = useAuth()
  const { fieldErrors, handleFormError, clearAllFieldErrors } = useFormError()
  const { showSuccess } = useSuccessNotification()
  const navigate = useNavigate()
  const location = useLocation()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
    setError,
    clearErrors
  } = useForm()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || getDefaultRedirectPath()
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location, getDefaultRedirectPath])

  // Focus on email field when component mounts
  useEffect(() => {
    setFocus('email')
  }, [setFocus])

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      clearAllFieldErrors()
      clearErrors()
    }
  }, [clearAllFieldErrors, clearErrors])

  const onSubmit = async (data) => {
    setIsLoading(true)
    clearAllFieldErrors()
    clearErrors()

    try {
      const result = await login(data)
      if (result.success) {
        showSuccess('Login realizado com sucesso!')
        const from = location.state?.from?.pathname || getDefaultRedirectPath()
        navigate(from, { replace: true })
      }
    } catch (error) {
      handleFormError(error)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <LogIn className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Faça login em sua conta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistema de Gestão de Inventário - Clínicas de Harmonização
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  {...register('email', {
                    required: 'Email é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido'
                    }
                  })}
                  type="email"
                  autoComplete="email"
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Digite seu email"
                />
                {errors.email && (
                  <FieldError error={errors.email.message} />
                )}
                {fieldErrors.email && (
                  <FieldError error={fieldErrors.email} />
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password', {
                    required: 'Senha é obrigatória',
                    minLength: {
                      value: 6,
                      message: 'Senha deve ter pelo menos 6 caracteres'
                    }
                  })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                {errors.password && (
                  <FieldError error={errors.password.message} />
                )}
                {fieldErrors.password && (
                  <FieldError error={fieldErrors.password} />
                )}
              </div>
            </div>
          </div>

          {/* General form errors will be handled by the error context and displayed as notifications */}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <ButtonSpinner className="mr-2" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Esqueceu sua senha?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginForm