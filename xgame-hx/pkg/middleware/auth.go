package middleware

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

const defaultJWTSecret = "your_secret_key"

func JWTSecret() []byte {
	s := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if s == "" {
		return []byte(defaultJWTSecret)
	}
	return []byte(s)
}

func GenerateToken(claims jwt.MapClaims) (string, error) {
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = time.Now().Add(24 * time.Hour).Unix()
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret())
}

func GenerateAdminToken(username, role string) (string, error) {
	return GenerateToken(jwt.MapClaims{
		"username": username,
		"role":     role,
	})
}

func GenerateUserToken(referralCode, ownerAddress string) (string, error) {
	return GenerateToken(jwt.MapClaims{
		"role":          "user",
		"username":      referralCode,
		"referral_code": referralCode,
		"owner_address": ownerAddress,
	})
}

func GenerateShareholderToken(id int64, code string) (string, error) {
	return GenerateToken(jwt.MapClaims{
		"role":             "shareholder",
		"shareholder_id":   id,
		"shareholder_code": code,
		"username":         code,
	})
}

func parseBearer(c *gin.Context) (jwt.MapClaims, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return nil, errAuthRequired
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return nil, errAuthFormat
	}
	claims := jwt.MapClaims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}))
	token, err := parser.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
		return JWTSecret(), nil
	})
	if err != nil || !token.Valid {
		return nil, errAuthInvalid
	}
	return claims, nil
}

func setClaims(c *gin.Context, claims jwt.MapClaims) {
	c.Set("username", claims["username"])
	c.Set("role", claims["role"])
	c.Set("referral_code", claims["referral_code"])
	c.Set("owner_address", claims["owner_address"])
	c.Set("shareholder_id", claims["shareholder_id"])
	c.Set("shareholder_code", claims["shareholder_code"])
}

func claimString(c *gin.Context, key string) string {
	v, _ := c.Get(key)
	s, _ := v.(string)
	return s
}

func Role(c *gin.Context) string {
	if s, ok := c.Get("role"); ok {
		if v, ok := s.(string); ok {
			return v
		}
	}
	return ""
}

func ReferralCode(c *gin.Context) string {
	return claimString(c, "referral_code")
}

func OwnerAddress(c *gin.Context) string {
	return claimString(c, "owner_address")
}

func ShareholderCode(c *gin.Context) string {
	return claimString(c, "shareholder_code")
}

func ShareholderID(c *gin.Context) (int64, bool) {
	v, ok := c.Get("shareholder_id")
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case int64:
		return n, n > 0
	case float64:
		return int64(n), n > 0
	case int:
		return int64(n), n > 0
	}
	return 0, false
}

func IsAdminRole(role string) bool {
	return role == "admin" || role == "super_admin" || role == "editor"
}

// Auth 任意有效 JWT（用户或管理员）
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseBearer(c)
		if err != nil {
			abortAuth(c, err)
			return
		}
		setClaims(c, claims)
		c.Next()
	}
}

// AdminAuth 仅管理员
func AdminAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseBearer(c)
		if err != nil {
			abortAuth(c, err)
			return
		}

		role, _ := claims["role"].(string)
		if !IsAdminRole(role) {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
			c.Abort()
			return
		}
		setClaims(c, claims)
		c.Next()
	}
}

// ShareholderAuth only accepts a shareholder JWT. Handlers must use the
// shareholder_id/code claims and never accept an id supplied by the client.
func ShareholderAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseBearer(c)
		if err != nil {
			abortAuth(c, err)
			return
		}
		role, _ := claims["role"].(string)
		if role != "shareholder" {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要股东权限"})
			c.Abort()
			return
		}
		if _, ok := claims["shareholder_id"]; !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "无效的股东令牌"})
			c.Abort()
			return
		}
		setClaims(c, claims)
		c.Next()
	}
}

// WebhookAuth 校验 WEBHOOK_SECRET；未配置时拒绝，避免伪造投注
func WebhookAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := strings.TrimSpace(os.Getenv("WEBHOOK_SECRET"))
		if secret == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未配置 WEBHOOK_SECRET，已拒绝 webhook"})
			c.Abort()
			return
		}
		got := strings.TrimSpace(c.GetHeader("X-Webhook-Secret"))
		if got == "" {
			if auth := c.GetHeader("Authorization"); strings.HasPrefix(auth, "Bearer ") {
				got = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
			}
		}
		if got != secret {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook secret"})
			c.Abort()
			return
		}
		c.Next()
	}
}

var (
	errAuthRequired = &authError{code: http.StatusUnauthorized, msg: "Authorization header required"}
	errAuthFormat   = &authError{code: http.StatusUnauthorized, msg: "Invalid authorization header format"}
	errAuthInvalid  = &authError{code: http.StatusUnauthorized, msg: "Invalid token"}
)

type authError struct {
	code int
	msg  string
}

func (e *authError) Error() string { return e.msg }

func abortAuth(c *gin.Context, err error) {
	msg := "Unauthorized"
	code := http.StatusUnauthorized
	if ae, ok := err.(*authError); ok {
		msg = ae.msg
		code = ae.code
	}
	c.JSON(code, gin.H{"error": msg})
	c.Abort()
}
