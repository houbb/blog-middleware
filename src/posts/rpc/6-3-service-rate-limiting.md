---
title: 服务限流
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在高并发的分布式系统中，服务限流是保护系统稳定性的关键机制之一。当系统面临突发流量或恶意攻击时，限流可以防止系统过载，确保核心服务的正常运行。本章将深入探讨服务限流的原理、算法实现以及在实际应用中的最佳实践。

## 限流的重要性

### 为什么需要服务限流？

在分布式系统中，服务限流具有以下重要意义：

1. **保护系统稳定性**：防止突发流量导致系统过载和崩溃
2. **保障服务质量**：确保核心服务在高负载下仍能正常响应
3. **资源合理分配**：避免某些服务占用过多系统资源
4. **防止恶意攻击**：抵御DDoS等恶意流量攻击
5. **成本控制**：避免因流量激增导致的资源成本大幅增加

### 限流的常见场景

1. **API网关限流**：对进入系统的请求进行统一限流
2. **微服务间调用限流**：防止某个服务的故障影响其他服务
3. **数据库访问限流**：保护数据库不被过多请求压垮
4. **第三方服务调用限流**：遵守第三方服务的调用频率限制

## 限流算法

### 计数器算法（Fixed Window）

计数器算法是最简单的限流算法，它在固定时间窗口内统计请求次数，当超过阈值时拒绝后续请求。

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class FixedWindowRateLimiter {
    private final int maxRequests;
    private final long windowSizeInMillis;
    private final ConcurrentHashMap<String, WindowCounter> counters = new ConcurrentHashMap<>();
    
    public FixedWindowRateLimiter(int maxRequests, long windowSizeInMillis) {
        this.maxRequests = maxRequests;
        this.windowSizeInMillis = windowSizeInMillis;
    }
    
    public boolean allowRequest(String key) {
        long currentTime = System.currentTimeMillis();
        long windowStart = currentTime - (currentTime % windowSizeInMillis);
        
        WindowCounter counter = counters.computeIfAbsent(key, k -> new WindowCounter(windowStart));
        
        synchronized (counter) {
            if (counter.windowStart == windowStart) {
                // 同一个时间窗口
                if (counter.count.get() < maxRequests) {
                    counter.count.incrementAndGet();
                    return true;
                } else {
                    return false;
                }
            } else {
                // 新的时间窗口
                counter.windowStart = windowStart;
                counter.count.set(1);
                return true;
            }
        }
    }
    
    private static class WindowCounter {
        volatile long windowStart;
        final AtomicInteger count = new AtomicInteger(0);
        
        WindowCounter(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}

// 使用示例
public class FixedWindowRateLimiterExample {
    public static void main(String[] args) throws InterruptedException {
        FixedWindowRateLimiter rateLimiter = new FixedWindowRateLimiter(5, 1000); // 每秒最多5个请求
        
        // 模拟请求
        for (int i = 0; i < 10; i++) {
            if (rateLimiter.allowRequest("user1")) {
                System.out.println("Request " + i + " allowed");
            } else {
                System.out.println("Request " + i + " denied");
            }
            Thread.sleep(200); // 每200毫秒发送一个请求
        }
    }
}
```

### 滑动窗口算法（Sliding Window）

滑动窗口算法是对计数器算法的改进，它将时间窗口划分为多个小的时间段，更精确地控制请求速率。

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class SlidingWindowRateLimiter {
    private final int maxRequests;
    private final long windowSizeInMillis;
    private final int segments;
    private final long segmentSizeInMillis;
    private final ConcurrentHashMap<String, SlidingWindow> windows = new ConcurrentHashMap<>();
    
    public SlidingWindowRateLimiter(int maxRequests, long windowSizeInMillis, int segments) {
        this.maxRequests = maxRequests;
        this.windowSizeInMillis = windowSizeInMillis;
        this.segments = segments;
        this.segmentSizeInMillis = windowSizeInMillis / segments;
    }
    
    public boolean allowRequest(String key) {
        long currentTime = System.currentTimeMillis();
        SlidingWindow window = windows.computeIfAbsent(key, k -> new SlidingWindow(segments));
        
        synchronized (window) {
            long currentSegment = currentTime / segmentSizeInMillis;
            
            // 清除过期的段
            for (int i = 0; i < segments; i++) {
                if (window.segments[i].segmentId < currentSegment - segments + 1) {
                    window.segments[i].count.set(0);
                    window.segments[i].segmentId = currentSegment - segments + 1 + i;
                }
            }
            
            // 找到当前段并增加计数
            Segment currentSegmentObj = null;
            for (int i = 0; i < segments; i++) {
                if (window.segments[i].segmentId == currentSegment) {
                    currentSegmentObj = window.segments[i];
                    break;
                }
            }
            
            if (currentSegmentObj == null) {
                // 创建新的段
                for (int i = 0; i < segments; i++) {
                    if (window.segments[i].segmentId < currentSegment) {
                        window.segments[i].segmentId = currentSegment;
                        window.segments[i].count.set(0);
                        currentSegmentObj = window.segments[i];
                        break;
                    }
                }
            }
            
            currentSegmentObj.count.incrementAndGet();
            
            // 计算当前窗口内的总请求数
            int totalCount = 0;
            for (int i = 0; i < segments; i++) {
                if (window.segments[i].segmentId >= currentSegment - segments + 1) {
                    totalCount += window.segments[i].count.get();
                }
            }
            
            return totalCount <= maxRequests;
        }
    }
    
    private static class SlidingWindow {
        final Segment[] segments;
        
        SlidingWindow(int segmentCount) {
            segments = new Segment[segmentCount];
            long currentSegment = System.currentTimeMillis() / (1000 / segmentCount);
            for (int i = 0; i < segmentCount; i++) {
                segments[i] = new Segment(currentSegment - segmentCount + 1 + i);
            }
        }
    }
    
    private static class Segment {
        volatile long segmentId;
        final AtomicInteger count = new AtomicInteger(0);
        
        Segment(long segmentId) {
            this.segmentId = segmentId;
        }
    }
}
```

### 令牌桶算法（Token Bucket）

令牌桶算法是一种基于令牌的限流算法，系统以恒定速率生成令牌，请求需要消耗令牌才能被处理。

```java
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class TokenBucketRateLimiter {
    private final int capacity;           // 桶的容量
    private final int refillTokens;       // 每次填充的令牌数
    private final long refillInterval;    // 填充间隔（毫秒）
    private final AtomicInteger tokens;   // 当前令牌数
    private final AtomicLong lastRefillTime; // 上次填充时间
    
    public TokenBucketRateLimiter(int capacity, int refillTokens, long refillInterval) {
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillInterval = refillInterval;
        this.tokens = new AtomicInteger(capacity);
        this.lastRefillTime = new AtomicLong(System.currentTimeMillis());
    }
    
    public boolean allowRequest() {
        refillTokens(); // 先填充令牌
        
        int currentTokens = tokens.get();
        if (currentTokens > 0) {
            return tokens.compareAndSet(currentTokens, currentTokens - 1);
        }
        return false;
    }
    
    private void refillTokens() {
        long currentTime = System.currentTimeMillis();
        long lastRefill = lastRefillTime.get();
        long timePassed = currentTime - lastRefill;
        
        if (timePassed >= refillInterval) {
            long newTokens = (timePassed / refillInterval) * refillTokens;
            long newRefillTime = lastRefill + (timePassed / refillInterval) * refillInterval;
            
            if (lastRefillTime.compareAndSet(lastRefill, newRefillTime)) {
                int currentTokens = tokens.get();
                int newTokenCount = (int) Math.min(capacity, currentTokens + newTokens);
                tokens.set(newTokenCount);
            }
        }
    }
    
    // 获取当前令牌数
    public int getAvailableTokens() {
        refillTokens();
        return tokens.get();
    }
}

// 使用示例
public class TokenBucketRateLimiterExample {
    public static void main(String[] args) throws InterruptedException {
        // 每秒生成2个令牌，桶容量为10
        TokenBucketRateLimiter rateLimiter = new TokenBucketRateLimiter(10, 2, 1000);
        
        // 模拟请求
        for (int i = 0; i < 20; i++) {
            if (rateLimiter.allowRequest()) {
                System.out.println("Request " + i + " allowed, tokens: " + rateLimiter.getAvailableTokens());
            } else {
                System.out.println("Request " + i + " denied, tokens: " + rateLimiter.getAvailableTokens());
            }
            Thread.sleep(300); // 每300毫秒发送一个请求
        }
    }
}
```

### 漏桶算法（Leaky Bucket）

漏桶算法是一种基于队列的限流算法，请求以任意速率进入漏桶，但以固定速率流出。

```java
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class LeakyBucketRateLimiter {
    private final BlockingQueue<Request> bucket;
    private final int leakRate; // 每秒漏出的请求数
    private final ScheduledExecutorService scheduler;
    
    public LeakyBucketRateLimiter(int capacity, int leakRate) {
        this.bucket = new LinkedBlockingQueue<>(capacity);
        this.leakRate = leakRate;
        this.scheduler = Executors.newSingleThreadScheduledExecutor();
        
        // 启动漏桶处理任务
        startLeakTask();
    }
    
    public boolean allowRequest(Request request) {
        return bucket.offer(request);
    }
    
    private void startLeakTask() {
        long interval = 1000 / leakRate; // 毫秒
        scheduler.scheduleAtFixedRate(() -> {
            Request request = bucket.poll();
            if (request != null) {
                // 处理请求
                processRequest(request);
            }
        }, interval, interval, TimeUnit.MILLISECONDS);
    }
    
    private void processRequest(Request request) {
        System.out.println("Processing request: " + request.getId());
        // 实际的请求处理逻辑
    }
    
    public int getQueueSize() {
        return bucket.size();
    }
    
    public void shutdown() {
        scheduler.shutdown();
    }
}

class Request {
    private final String id;
    private final long timestamp;
    
    public Request(String id) {
        this.id = id;
        this.timestamp = System.currentTimeMillis();
    }
    
    public String getId() {
        return id;
    }
    
    public long getTimestamp() {
        return timestamp;
    }
}
```

## 分布式限流

在分布式系统中，单机限流无法满足全局限流需求，需要实现分布式限流。

### 基于 Redis 的分布式限流

```java
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;

public class RedisRateLimiter {
    private final JedisPool jedisPool;
    private final int maxRequests;
    private final int windowSizeInSeconds;
    
    public RedisRateLimiter(JedisPool jedisPool, int maxRequests, int windowSizeInSeconds) {
        this.jedisPool = jedisPool;
        this.maxRequests = maxRequests;
        this.windowSizeInSeconds = windowSizeInSeconds;
    }
    
    public boolean allowRequest(String key) {
        try (Jedis jedis = jedisPool.getResource()) {
            String script = 
                "local key = KEYS[1] " +
                "local limit = tonumber(ARGV[1]) " +
                "local window = tonumber(ARGV[2]) " +
                "local current = redis.call('GET', key) " +
                "if current == false then " +
                "  redis.call('SET', key, 1) " +
                "  redis.call('EXPIRE', key, window) " +
                "  return 1 " +
                "else " +
                "  current = tonumber(current) " +
                "  if current < limit then " +
                "    redis.call('INCR', key) " +
                "    return 1 " +
                "  else " +
                "    return 0 " +
                "  end " +
                "end";
            
            Object result = jedis.eval(script, 1, key, String.valueOf(maxRequests), 
                                     String.valueOf(windowSizeInSeconds));
            return "1".equals(result.toString());
        }
    }
}

// 使用 Lua 脚本的滑动窗口限流
public class RedisSlidingWindowRateLimiter {
    private final JedisPool jedisPool;
    private final int maxRequests;
    private final int windowSizeInSeconds;
    
    public RedisSlidingWindowRateLimiter(JedisPool jedisPool, int maxRequests, int windowSizeInSeconds) {
        this.jedisPool = jedisPool;
        this.maxRequests = maxRequests;
        this.windowSizeInSeconds = windowSizeInSeconds;
    }
    
    public boolean allowRequest(String key) {
        try (Jedis jedis = jedisPool.getResource()) {
            long currentTime = System.currentTimeMillis();
            long windowStart = currentTime - (windowSizeInSeconds * 1000);
            
            String script = 
                "local key = KEYS[1] " +
                "local limit = tonumber(ARGV[1]) " +
                "local window_start = tonumber(ARGV[2]) " +
                "local current_time = tonumber(ARGV[3]) " +
                "redis.call('ZREMRANGEBYSCORE', key, 0, window_start) " +
                "local current_count = redis.call('ZCARD', key) " +
                "if current_count < limit then " +
                "  redis.call('ZADD', key, current_time, current_time) " +
                "  redis.call('EXPIRE', key, ARGV[4]) " +
                "  return 1 " +
                "else " +
                "  return 0 " +
                "end";
            
            Object result = jedis.eval(script, 1, key, String.valueOf(maxRequests), 
                                     String.valueOf(windowStart), String.valueOf(currentTime),
                                     String.valueOf(windowSizeInSeconds + 1));
            return "1".equals(result.toString());
        }
    }
}
```

## 限流在 RPC 框架中的应用

### 客户端限流

```java
public class RateLimitedRpcClient {
    private final RpcClient rpcClient;
    private final RateLimiter rateLimiter;
    
    public RateLimitedRpcClient(RpcClient rpcClient, RateLimiter rateLimiter) {
        this.rpcClient = rpcClient;
        this.rateLimiter = rateLimiter;
    }
    
    public CompletableFuture<RpcResponse> sendRequest(RpcRequest request) {
        if (!rateLimiter.allowRequest()) {
            CompletableFuture<RpcResponse> future = new CompletableFuture<>();
            future.completeExceptionally(new RpcException("Rate limit exceeded"));
            return future;
        }
        
        return rpcClient.sendRequest(request);
    }
}

// 基于服务的限流
public class ServiceBasedRateLimiter {
    private final Map<String, RateLimiter> serviceLimiters = new ConcurrentHashMap<>();
    private final RateLimiterConfig config;
    
    public ServiceBasedRateLimiter(RateLimiterConfig config) {
        this.config = config;
    }
    
    public boolean allowRequest(String serviceName) {
        RateLimiter limiter = serviceLimiters.computeIfAbsent(serviceName, 
            name -> new TokenBucketRateLimiter(
                config.getMaxRequests(serviceName),
                config.getRefillTokens(serviceName),
                config.getRefillInterval(serviceName)
            ));
        return limiter.allowRequest();
    }
}

class RateLimiterConfig {
    private final Map<String, ServiceRateLimitConfig> serviceConfigs = new ConcurrentHashMap<>();
    
    public int getMaxRequests(String serviceName) {
        ServiceRateLimitConfig config = serviceConfigs.get(serviceName);
        return config != null ? config.getMaxRequests() : 100;
    }
    
    public int getRefillTokens(String serviceName) {
        ServiceRateLimitConfig config = serviceConfigs.get(serviceName);
        return config != null ? config.getRefillTokens() : 10;
    }
    
    public long getRefillInterval(String serviceName) {
        ServiceRateLimitConfig config = serviceConfigs.get(serviceName);
        return config != null ? config.getRefillInterval() : 1000;
    }
    
    public void setServiceConfig(String serviceName, ServiceRateLimitConfig config) {
        serviceConfigs.put(serviceName, config);
    }
}

class ServiceRateLimitConfig {
    private final int maxRequests;
    private final int refillTokens;
    private final long refillInterval;
    
    public ServiceRateLimitConfig(int maxRequests, int refillTokens, long refillInterval) {
        this.maxRequests = maxRequests;
        this.refillTokens = refillTokens;
        this.refillInterval = refillInterval;
    }
    
    public int getMaxRequests() { return maxRequests; }
    public int getRefillTokens() { return refillTokens; }
    public long getRefillInterval() { return refillInterval; }
}
```

### 服务端限流

```java
public class RateLimitedRpcServer {
    private final RpcServer rpcServer;
    private final RateLimiter rateLimiter;
    private final Map<String, RateLimiter> clientLimiters = new ConcurrentHashMap<>();
    
    public RateLimitedRpcServer(RpcServer rpcServer, RateLimiter globalRateLimiter) {
        this.rpcServer = rpcServer;
        this.rateLimiter = globalRateLimiter;
    }
    
    public void handleRequest(RpcRequest request) {
        // 全局限流
        if (!rateLimiter.allowRequest()) {
            sendRateLimitResponse(request);
            return;
        }
        
        // 客户端限流
        String clientId = request.getClientId();
        if (clientId != null) {
            RateLimiter clientLimiter = clientLimiters.computeIfAbsent(clientId, 
                id -> new TokenBucketRateLimiter(100, 10, 1000)); // 每个客户端每秒10个请求
            if (!clientLimiter.allowRequest()) {
                sendRateLimitResponse(request);
                return;
            }
        }
        
        // 处理正常请求
        rpcServer.handleRequest(request);
    }
    
    private void sendRateLimitResponse(RpcRequest request) {
        RpcResponse response = new RpcResponse();
        response.setRequestId(request.getRequestId());
        response.setError(new RpcException("Rate limit exceeded"));
        // 发送响应给客户端
        sendResponse(response);
    }
    
    private void sendResponse(RpcResponse response) {
        // 实际的响应发送逻辑
    }
}
```

## 限流策略与最佳实践

### 动态限流配置

```java
public class DynamicRateLimiterConfig {
    private volatile RateLimiterConfig config = new RateLimiterConfig();
    private final ConfigChangeListener listener;
    
    public DynamicRateLimiterConfig(ConfigChangeListener listener) {
        this.listener = listener;
        // 初始化配置监听
        startConfigListening();
    }
    
    public RateLimiterConfig getConfig() {
        return config;
    }
    
    private void startConfigListening() {
        // 监听配置中心的配置变化
        // 这里简化处理，实际实现可能基于 ZooKeeper、Nacos、Consul 等
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(() -> {
            // 检查配置是否发生变化
            RateLimiterConfig newConfig = loadConfigFromSource();
            if (!newConfig.equals(config)) {
                RateLimiterConfig oldConfig = config;
                config = newConfig;
                listener.onConfigChanged(oldConfig, newConfig);
            }
        }, 0, 30, TimeUnit.SECONDS);
    }
    
    private RateLimiterConfig loadConfigFromSource() {
        // 从配置源加载配置
        return new RateLimiterConfig();
    }
}

interface ConfigChangeListener {
    void onConfigChanged(RateLimiterConfig oldConfig, RateLimiterConfig newConfig);
}
```

### 限流监控与告警

```java
public class RateLimitMetricsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> rateLimitCounters = new ConcurrentHashMap<>();
    
    public RateLimitMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordRateLimitExceeded(String serviceName, String clientId) {
        String counterKey = serviceName + ":" + (clientId != null ? clientId : "unknown");
        Counter counter = rateLimitCounters.computeIfAbsent(counterKey, key -> 
            Counter.builder("rate_limit.exceeded")
                .tag("service", serviceName)
                .tag("client", clientId != null ? clientId : "unknown")
                .register(meterRegistry)
        );
        counter.increment();
    }
    
    public void recordCurrentRate(String serviceName, double rate) {
        Gauge.builder("current.request.rate")
            .tag("service", serviceName)
            .register(meterRegistry, rate);
    }
    
    public void recordBucketFillRatio(String serviceName, double ratio) {
        Gauge.builder("bucket.fill.ratio")
            .tag("service", serviceName)
            .register(meterRegistry, ratio);
    }
}
```

### 优雅降级

```java
public class GracefulDegradationHandler {
    private final RateLimiter rateLimiter;
    private final DegradationStrategy degradationStrategy;
    
    public GracefulDegradationHandler(RateLimiter rateLimiter, DegradationStrategy strategy) {
        this.rateLimiter = rateLimiter;
        this.degradationStrategy = strategy;
    }
    
    public <T> T executeWithDegradation(Supplier<T> operation, Supplier<T> fallback) {
        if (rateLimiter.allowRequest()) {
            try {
                return operation.get();
            } catch (Exception e) {
                System.err.println("Operation failed, trying fallback: " + e.getMessage());
                return fallback.get();
            }
        } else {
            System.out.println("Rate limit exceeded, executing fallback");
            return fallback.get();
        }
    }
}

interface DegradationStrategy {
    <T> T provideFallback(Supplier<T> operation);
}

class CacheFallbackStrategy implements DegradationStrategy {
    private final Map<String, Object> cache = new ConcurrentHashMap<>();
    
    @Override
    @SuppressWarnings("unchecked")
    public <T> T provideFallback(Supplier<T> operation) {
        String key = operation.getClass().getName();
        T cached = (T) cache.get(key);
        if (cached != null) {
            System.out.println("Returning cached result for: " + key);
            return cached;
        } else {
            System.out.println("No cached result available for: " + key);
            return null;
        }
    }
    
    public <T> void cacheResult(String key, T result) {
        cache.put(key, result);
    }
}
```

## 总结

服务限流是构建高可用分布式系统的重要机制。通过合理选择和实现限流算法，结合分布式环境下的特殊需求，我们可以有效保护系统免受流量冲击，确保核心服务的稳定运行。

关键要点：

1. **算法选择**：根据业务场景选择合适的限流算法（计数器、滑动窗口、令牌桶、漏桶）
2. **分布式支持**：在分布式环境中使用 Redis 等共享存储实现全局限流
3. **动态配置**：支持运行时动态调整限流参数
4. **监控告警**：跟踪限流指标，及时发现和处理问题
5. **优雅降级**：在限流触发时提供合理的降级方案

在实际应用中，需要根据具体业务场景和系统要求来选择合适的限流策略，并持续监控和优化限流配置，以达到最佳的平衡点。通过本章的学习，您应该能够理解各种限流算法的原理和实现，并能够在实际项目中应用这些知识来构建更加稳定的分布式系统。