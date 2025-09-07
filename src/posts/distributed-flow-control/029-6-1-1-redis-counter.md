---
title: "基于Redis的分布式计数器: Lua脚本保证原子性、集群模式下的同步问题"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式限流系统中，计数器的实现是核心组件之一。由于需要在多个节点间共享状态，传统的单机计数器无法满足需求。Redis作为一个高性能的内存数据库，因其原子性操作和高并发处理能力，成为实现分布式计数器的首选方案。本章将深入探讨如何基于Redis实现高效的分布式计数器，并解决Lua脚本原子性和集群模式同步等关键问题。

## Redis分布式计数器设计

### 计数器数据结构选择

在Redis中，我们可以使用多种数据结构来实现计数器，每种都有其适用场景：

```bash
# 1. 字符串类型计数器（简单计数）
INCR key
DECR key
INCRBY key increment
GET key

# 2. 哈希类型计数器（多维度计数）
HINCRBY key field increment
HGET key field
HGETALL key

# 3. 有序集合类型计数器（带时间戳的计数）
ZADD key score member
ZCOUNT key min max
ZREMRANGEBYSCORE key min max
```

### 基础计数器实现

```java
// 基础Redis计数器实现
@Component
public class BasicRedisCounter {
    private final RedisTemplate<String, String> redisTemplate;
    
    public long increment(String key) {
        return redisTemplate.opsForValue().increment(key, 1);
    }
    
    public long incrementBy(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }
    
    public long decrement(String key) {
        return redisTemplate.opsForValue().decrement(key, 1);
    }
    
    public long get(String key) {
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.parseLong(value) : 0;
    }
    
    public void expire(String key, long timeoutSeconds) {
        redisTemplate.expire(key, timeoutSeconds, TimeUnit.SECONDS);
    }
}
```

## Lua脚本保证原子性

### 为什么需要Lua脚本

在分布式环境中，单纯的Redis命令可能无法保证操作的原子性。例如，实现一个带过期时间的计数器：

```java
// 错误的实现方式
public boolean tryAcquire(String key, long limit, long windowSeconds) {
    Long current = redisTemplate.opsForValue().increment(key, 1);
    if (current == 1) {
        // 第一次访问，设置过期时间
        redisTemplate.expire(key, windowSeconds, TimeUnit.SECONDS);
    }
    
    return current <= limit;
}
```

上述代码存在竞态条件问题：在`increment`和`expire`之间，可能有其他请求修改了计数器。

### 正确的Lua脚本实现

```java
// 使用Lua脚本保证原子性
@Component
public class AtomicRedisCounter {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScriptExecutor scriptExecutor;
    
    // 限流Lua脚本
    private static final String RATE_LIMIT_SCRIPT = 
        "local key = KEYS[1]\n" +
        "local limit = tonumber(ARGV[1])\n" +
        "local window = tonumber(ARGV[2])\n" +
        "local current = redis.call('GET', key)\n" +
        "if current == false then\n" +
        "  redis.call('SET', key, 1)\n" +
        "  redis.call('EXPIRE', key, window)\n" +
        "  return 1\n" +
        "else\n" +
        "  current = tonumber(current)\n" +
        "  if current + 1 <= limit then\n" +
        "    redis.call('INCR', key)\n" +
        "    return 1\n" +
        "  else\n" +
        "    return 0\n" +
        "  end\n" +
        "end";
    
    public boolean tryAcquire(String key, long limit, long windowSeconds) {
        try {
            Long result = scriptExecutor.execute(RATE_LIMIT_SCRIPT, 
                Collections.singletonList(key), 
                String.valueOf(limit), 
                String.valueOf(windowSeconds));
            return result != null && result == 1;
        } catch (Exception e) {
            log.error("Failed to execute rate limit script for key: {}", key, e);
            // 失败时默认允许通过以保证业务连续性
            return true;
        }
    }
}
```

### 复杂限流算法的Lua实现

```java
// 滑动窗口算法的Lua实现
@Component
public class SlidingWindowRedisCounter {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScriptExecutor scriptExecutor;
    
    // 滑动窗口限流Lua脚本
    private static final String SLIDING_WINDOW_SCRIPT = 
        "local key = KEYS[1]\n" +
        "local window = tonumber(ARGV[1])\n" +
        "local limit = tonumber(ARGV[2])\n" +
        "local current_time = tonumber(ARGV[3])\n" +
        "local min_time = current_time - window\n" +
        "\n" +
        "-- 移除过期的计数\n" +
        "redis.call('ZREMRANGEBYSCORE', key, 0, min_time)\n" +
        "\n" +
        "-- 获取当前窗口内的请求数\n" +
        "local current_count = redis.call('ZCARD', key)\n" +
        "\n" +
        "-- 判断是否超过限制\n" +
        "if current_count >= limit then\n" +
        "  return 0\n" +
        "else\n" +
        "  -- 添加当前请求\n" +
        "  redis.call('ZADD', key, current_time, current_time)\n" +
        "  -- 设置过期时间\n" +
        "  redis.call('EXPIRE', key, math.ceil(window / 1000))\n" +
        "  return 1\n" +
        "end";
    
    public boolean tryAcquire(String key, long limit, long windowMillis) {
        try {
            Long result = scriptExecutor.execute(SLIDING_WINDOW_SCRIPT, 
                Collections.singletonList(key), 
                String.valueOf(windowMillis), 
                String.valueOf(limit), 
                String.valueOf(System.currentTimeMillis()));
            return result != null && result == 1;
        } catch (Exception e) {
            log.error("Failed to execute sliding window script for key: {}", key, e);
            return true;
        }
    }
}
```

## Redis集群模式下的同步问题

### 集群模式挑战

在Redis集群模式下，数据被分片存储在不同的节点上，这带来了新的挑战：

1. **键分布**：需要确保相关的键分布在同一个槽位上
2. **跨节点操作**：Lua脚本不能跨节点执行
3. **数据一致性**：网络分区可能导致数据不一致

### 键哈希标签解决分片问题

```java
// 使用键哈希标签确保键分布在同一槽位
public class KeyHashTagUtil {
    
    public static String addHashTag(String key, String tag) {
        // 使用{}包围标签，Redis会根据{}内的内容计算哈希槽
        return "{" + tag + "}:" + key;
    }
    
    public static String getResourceKey(String resource, String dimension) {
        // 为资源和维度添加相同的哈希标签
        return addHashTag("rate_limit:" + resource + ":" + dimension, resource);
    }
    
    // 示例：为用户ID和API路径创建键
    public static String getUserApiCounterKey(String userId, String apiPath) {
        String tag = userId + ":" + apiPath;
        return addHashTag("user_api_counter:" + userId + ":" + apiPath, tag);
    }
}
```

### 集群模式下的限流实现

```java
// 集群兼容的限流实现
@Component
public class ClusterCompatibleRateLimiter {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScriptExecutor scriptExecutor;
    private final boolean isClusterMode;
    
    public ClusterCompatibleRateLimiter(RedisTemplate<String, String> redisTemplate,
                                      ScriptExecutor scriptExecutor,
                                      RedisClusterConfiguration clusterConfig) {
        this.redisTemplate = redisTemplate;
        this.scriptExecutor = scriptExecutor;
        this.isClusterMode = clusterConfig != null;
    }
    
    // 集群模式下的滑动窗口实现
    private static final String CLUSTER_SLIDING_WINDOW_SCRIPT =
        "local key = KEYS[1]\n" +
        "local window = tonumber(ARGV[1])\n" +
        "local limit = tonumber(ARGV[2])\n" +
        "local current_time = tonumber(ARGV[3])\n" +
        "local min_time = current_time - window\n" +
        "\n" +
        "-- 在集群模式下，确保所有操作都在同一个键上\n" +
        "-- 移除过期的计数\n" +
        "redis.call('ZREMRANGEBYSCORE', key, 0, min_time)\n" +
        "\n" +
        "-- 获取当前窗口内的请求数\n" +
        "local current_count = redis.call('ZCARD', key)\n" +
        "\n" +
        "-- 判断是否超过限制\n" +
        "if current_count >= limit then\n" +
        "  return 0\n" +
        "else\n" +
        "  -- 添加当前请求\n" +
        "  redis.call('ZADD', key, current_time, current_time)\n" +
        "  -- 设置过期时间\n" +
        "  redis.call('EXPIRE', key, math.ceil(window / 1000))\n" +
        "  return 1\n" +
        "end";
    
    public boolean tryAcquire(String resource, String dimension, long limit, long windowMillis) {
        // 使用哈希标签确保键分布在同一个槽位
        String key = KeyHashTagUtil.getResourceKey(resource, dimension);
        
        try {
            Long result = scriptExecutor.execute(CLUSTER_SLIDING_WINDOW_SCRIPT, 
                Collections.singletonList(key), 
                String.valueOf(windowMillis), 
                String.valueOf(limit), 
                String.valueOf(System.currentTimeMillis()));
            return result != null && result == 1;
        } catch (Exception e) {
            log.error("Failed to execute cluster sliding window script for key: {}", key, e);
            return true;
        }
    }
}
```

## 高可用与故障处理

### 连接池配置优化

```java
// Redis连接池配置优化
@Configuration
public class RedisConfig {
    
    @Bean
    public LettuceClientConfiguration lettuceClientConfiguration() {
        return LettuceClientConfiguration.builder()
            .commandTimeout(Duration.ofMillis(100))
            .shutdownTimeout(Duration.ofMillis(100))
            .clientOptions(ClientOptions.builder()
                .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
                .autoReconnect(true)
                .build())
            .build();
    }
    
    @Bean
    public RedisStandaloneConfiguration redisStandaloneConfiguration() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName("localhost");
        config.setPort(6379);
        config.setDatabase(0);
        return config;
    }
    
    @Bean
    public RedisConnectionFactory redisConnectionFactory(
            LettuceClientConfiguration clientConfig,
            RedisStandaloneConfiguration standaloneConfig) {
        return new LettuceConnectionFactory(standaloneConfig, clientConfig);
    }
}
```

### 故障降级策略

```java
// Redis故障降级实现
@Component
public class ResilientRedisCounter {
    private final RedisTemplate<String, String> redisTemplate;
    private final ScriptExecutor scriptExecutor;
    private final LocalCounter localCounter;
    private final CircuitBreaker circuitBreaker;
    
    public ResilientRedisCounter(RedisTemplate<String, String> redisTemplate,
                               ScriptExecutor scriptExecutor) {
        this.redisTemplate = redisTemplate;
        this.scriptExecutor = scriptExecutor;
        this.localCounter = new LocalCounter();
        this.circuitBreaker = CircuitBreaker.ofDefaults("redis-counter");
    }
    
    public boolean tryAcquire(String key, long limit, long windowSeconds) {
        // 使用熔断器包装Redis操作
        Supplier<Boolean> redisOperation = CircuitBreaker.decorateSupplier(circuitBreaker, () -> {
            try {
                Long result = scriptExecutor.execute(RATE_LIMIT_SCRIPT, 
                    Collections.singletonList(key), 
                    String.valueOf(limit), 
                    String.valueOf(windowSeconds));
                return result != null && result == 1;
            } catch (Exception e) {
                throw new RuntimeException("Redis operation failed", e);
            }
        });
        
        try {
            return redisOperation.get();
        } catch (Exception e) {
            log.warn("Redis counter failed, falling back to local counter", e);
            // 降级到本地计数器
            return localCounter.tryAcquire(key, limit, windowSeconds);
        }
    }
    
    // 本地计数器实现（用于降级）
    private static class LocalCounter {
        private final Map<String, SlidingWindowCounter> counters = new ConcurrentHashMap<>();
        
        public boolean tryAcquire(String key, long limit, long windowSeconds) {
            SlidingWindowCounter counter = counters.computeIfAbsent(key, 
                k -> new SlidingWindowCounter(limit, windowSeconds * 1000));
            return counter.tryAcquire();
        }
    }
    
    // 本地滑动窗口计数器
    private static class SlidingWindowCounter {
        private final long limit;
        private final long windowMillis;
        private final Queue<Long> requestTimes = new ConcurrentLinkedQueue<>();
        
        public SlidingWindowCounter(long limit, long windowMillis) {
            this.limit = limit;
            this.windowMillis = windowMillis;
        }
        
        public boolean tryAcquire() {
            long now = System.currentTimeMillis();
            long windowStart = now - windowMillis;
            
            // 清除过期的请求时间
            while (!requestTimes.isEmpty() && requestTimes.peek() < windowStart) {
                requestTimes.poll();
            }
            
            // 检查是否超过限制
            if (requestTimes.size() >= limit) {
                return false;
            }
            
            // 记录当前请求时间
            requestTimes.offer(now);
            return true;
        }
    }
}
```

## 性能优化与监控

### 批量操作优化

```java
// 批量操作优化
@Component
public class BatchRedisCounter {
    private final RedisTemplate<String, String> redisTemplate;
    
    public Map<String, Long> batchIncrement(Map<String, Long> increments) {
        // 使用Pipeline批量执行
        List<Object> results = redisTemplate.executePipelined(new RedisCallback<Object>() {
            @Override
            public Object doInRedis(RedisConnection connection) throws DataAccessException {
                StringRedisConnection stringConn = (StringRedisConnection) connection;
                for (Map.Entry<String, Long> entry : increments.entrySet()) {
                    stringConn.incrBy(entry.getKey(), entry.getValue());
                }
                return null;
            }
        });
        
        // 构造结果
        Map<String, Long> resultMap = new HashMap<>();
        int i = 0;
        for (String key : increments.keySet()) {
            resultMap.put(key, (Long) results.get(i++));
        }
        
        return resultMap;
    }
}
```

### 性能监控

```java
// Redis计数器性能监控
@Component
public class RedisCounterMetrics {
    private final MeterRegistry meterRegistry;
    private final Timer redisOperationTimer;
    private final Counter redisErrorsCounter;
    private final Gauge redisConnectionActive;
    
    public RedisCounterMetrics(MeterRegistry meterRegistry, 
                             LettuceConnectionFactory connectionFactory) {
        this.meterRegistry = meterRegistry;
        this.redisOperationTimer = Timer.builder("redis.counter.operation.duration")
            .description("Redis counter operation duration")
            .register(meterRegistry);
        this.redisErrorsCounter = Counter.builder("redis.counter.errors")
            .description("Redis counter errors")
            .register(meterRegistry);
        
        // 监控Redis连接数
        this.redisConnectionActive = Gauge.builder("redis.connections.active")
            .description("Active Redis connections")
            .register(meterRegistry, connectionFactory, 
                     factory -> getConnectionCount(factory));
    }
    
    public <T> T monitorOperation(Supplier<T> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            T result = operation.get();
            sample.stop(redisOperationTimer);
            return result;
        } catch (Exception e) {
            redisErrorsCounter.increment();
            throw e;
        }
    }
    
    private double getConnectionCount(LettuceConnectionFactory factory) {
        // 获取活跃连接数的实现
        // 具体实现依赖于Lettuce的内部状态
        return 0.0;
    }
}
```

通过以上实现，我们构建了一个基于Redis的高效分布式计数器系统，能够保证操作的原子性，兼容Redis集群模式，并具备良好的故障处理和性能监控能力。这为分布式限流系统提供了坚实的基础支撑。