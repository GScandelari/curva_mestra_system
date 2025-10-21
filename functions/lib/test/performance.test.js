"use strict";
/**
 * Performance Tests
 * Basic performance validation for critical functions
 */
describe('Performance Tests', () => {
    describe('Validation Performance', () => {
        test('should validate products quickly', () => {
            const startTime = performance.now();
            // Test validation of 1000 products
            for (let i = 0; i < 1000; i++) {
                const product = {
                    name: `Product ${i}`,
                    category: 'medicamento',
                    currentStock: 100,
                    minimumStock: 10,
                    invoiceNumber: `NF-${i}`
                };
                validateProduct(product);
            }
            const endTime = performance.now();
            const duration = endTime - startTime;
            // Should complete in less than 100ms
            expect(duration).toBeLessThan(100);
        });
        test('should validate requests quickly', () => {
            const startTime = performance.now();
            // Test validation of 1000 requests
            for (let i = 0; i < 1000; i++) {
                const request = {
                    productId: `product-${i}`,
                    requesterId: `user-${i}`,
                    quantity: 5,
                    reason: `Test reason ${i}`
                };
                validateRequest(request);
            }
            const endTime = performance.now();
            const duration = endTime - startTime;
            // Should complete in less than 50ms
            expect(duration).toBeLessThan(50);
        });
    });
    describe('Stock Calculation Performance', () => {
        test('should calculate stock operations quickly', () => {
            const startTime = performance.now();
            // Test 10000 stock calculations
            for (let i = 0; i < 10000; i++) {
                const currentStock = Math.floor(Math.random() * 1000);
                const minimumStock = Math.floor(Math.random() * 100);
                const requestQuantity = Math.floor(Math.random() * 50);
                isLowStock(currentStock, minimumStock);
                hasSufficientStock(currentStock, requestQuantity);
                calculateNewStock(currentStock, requestQuantity);
            }
            const endTime = performance.now();
            const duration = endTime - startTime;
            // Should complete in less than 50ms
            expect(duration).toBeLessThan(50);
        });
    });
    describe('Date Operations Performance', () => {
        test('should handle date calculations efficiently', () => {
            const startTime = performance.now();
            // Test 1000 date operations
            for (let i = 0; i < 1000; i++) {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 365));
                isExpiringSoon(futureDate, 30);
                isExpired(futureDate);
            }
            const endTime = performance.now();
            const duration = endTime - startTime;
            // Should complete in less than 20ms
            expect(duration).toBeLessThan(20);
        });
    });
    describe('Memory Usage', () => {
        test('should not create memory leaks in validation', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            // Create and validate many objects
            for (let i = 0; i < 5000; i++) {
                const product = {
                    name: `Product ${i}`,
                    category: 'medicamento',
                    currentStock: 100,
                    minimumStock: 10,
                    invoiceNumber: `NF-${i}`,
                    description: `Description for product ${i}`.repeat(10)
                };
                validateProduct(product);
            }
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            // Memory increase should be reasonable (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });
});
// Helper functions (same as in validation-logic.test.ts)
function validateProduct(product) {
    const requiredFields = ['name', 'category', 'currentStock', 'minimumStock', 'invoiceNumber'];
    const validCategories = ['medicamento', 'equipamento', 'consumivel'];
    for (const field of requiredFields) {
        if (!product[field])
            return false;
    }
    if (typeof product.currentStock !== 'number' || typeof product.minimumStock !== 'number') {
        return false;
    }
    if (!validCategories.includes(product.category)) {
        return false;
    }
    return true;
}
function validateRequest(request) {
    const requiredFields = ['productId', 'requesterId', 'quantity', 'reason'];
    for (const field of requiredFields) {
        if (!request[field])
            return false;
    }
    if (typeof request.quantity !== 'number' || request.quantity <= 0) {
        return false;
    }
    return true;
}
function isLowStock(currentStock, minimumStock) {
    return currentStock <= minimumStock;
}
function hasSufficientStock(currentStock, requestedQuantity) {
    return currentStock >= requestedQuantity;
}
function calculateNewStock(currentStock, usedQuantity) {
    return currentStock - usedQuantity;
}
function isExpiringSoon(expirationDate, daysThreshold) {
    const today = new Date();
    const thresholdDate = new Date(today.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));
    return expirationDate <= thresholdDate;
}
function isExpired(expirationDate) {
    const today = new Date();
    return expirationDate < today;
}
//# sourceMappingURL=performance.test.js.map