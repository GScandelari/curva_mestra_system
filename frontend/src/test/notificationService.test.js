import { describe, it, expect } from 'vitest'
import NotificationService from '../services/notificationService'

describe('NotificationService', () => {
  describe('getNotificationTypeInfo', () => {
    it('should return correct info for expiring_products', () => {
      const info = NotificationService.getNotificationTypeInfo('expiring_products')
      expect(info.icon).toBe('⏰')
      expect(info.color).toBe('text-yellow-600')
    })

    it('should return correct info for low_stock', () => {
      const info = NotificationService.getNotificationTypeInfo('low_stock')
      expect(info.icon).toBe('📦')
      expect(info.color).toBe('text-orange-600')
    })

    it('should return default info for unknown type', () => {
      const info = NotificationService.getNotificationTypeInfo('unknown_type')
      expect(info.icon).toBe('📢')
      expect(info.color).toBe('text-gray-600')
    })
  })

  describe('getSeverityInfo', () => {
    it('should return correct info for error severity', () => {
      const info = NotificationService.getSeverityInfo('error')
      expect(info.color).toBe('text-red-600')
      expect(info.bgColor).toBe('bg-red-50')
    })

    it('should return correct info for warning severity', () => {
      const info = NotificationService.getSeverityInfo('warning')
      expect(info.color).toBe('text-yellow-600')
      expect(info.bgColor).toBe('bg-yellow-50')
    })

    it('should return default info for unknown severity', () => {
      const info = NotificationService.getSeverityInfo('unknown')
      expect(info.color).toBe('text-blue-600')
      expect(info.bgColor).toBe('bg-blue-50')
    })
  })

  describe('formatTime', () => {
    it('should format recent time as "Agora"', () => {
      const now = new Date()
      const result = NotificationService.formatTime(now)
      expect(result).toBe('Agora')
    })

    it('should format minutes ago correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const result = NotificationService.formatTime(fiveMinutesAgo)
      expect(result).toBe('5m atrás')
    })

    it('should format hours ago correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const result = NotificationService.formatTime(twoHoursAgo)
      expect(result).toBe('2h atrás')
    })

    it('should format days ago correctly', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const result = NotificationService.formatTime(threeDaysAgo)
      expect(result).toBe('3d atrás')
    })

    it('should format old dates as locale string', () => {
      const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      const result = NotificationService.formatTime(oneWeekAgo)
      expect(result).toBe(oneWeekAgo.toLocaleDateString('pt-BR'))
    })
  })
})