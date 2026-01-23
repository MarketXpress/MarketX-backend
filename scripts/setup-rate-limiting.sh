#!/bin/bash

# Rate Limiting Setup Script
# This script sets up Redis for rate limiting functionality

echo "🚀 Setting up Rate Limiting for MarketX Backend"
echo "================================================"

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis is not installed. Please install Redis first:"
    echo "   macOS: brew install redis"
    echo "   Ubuntu: sudo apt-get install redis-server"
    echo "   CentOS: sudo yum install redis"
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping &> /dev/null; then
    echo "⚠️  Redis is not running. Starting Redis..."
    
    # Try to start Redis based on the system
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start redis
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start redis-server
    fi
    
    # Wait a moment for Redis to start
    sleep 2
    
    # Check again
    if ! redis-cli ping &> /dev/null; then
        echo "❌ Failed to start Redis. Please start it manually:"
        echo "   redis-server"
        exit 1
    fi
fi

echo "✅ Redis is running"

# Test Redis connection
REDIS_RESPONSE=$(redis-cli ping 2>/dev/null)
if [ "$REDIS_RESPONSE" = "PONG" ]; then
    echo "✅ Redis connection test successful"
else
    echo "❌ Redis connection test failed"
    exit 1
fi

# Set up Redis configuration for rate limiting
echo "📝 Configuring Redis for rate limiting..."

# Set recommended Redis configurations
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET save ""  # Disable persistence for rate limiting data
redis-cli CONFIG SET appendonly no

echo "✅ Redis configuration updated"

# Test rate limiting data structures
echo "🧪 Testing rate limiting data structures..."

# Test sorted set operations (used by sliding window algorithm)
redis-cli ZADD test_rate_limit 1625097600 "request1"
redis-cli ZADD test_rate_limit 1625097601 "request2"
redis-cli ZADD test_rate_limit 1625097602 "request3"

# Count items in set
COUNT=$(redis-cli ZCARD test_rate_limit)
if [ "$COUNT" = "3" ]; then
    echo "✅ Sorted set operations working"
else
    echo "❌ Sorted set operations failed"
    exit 1
fi

# Test range operations
redis-cli ZREMRANGEBYSCORE test_rate_limit 0 1625097600
REMAINING=$(redis-cli ZCARD test_rate_limit)
if [ "$REMAINING" = "2" ]; then
    echo "✅ Range operations working"
else
    echo "❌ Range operations failed"
    exit 1
fi

# Clean up test data
redis-cli DEL test_rate_limit

echo "✅ Rate limiting data structures test passed"

# Create initial rate limiting configuration
echo "⚙️  Setting up initial rate limiting configuration..."

# Store default tier configurations
redis-cli HSET rate_limit_config:tier:free windowMs 60000 maxRequests 10 burstAllowance 3
redis-cli HSET rate_limit_config:tier:premium windowMs 60000 maxRequests 50 burstAllowance 10  
redis-cli HSET rate_limit_config:tier:enterprise windowMs 60000 maxRequests 200 burstAllowance 50
redis-cli HSET rate_limit_config:tier:admin windowMs 60000 maxRequests 1000 burstAllowance 200

# Store endpoint-specific configurations
redis-cli HSET "rate_limit_config:endpoint:/api/auth/login" windowMs 900000 maxRequests 5 burstAllowance 0
redis-cli HSET "rate_limit_config:endpoint:/api/auth/register" windowMs 3600000 maxRequests 3 burstAllowance 0
redis-cli HSET "rate_limit_config:endpoint:/api/listings" windowMs 60000 maxRequests 30 burstAllowance 5
redis-cli HSET "rate_limit_config:endpoint:/api/search" windowMs 60000 maxRequests 20 burstAllowance 3

echo "✅ Initial configuration stored in Redis"

# Verify configuration
echo "🔍 Verifying stored configuration..."

FREE_CONFIG=$(redis-cli HGETALL rate_limit_config:tier:free)
if [[ $FREE_CONFIG == *"maxRequests"* ]] && [[ $FREE_CONFIG == *"10"* ]]; then
    echo "✅ Free tier configuration verified"
else
    echo "❌ Free tier configuration verification failed"
    exit 1
fi

LOGIN_CONFIG=$(redis-cli HGETALL "rate_limit_config:endpoint:/api/auth/login")
if [[ $LOGIN_CONFIG == *"maxRequests"* ]] && [[ $LOGIN_CONFIG == *"5"* ]]; then
    echo "✅ Login endpoint configuration verified"
else
    echo "❌ Login endpoint configuration verification failed"
    exit 1
fi

# Check Redis memory usage
MEMORY_USAGE=$(redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
echo "📊 Redis memory usage: $MEMORY_USAGE"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📄 Creating .env file with Redis configuration..."
    cat >> .env << EOF

# Rate Limiting Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
RATE_LIMIT_ENABLED=true
EOF
    echo "✅ Environment file updated"
else
    echo "⚠️  .env file already exists. Please add Redis configuration manually:"
    echo "   REDIS_URL=redis://localhost:6379"
    echo "   REDIS_PASSWORD="
    echo "   REDIS_DB=0"
    echo "   RATE_LIMIT_ENABLED=true"
fi

# Performance recommendations
echo ""
echo "🔧 Performance Recommendations:"
echo "================================"
echo "1. For production, consider using Redis Cluster for high availability"
echo "2. Set up Redis monitoring (e.g., redis-cli --latency-history)"
echo "3. Configure Redis to use appropriate maxmemory and eviction policy"
echo "4. Use Redis AUTH for security in production"
echo "5. Consider Redis persistence settings based on your needs"

echo ""
echo "📚 Documentation:"
echo "=================="
echo "• Rate limiting documentation: RATE_LIMITING.md"
echo "• Redis configuration: https://redis.io/docs/manual/config/"
echo "• Rate limiting best practices: https://blog.logrocket.com/rate-limiting-node-js/"

echo ""
echo "✅ Rate limiting setup completed successfully!"
echo "🚀 You can now start the application with rate limiting enabled."
echo ""
echo "Next steps:"
echo "1. Start your NestJS application: npm run start:dev"
echo "2. Test rate limiting: curl -X POST http://localhost:3000/auth/login"
echo "3. Monitor Redis: redis-cli monitor"
echo "4. Access admin panel: http://localhost:3000/admin/rate-limits/analytics"
