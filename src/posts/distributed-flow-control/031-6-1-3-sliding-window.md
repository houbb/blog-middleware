---
title: "滑动窗口的精确实现: 基于Redis Sorted Set或ZSET"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
滑动窗口算法是分布式限流系统中最为精确和灵活的限流算法之一。相比于固定窗口算法，滑动窗口能够提供更平滑的流量控制，避免临界点问题。在分布式环境中，基于Redis的Sorted Set（ZSET）数据结构可以实现高效的滑动窗口限流。本章将深入探讨滑动窗口算法的原理，并详细介绍如何基于Redis ZSET实现精确的分布式滑动窗口限流。

## 滑动窗口算法原理

### 算法核心思想

滑动窗口算法将时间划分为连续的窗口，每个窗口内的请求数量不能超过预设的阈值。与固定窗口不同，滑动窗口允许窗口边界动态移动，从而实现更精确的流量控制。

```
时间轴: 0    100  200  300  400  500  600  700  800  900  1000 (ms)
窗口1:  [--------5--------]
窗口2:      [--------3--------]
窗口3:          [--------7--------]
```

### 算法优势与挑战

**优势：**
1. **精确性**：能够精确控制单位时间内的请求数量
2. **平滑性**：避免固定窗口的临界问题
3. **灵活性**：支持任意时间窗口大小

**挑战：**
1. **存储开销**：需要存储每个请求的时间戳
2. **计算复杂度**：需要实时计算窗口内的请求数量
3. **分布式一致性**：在分布式环境中保证数据一致性

## Redis ZSET实现滑动窗口

### 数据结构设计

Redis的Sorted Set数据结构非常适合实现滑动窗口，因为它支持：
1. 按分数（时间戳）排序
2. 快速范围查询
3. 原子性操作

```bash
# ZSET结构示例
# 成员: 请求标识符（可以是时间戳或唯一ID）
# 分数: 请求时间戳（毫秒）
ZADD window_key 1634567890000 "request_1"
ZADD window_key 1634567890100 "request_2"
ZADD window_key 1634567890200 "request_3"
```

### 基础实现

```java
// 基于Redis ZSET的滑动窗口实现
@Component
public class ZSetSlidingWindow {
    private final RedisTemplate<String, String> redisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    
    public boolean tryAcquire(String key, long limit, long windowMillis) {
        long now = System.currentTimeMillis();
        long windowStart = now - windowMillis;
        
        // 使用Redis事务保证原子性
        List<Object> results = stringRedisTemplate.execute(new SessionCallback<List<Object>>() {
            @Override
            public List<Object> execute(RedisOperations operations) throws DataAccessException {
                operations.multi();
                
                // 1. 移除过期的请求记录
                operations.boundZSetOps(key).removeRangeByScore(0, windowStart);
                
                // 2. 获取当前窗口内的请求数量
                operations.boundZSetOps(key).count(windowStart, now);
                
                // 3. 如果未超过限制，则添加当前请求
                operations.boundZSetOps(key).add(String.valueOf(now), now);
                
                // 4. 设置过期时间，避免内存泄漏
                operations.boundZSetOps(key).expire(windowMillis * 2, TimeUnit.MILLISECONDS);
                
                return operations.exec();
            }
        });
        
        // 解析执行结果
        if (results != null && results.size() >= 3) {
            Long currentCount = (Long) results.get(1);
            return currentCount < limit;
        }
        
        // 执行失败，默认允许通过
        return true;
    }
}
```

### 高性能Lua脚本实现

```java
// 使用Lua脚本实现高性能滑动窗口
@Component
public class HighPerformanceSlidingWindow {
    private final StringRedisTemplate stringRedisTemplate;
    private final ScriptExecutor scriptExecutor;
    
    // 滑动窗口Lua脚本
    private static final String SLIDING_WINDOW_SCRIPT = 
        "local key = KEYS[1]\n" +
        "local window = tonumber(ARGV[1])\n" +
        "local limit = tonumber(ARGV[2])\n" +
        "local current_time = tonumber(ARGV[3])\n" +
        "local min_time = current_time - window\n" +
        "\n" +
        "-- 移除过期的请求记录\n" +
        "redis.call('ZREMRANGEBYSCORE', key, 0, min_time)\n" +
        "\n" +
        "-- 获取当前窗口内的请求数量\n" +
        "local current_count = redis.call('ZCOUNT', key, min_time, current_time)\n" +
        "\n" +
        "-- 判断是否超过限制\n" +
        "if current_count >= limit then\n" +
        "  return 0\n" +
        "else\n" +
        "  -- 添加当前请求\n" +
        "  redis.call('ZADD', key, current_time, current_time)\n" +
        "  -- 设置过期时间\n" +
        "  redis.call('EXPIRE', key, math.ceil(window / 1000) * 2)\n" +
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
            // 失败时默认允许通过
            return true;
        }
    }
}
```

## 精确滑动窗口优化

### 内存优化

```java
// 内存优化的滑动窗口实现
@Component
public class MemoryOptimizedSlidingWindow {
    private final StringRedisTemplate stringRedisTemplate;
    private final ScriptExecutor scriptExecutor;
    
    // 内存优化的Lua脚本
    private static final String OPTIMIZED_SLIDING_WINDOW_SCRIPT = 
        "local key = KEYS[1]\n" +
        "local window = tonumber(ARGV[1])\n" +
        "local limit = tonumber(ARGV[2])\n" +
        "local current_time = tonumber(ARGV[3])\n" +
        "local min_time = current_time - window\n" +
        "\n" +
        "-- 批量移除过期的请求记录（优化性能）\n" +
        "local removed_count = redis.call('ZREMRANGEBYSCORE', key, 0, min_time)\n" +
        "\n" +
        "-- 获取当前窗口内的请求数量\n" +
        "local current_count = redis.call('ZCOUNT', key, min_time, current_time)\n" +
        "\n" +
        "-- 判断是否超过限制\n" +
        "if current_count >= limit then\n" +
        "  return 0\n" +
        "else\n" +
        "  -- 添加当前请求\n" +
        "  redis.call('ZADD', key, current_time, current_time)\n" +
        "  -- 智能设置过期时间\n" +
        "  local ttl = math.ceil(window / 1000) + 10\n" +
        "  redis.call('EXPIRE', key, ttl)\n" +
        "  return 1\n" +
        "end";
    
    public boolean tryAcquire(String key, long limit, long windowMillis) {
        return tryAcquireWithPermits(key, limit, windowMillis, 1);
    }
    
    public boolean tryAcquireWithPermits(String key, long limit, long windowMillis, int permits) {
        try {
            Long result = scriptExecutor.execute(OPTIMIZED_SLIDING_WINDOW_SCRIPT, 
                Collections.singletonList(key), 
                String.valueOf(windowMillis), 
                String.valueOf(limit), 
                String.valueOf(System.currentTimeMillis()));
            return result != null && result == 1;
        } catch (Exception e) {
            log.error("Failed to execute optimized sliding window script for key: {}", key, e);
            return true;
        }
    }
}
```

### 批量处理优化

```java
// 批量处理优化
@Component
public class BatchSlidingWindow {
    private final StringRedisTemplate stringRedisTemplate;
    private final ScriptExecutor scriptExecutor;
    
    // 批量滑动窗口Lua脚本
    private static final String BATCH_SLIDING_WINDOW_SCRIPT = 
        "local window = tonumber(ARGV[1])\n" +
        "local limit = tonumber(ARGV[2])\n" +
        "local current_time = tonumber(ARGV[3])\n" +
        "local min_time = current_time - window\n" +
        "local results = {}\n" +
        "\n" +
        "-- 处理每个键\n" +
        "for i = 4, #ARGV, 2 do\n" +
        "  local key = ARGV[i]\n" +
        "  local permits = tonumber(ARGV[i + 1])\n" +
        "  \n" +
        "  -- 移除过期的请求记录\n" +
        "  redis.call('ZREMRANGEBYSCORE', key, 0, min_time)\n" +
        "  \n" +
        "  -- 获取当前窗口内的请求数量\n" +
        "  local current_count = redis.call('ZCOUNT', key, min_time, current_time)\n" +
        "  \n" +
        "  -- 判断是否超过限制\n" +
        "  if current_count + permits > limit then\n" +
        "    table.insert(results, 0)\n" +
        "  else\n" +
        "    -- 添加当前请求\n" +
        "    for j = 1, permits do\n" +
        "      redis.call('ZADD', key, current_time + j, current_time + j)\n" +
        "    end\n" +
        "    -- 设置过期时间\n" +
        "    redis.call('EXPIRE', key, math.ceil(window / 1000) * 2)\n" +
        "    table.insert(results, 1)\n" +
        "  end\n" +
        "end\n" +
        "\n" +
        "return results";
    
    public Map<String, Boolean> tryAcquireBatch(Map<String, Integer> requests, 
                                              long limit, long windowMillis) {
        try {
            // 构造参数列表
            List<String> args = new ArrayList<>();
            args.add(String.valueOf(windowMillis));
            args.add(String.valueOf(limit));
            args.add(String.valueOf(System.currentTimeMillis()));
            
            for (Map.Entry<String, Integer> entry : requests.entrySet()) {
                args.add(entry.getKey());
                args.add(String.valueOf(entry.getValue()));
            }
            
            // 执行批量脚本
            List<Long> results = scriptExecutor.execute(BATCH_SLIDING_WINDOW_SCRIPT, 
                Collections.emptyList(), 
                args.toArray(new String[0]));
            
            // 构造结果映射
            Map<String, Boolean> resultMap = new HashMap<>();
            int i = 0;
            for (String key : requests.keySet()) {
                resultMap.put(key, results.get(i++) == 1);
            }
            
            return resultMap;
        } catch (Exception e) {
            log.error("Failed to execute batch sliding window script", e);
            // 失败时默认全部允许通过
            Map<String, Boolean> fallbackResult = new HashMap<>();
            for (String key : requests.keySet()) {
                fallbackResult.put(key, true);
            }
            return fallbackResult;
        }
    }
}
```

## 高级滑动窗口特性

### 多维度滑动窗口

```java
// 多维度滑动窗口实现
@Component
public class MultiDimensionSlidingWindow {
    private final HighPerformanceSlidingWindow slidingWindow;
    
    public boolean tryAcquire(MultiDimensionResource resource, int permits) {
        // 1. 检查全局维度
        if (!checkGlobalDimension(resource, permits)) {
            return false;
        }
        
        // 2. 检查用户维度
        if (!checkUserDimension(resource, permits)) {
            return false;
        }
        
        // 3. 检查API维度
        if (!checkApiDimension(resource, permits)) {
            return false;
        }
        
        // 4. 所有维度都通过，记录请求
        recordRequest(resource, permits);
        return true;
    }
    
    private boolean checkGlobalDimension(MultiDimensionResource resource, int permits) {
        String globalKey = "global:" + resource.getApiPath();
        return slidingWindow.tryAcquireWithPermits(globalKey, 
            resource.getGlobalLimit(), 
            resource.getWindowMillis(), 
            permits);
    }
    
    private boolean checkUserDimension(MultiDimensionResource resource, int permits) {
        String userKey = "user:" + resource.getUserId() + ":" + resource.getApiPath();
        return slidingWindow.tryAcquireWithPermits(userKey, 
            resource.getUserLimit(), 
            resource.getWindowMillis(), 
            permits);
    }
    
    private boolean checkApiDimension(MultiDimensionResource resource, int permits) {
        String apiKey = "api:" + resource.getApiPath();
        return slidingWindow.tryAcquireWithPermits(apiKey, 
            resource.getApiLimit(), 
            resource.getWindowMillis(), 
            permits);
    }
    
    private void recordRequest(MultiDimensionResource resource, int permits) {
        long now = System.currentTimeMillis();
        // 可以在这里记录详细的请求信息用于监控和分析
        log.debug("Request recorded: resource={}, permits={}, time={}", 
            resource, permits, now);
    }
}

// 多维度资源定义
public class MultiDimensionResource {
    private String userId;
    private String apiPath;
    private long windowMillis;
    private long globalLimit;
    private long userLimit;
    private long apiLimit;
    
    // 构造函数、getter和setter方法
    // ...
}
```

### 自适应滑动窗口

```java
// 自适应滑动窗口实现
@Component
public class AdaptiveSlidingWindow {
    private final HighPerformanceSlidingWindow slidingWindow;
    private final SystemMetricsCollector metricsCollector;
    private final Map<String, AdaptiveConfig> configCache = new ConcurrentHashMap<>();
    
    public boolean tryAcquire(String key, long baseLimit, long windowMillis) {
        // 获取自适应配置
        AdaptiveConfig config = getAdaptiveConfig(key);
        
        // 根据系统负载调整限流阈值
        long adaptiveLimit = calculateAdaptiveLimit(baseLimit, config);
        
        return slidingWindow.tryAcquire(key, adaptiveLimit, windowMillis);
    }
    
    private AdaptiveConfig getAdaptiveConfig(String key) {
        return configCache.computeIfAbsent(key, k -> new AdaptiveConfig());
    }
    
    private long calculateAdaptiveLimit(long baseLimit, AdaptiveConfig config) {
        // 收集系统指标
        SystemMetrics metrics = metricsCollector.collect();
        
        // 根据CPU使用率调整
        double cpuFactor = calculateCpuFactor(metrics.getCpuUsage());
        
        // 根据内存使用率调整
        double memoryFactor = calculateMemoryFactor(metrics.getMemoryUsage());
        
        // 根据响应时间调整
        double responseTimeFactor = calculateResponseTimeFactor(metrics.getAvgResponseTime());
        
        // 综合计算自适应阈值
        double adaptiveFactor = cpuFactor * memoryFactor * responseTimeFactor;
        return Math.max(1, (long) (baseLimit * adaptiveFactor));
    }
    
    private double calculateCpuFactor(double cpuUsage) {
        if (cpuUsage < 50) {
            return 1.2; // CPU使用率较低，可以提高阈值
        } else if (cpuUsage < 80) {
            return 1.0; // 正常范围
        } else {
            return 0.8; // CPU使用率较高，降低阈值
        }
    }
    
    private double calculateMemoryFactor(double memoryUsage) {
        if (memoryUsage < 60) {
            return 1.1;
        } else if (memoryUsage < 85) {
            return 1.0;
        } else {
            return 0.7;
        }
    }
    
    private double calculateResponseTimeFactor(long avgResponseTime) {
        if (avgResponseTime < 100) {
            return 1.1;
        } else if (avgResponseTime < 500) {
            return 1.0;
        } else {
            return 0.8;
        }
    }
    
    // 自适应配置
    private static class AdaptiveConfig {
        private volatile double sensitivity = 1.0;
        private volatile long lastAdjustmentTime = System.currentTimeMillis();
        
        // getter和setter方法
        // ...
    }
}
```

## 性能监控与优化

### 滑动窗口性能监控

```java
// 滑动窗口性能监控
@Component
public class SlidingWindowMetrics {
    private final MeterRegistry meterRegistry;
    private final Timer windowOperationTimer;
    private final Counter rejectedRequestsCounter;
    private final Counter allowedRequestsCounter;
    
    public SlidingWindowMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        this.windowOperationTimer = Timer.builder("sliding.window.operation.duration")
            .description("Sliding window operation duration")
            .register(meterRegistry);
        this.rejectedRequestsCounter = Counter.builder("sliding.window.requests.rejected")
            .description("Rejected requests by sliding window")
            .register(meterRegistry);
        this.allowedRequestsCounter = Counter.builder("sliding.window.requests.allowed")
            .description("Allowed requests by sliding window")
            .register(meterRegistry);
    }
    
    public boolean monitorTryAcquire(Supplier<Boolean> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            boolean result = operation.get();
            sample.stop(windowOperationTimer);
            
            if (result) {
                allowedRequestsCounter.increment();
            } else {
                rejectedRequestsCounter.increment();
            }
            
            return result;
        } catch (Exception e) {
            sample.stop(windowOperationTimer);
            throw e;
        }
    }
}
```

### 内存使用优化

```java
// 内存使用监控和优化
@Component
public class MemoryUsageOptimizer {
    private final StringRedisTemplate stringRedisTemplate;
    private final ScheduledExecutorService scheduler;
    
    @PostConstruct
    public void init() {
        // 定期检查和优化内存使用
        scheduler.scheduleAtFixedRate(this::optimizeMemoryUsage, 
            60, 60, TimeUnit.SECONDS);
    }
    
    private void optimizeMemoryUsage() {
        try {
            // 获取Redis内存使用情况
            Properties info = stringRedisTemplate.getConnectionFactory()
                .getConnection().serverCommands().info("memory");
            
            String usedMemory = info.getProperty("used_memory");
            String usedMemoryHuman = info.getProperty("used_memory_human");
            
            log.info("Redis memory usage: {} ({})", usedMemory, usedMemoryHuman);
            
            // 如果内存使用过高，执行清理操作
            long usedMemoryBytes = Long.parseLong(usedMemory);
            if (usedMemoryBytes > getMaxMemoryThreshold()) {
                performMemoryCleanup();
            }
        } catch (Exception e) {
            log.warn("Failed to check Redis memory usage", e);
        }
    }
    
    private void performMemoryCleanup() {
        // 执行内存清理操作
        // 例如：清理过期的限流键
        cleanupExpiredKeys();
    }
    
    private void cleanupExpiredKeys() {
        // 使用SCAN命令查找和清理过期的键
        // 实现细节省略
    }
    
    private long getMaxMemoryThreshold() {
        // 根据配置或系统资源动态计算内存阈值
        return Runtime.getRuntime().maxMemory() * 80 / 100; // 使用80%的堆内存
    }
}
```

通过以上实现，我们构建了一个基于Redis ZSET的精确滑动窗口限流系统。该系统不仅具有高精度和高性能的特点，还支持多维度限流、自适应调整等高级特性，能够满足复杂分布式系统中的限流需求。