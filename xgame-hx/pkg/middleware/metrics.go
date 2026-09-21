package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// PerformanceMonitor 性能监控中间件
func PerformanceMonitor() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		// 记录慢请求
		if duration > 500*time.Millisecond {
			log.Printf("⚠️ 慢请求: %s %s, 耗时: %v", c.Request.Method, c.Request.URL.Path, duration)
		}
	}
}
