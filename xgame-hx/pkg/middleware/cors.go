package middleware

import (
	"github.com/gin-gonic/gin"
)

// 允许的前端来源白名单
var allowedOrigins = map[string]bool{
	"http://localhost:5173":  true,
	"http://localhost:5174":  true,
	"https://app.a1cc.site": true,   // 生产域名，按需替换
    "https://app.admin.a1cc.site": true,   // 生产域名，按需替换
    "https://your-domain.com": true,   // 生产域名，按需替换
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Webhook-Secret, x-shareholder-code")
		c.Writer.Header().Set("Access-Control-Allow-Methods",
			"POST, OPTIONS, GET, PUT, DELETE, PATCH")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		c.Writer.Header().Set("Access-Control-Max-Age", "3600")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}