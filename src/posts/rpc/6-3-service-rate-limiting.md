---
title: 服务限流
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在高并发的分布式系统中，服务限流是保护系统稳定性的关键机制之一。当系统面临突发流量或恶意攻击时，如果没有合理的限流措施，可能会导致系统资源耗尽、响应时间急剧增加，甚至整个系统崩溃。服务限流通过控制请求的处理速率，确保系统在可承受的范围内稳定运行。本章将深入探讨服务限流的原理、算法实现以及在实际系统中的应用。

## 限流的必要性

### 为什么需要服务限流？

在分布式系统中，服务限流的重要性体现在以下几个方面：

1. **保护系统资源**：防止突发流量耗尽系统资源（CPU、内存、数据库连接等）
2. **保证服务质量**：确保核心服务在高负载下仍能正常响应
3. **防止级联故障**：避免一个服务的故障影响到整个系统
4. **公平资源分配**：合理分配系统资源给不同的用户或服务

### 限流的常见场景

1. **API 接口限流**：限制每个用户或 IP 的请求频率
2. **微服务间调用限流**：控制服务间的调用频率
3. **数据库访问限流**：保护数据库不被过多请求压垮
4. **第三方服务调用限流**：遵守第三方服务的调用限制

## 限流算法

### 固定窗口算法（Fixed Window）

固定窗口算法是最简单的限流算法，它将时间划分为固定大小的窗口，在每个窗口内限制请求的数量。

```java
public class FixedWindowRateLimiter {
    private final long windowSizeInMillis;
    private final int maxRequests;
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();
    
    public FixedWindowRateLimiter(int maxRequests, long windowSizeInMillis) {
        this.maxRequests = maxRequests;
        this.windowSizeInMillis = windowSizeInMillis;
    }
    
    public boolean tryAcquire(String key) {
        long currentTime = System.currentTimeMillis();
        long windowStart = currentTime - (currentTime % windowSizeInMillis);
        
        WindowCounter counter = counters.computeIfAbsent(key, k -> new WindowCounter());
        
        synchronized (counter) {
            if (counter.windowStart != windowStart) {
                // 新的时间窗口，重置计数器
                counter.windowStart = windowStart;
                counter.count = 0;
            }
            
            if (counter.count < maxRequests) {
                counter.count++;
                return true;
            } else {
                return false;
            }
        }
    }
    
    private static class WindowCounter {
        volatile long windowStart = 0;
        volatile int count = 0;
    }
}

// 使用示例
public class FixedWindowExample {
    public static void main(String[] args) throws InterruptedException {
        FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(5, 1000); // 每秒最多5个请求
        
        // 模拟请求
        for (int i = 0; i < 10; i++) {
            if (limiter.tryAcquire("user1")) {
                System.out.println("Request " + i + " allowed at " + System.currentTimeMillis());
            } else {
                System.out.println("Request " + i + " denied at " + System.currentTimeMillis());
            }
            Thread.sleep(200); // 每200ms发送一个请求
        }
    }
}
```

固定窗口算法的优点是实现简单，但存在"边界效应"问题，即在窗口切换时可能出现突发流量。

### 滑动窗口算法（Sliding Window）

滑动窗口算法通过维护一个滑动的时间窗口来更精确地控制请求速率。

```java
public class SlidingWindowRateLimiter {
    private final int maxRequests;
    private final long windowSizeInMillis;
    private final Map<String, RequestWindow> windows = new ConcurrentHashMap<>();
    
    public SlidingWindowRateLimiter(int maxRequests, long windowSizeInMillis) {
        this.maxRequests = maxRequests;
        this.windowSizeInMillis = windowSizeInMillis;
    }
    
    public boolean tryAcquire(String key) {
        long currentTime = System.currentTimeMillis();
        RequestWindow window = windows.computeIfAbsent(key, k -> new RequestWindow());
        
        synchronized (window) {
            // 移除窗口外的请求记录
            window.requests.removeIf(timestamp -> currentTime - timestamp > windowSizeInMillis);
            
            if (window.requests.size() < maxRequests) {
                window.requests.add(currentTime);
                return true;
            } else {
                return false;
            }
        }
    }
    
    private static class RequestWindow {
        final List<Long> requests = new LinkedList<>();
    }
}

// 使用示例
public class SlidingWindowExample {
    public static void main(String[] args) throws InterruptedException {
        SlidingWindowRateLimiter limiter = new SlidingWindowRateLimiter(5, 1000); // 1秒内最多5个请求
        
        // 模拟请求
        for (int i = 0; i < 10; i++) {
            if (limiter.tryAcquire("user1")) {
                System.out.println("Request " + i + " allowed");
            } else {
                System.out.println("Request " + i + " denied");
            }
            Thread.sleep(200);
        }
    }
}
```

滑动窗口算法比固定窗口算法更精确，但需要维护更多的状态信息。

### 令牌桶算法（Token Bucket）

令牌桶算法是一种基于令牌的限流算法，系统以恒定速率生成令牌，请求需要消耗令牌才能被处理。

```java
public class TokenBucketRateLimiter {
    private final int capacity;           // 桶的容量
    private final int refillTokens;       // 每次填充的令牌数
    private final long refillInterval;    // 填充间隔（毫秒）
    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    
    public TokenBucketRateLimiter(int capacity, int refillTokens, long refillInterval) {
        this.capacity = capacity;
        this.refillTokens = refillTokens;
        this.refillInterval = refillInterval;
    }
    
    public boolean tryAcquire(String key, int tokens) {
        long currentTime = System.currentTimeMillis();
        TokenBucket bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(capacity));
        
        synchronized (bucket) {
            // 计算需要添加的令牌数
            long elapsed = currentTime - bucket.lastRefillTimestamp;
            long tokensToAdd = (elapsed / refillInterval) * refillTokens;
            
            if (tokensToAdd > 0) {
                bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
                bucket.lastRefillTimestamp = currentTime;
            }
            
            if (bucket.tokens >= tokens) {
                bucket.tokens -= tokens;
                return true;
            } else {
                return false;
            }
        }
    }
    
    public boolean tryAcquire(String key) {
        return tryAcquire(key, 1);
    }
    
    private static class TokenBucket {
        volatile int tokens;
        volatile long lastRefillTimestamp;
        final int capacity;
        
        TokenBucket(int capacity) {
            this.capacity = capacity;
            this.tokens = capacity;
            this.lastRefillTimestamp = System.currentTimeMillis();
        }
    }
}

// 使用示例
public class TokenBucketExample {
    public static void main(String[] args) throws InterruptedException {
        // 每秒生成2个令牌，桶容量为10
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(10, 2, 1000);
        
        // 模拟请求
        for (int i = 0; i < 20; i++) {
            if (limiter.tryAcquire("user1")) {
                System.out.println("Request " + i + " allowed");
            } else {
                System.out.println("Request " + i + " denied");
            }
            Thread.sleep(300); // 每300ms发送一个请求
        }
    }
}
```

令牌桶算法允许一定程度的突发流量，同时能够平滑地控制平均速率。

### 漏桶算法（Leaky Bucket）

漏桶算法是一种严格控制请求速率的算法，请求被放入漏桶中，系统以恒定速率处理请求。

```java
public class LeakyBucketRateLimiter {
    private final int capacity;        // 桶的容量
    private final int leakRate;        // 漏水速率（每秒处理的请求数）
    private final Map<String, LeakyBucket> buckets = new ConcurrentHashMap<>();
    
    public LeakyBucketRateLimiter(int capacity, int leakRate) {
        this.capacity = capacity;
        this.leakRate = leakRate;
    }
    
    public boolean tryAcquire(String key) {
        long currentTime = System.currentTimeMillis();
        LeakyBucket bucket = buckets.computeIfAbsent(key, k -> new LeakyBucket(capacity));
        
        synchronized (bucket) {
            // 计算需要漏出的请求数
            long elapsed = currentTime - bucket.lastLeakTimestamp;
            int leaked = (int) (elapsed * leakRate / 1000);
            
            if (leaked > 0) {
                bucket.water = Math.max(0, bucket.water - leaked);
                bucket.lastLeakTimestamp = currentTime;
            }
            
            if (bucket.water < capacity) {
                bucket.water++;
                return true;
            } else {
                return false;
            }
        }
    }
    
    private static class LeakyBucket {
        volatile int water = 0;          // 当前水量
        volatile long lastLeakTimestamp; // 上次漏水时间
        final int capacity;
        
        LeakyBucket(int capacity) {
            this.capacity = capacity;
            this.lastLeakTimestamp = System.currentTimeMillis();
        }
    }
}

// 使用示例
public class LeakyBucketExample {
    public static void main(String[] args) throws InterruptedException {
        // 桶容量为10，每秒处理3个请求
        LeakyBucketRateLimiter limiter = new LeakyBucketRateLimiter(10, 3);
        
        // 模拟请求
        for (int i = 0; i < 20; i++) {
            if (limiter.tryAcquire("user1")) {
                System.out.println("Request " + i + " allowed");
            } else {
                System.out.println("Request " + i + " denied");
            }
            Thread.sleep(200); // 每200ms发送一个请求
        }
    }
}
```

漏桶算法能够严格控制请求的处理速率，但不允许突发流量。

## 分布式限流

在分布式系统中，单机限流无法满足全局限流的需求，需要实现分布式限流。

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
    
    public boolean tryAcquire(String key) {
        String script = 
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
            "  if current < limit then\n" +
            "    redis.call('INCR', key)\n" +
            "    return 1\n" +
            "  else\n" +
            "    return 0\n" +
            "  end\n" +
            "end";
        
        try (Jedis jedis = jedisPool.getResource()) {
            Object result = jedis.eval(script, 
                Collections.singletonList("rate_limit:" + key),
                Arrays.asList(String.valueOf(maxRequests), String.valueOf(windowSizeInSeconds)));
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
    
    public boolean tryAcquire(String key) {
        String script = 
            "local key = KEYS[1]\n" +
            "local limit = tonumber(ARGV[1])\n" +
            "local window = tonumber(ARGV[2])\n" +
            "local now = tonumber(ARGV[3])\n" +
            "local window_start = now - window\n" +
            "\n" +
            "-- 移除窗口外的记录\n" +
            "redis.call('ZREMRANGEBYSCORE', key, 0, window_start)\n" +
            "\n" +
            "-- 获取当前窗口内的请求数\n" +
            "local current_count = redis.call('ZCARD', key)\n" +
            "\n" +
            "-- 检查是否超过限制\n" +
            "if current_count < limit then\n" +
            "  redis.call('ZADD', key, now, now)\n" +
            "  redis.call('EXPIRE', key, window)\n" +
            "  return 1\n" +
            "else\n" +
            "  return 0\n" +
            "end";
        
        try (Jedis jedis = jedisPool.getResource()) {
            Object result = jedis.eval(script,
                Collections.singletonList("sliding_window:" + key),
                Arrays.asList(
                    String.valueOf(maxRequests),
                    String.valueOf(windowSizeInSeconds),
                    String.valueOf(System.currentTimeMillis() / 1000)
                ));
            return "1".equals(result.toString());
        }
    }
}
```

### 基于 Sentinel 的限流

Sentinel 是阿里巴巴开源的流量控制组件，提供了丰富的限流功能。

```java
import com.alibaba.csp.sentinel.Entry;
import com.alibaba.csp.sentinel.SphU;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.alibaba.csp.sentinel.slots.block.RuleConstant;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRule;
import com.alibaba.csp.sentinel.slots.block.flow.FlowRuleManager;

public class SentinelRateLimiter {
    
    public void initFlowRules() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule();
        rule.setResource("getUser"); // 资源名称
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS); // 限流指标
        rule.setCount(10); // 每秒最多10个请求
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }
    
    public String getUser(String userId) {
        Entry entry = null;
        try {
            entry = SphU.entry("getUser");
            // 被保护的业务逻辑
            return fetchUserFromDatabase(userId);
        } catch (BlockException e) {
            // 被限流时的处理逻辑
            System.err.println("Request blocked by Sentinel: " + e.getMessage());
            return "Service temporarily unavailable";
        } finally {
            if (entry != null) {
                entry.exit();
            }
        }
    }
    
    private String fetchUserFromDatabase(String userId) {
        // 模拟数据库查询
        return "User: " + userId;
    }
}
```

## 自适应限流

自适应限流根据系统的实时状态动态调整限流策略。

```java
public class AdaptiveRateLimiter {
    private final int baseRate; // 基础限流速率
    private final SystemMetricsCollector metricsCollector;
    private final AtomicLong currentRate; // 当前限流速率
    
    public AdaptiveRateLimiter(int baseRate, SystemMetricsCollector metricsCollector) {
        this.baseRate = baseRate;
        this.metricsCollector = metricsCollector;
        this.currentRate = new AtomicLong(baseRate);
    }
    
    public boolean tryAcquire(String key) {
        // 根据系统状态调整限流速率
        adjustRate();
        
        // 使用令牌桶算法进行限流
        return acquireWithTokenBucket(key, currentRate.get());
    }
    
    private void adjustRate() {
        SystemMetrics metrics = metricsCollector.getMetrics();
        
        // 根据 CPU 使用率调整
        if (metrics.getCpuUsage() > 80) {
            // CPU 使用率过高，降低限流速率
            currentRate.updateAndGet(current -> Math.max(baseRate / 2, current * 9 / 10));
        } else if (metrics.getCpuUsage() < 50) {
            // CPU 使用率较低，提高限流速率
            currentRate.updateAndGet(current -> Math.min(baseRate * 2, current * 11 / 10));
        }
        
        // 根据内存使用率调整
        if (metrics.getMemoryUsage() > 90) {
            // 内存使用率过高，大幅降低限流速率
            currentRate.updateAndGet(current -> Math.max(baseRate / 4, current / 2));
        }
        
        // 根据响应时间调整
        if (metrics.getAverageResponseTime() > 1000) {
            // 响应时间过长，降低限流速率
            currentRate.updateAndGet(current -> Math.max(baseRate / 3, current * 2 / 3));
        }
    }
    
    private boolean acquireWithTokenBucket(String key, long rate) {
        // 实现令牌桶算法
        // 这里简化处理，实际实现会更复杂
        return true;
    }
}

class SystemMetrics {
    private final double cpuUsage;
    private final double memoryUsage;
    private final long averageResponseTime;
    
    public SystemMetrics(double cpuUsage, double memoryUsage, long averageResponseTime) {
        this.cpuUsage = cpuUsage;
        this.memoryUsage = memoryUsage;
        this.averageResponseTime = averageResponseTime;
    }
    
    public double getCpuUsage() { return cpuUsage; }
    public double getMemoryUsage() { return memoryUsage; }
    public long getAverageResponseTime() { return averageResponseTime; }
}

class SystemMetricsCollector {
    public SystemMetrics getMetrics() {
        // 模拟获取系统指标
        // 实际实现会从系统监控中获取真实数据
        double cpuUsage = Math.random() * 100;
        double memoryUsage = Math.random() * 100;
        long avgResponseTime = (long) (Math.random() * 2000);
        
        return new SystemMetrics(cpuUsage, memoryUsage, avgResponseTime);
    }
}
```

## 限流在 RPC 框架中的应用

### 客户端限流

```java
public class RpcClientWithRateLimiting {
    private final RateLimiter rateLimiter;
    private final RpcClient rpcClient;
    
    public RpcClientWithRateLimiting(RpcClient rpcClient, int requestsPerSecond) {
        this.rpcClient = rpcClient;
        this.rateLimiter = RateLimiter.create(requestsPerSecond);
    }
    
    public <T> CompletableFuture<T> sendRequest(RpcRequest request, Class<T> responseType) {
        if (rateLimiter.tryAcquire()) {
            return rpcClient.sendRequest(request, responseType);
        } else {
            CompletableFuture<T> future = new CompletableFuture<>();
            future.completeExceptionally(new RpcException("Rate limit exceeded"));
            return future;
        }
    }
}
```

### 服务端限流

```java
public class RpcServerWithRateLimiting {
    private final Map<String, RateLimiter> serviceLimiters = new ConcurrentHashMap<>();
    private final RpcServer rpcServer;
    
    public RpcServerWithRateLimiting(RpcServer rpcServer) {
        this.rpcServer = rpcServer;
        // 为不同服务设置不同的限流规则
        serviceLimiters.put("UserService", RateLimiter.create(100)); // 每秒100个请求
        serviceLimiters.put("OrderService", RateLimiter.create(50)); // 每秒50个请求
    }
    
    public void handleRequest(RpcRequest request) {
        String serviceName = request.getServiceName();
        RateLimiter limiter = serviceLimiters.get(serviceName);
        
        if (limiter != null && !limiter.tryAcquire()) {
            // 限流
            sendRateLimitResponse(request);
            return;
        }
        
        // 处理请求
        rpcServer.handleRequest(request);
    }
    
    private void sendRateLimitResponse(RpcRequest request) {
        RpcResponse response = new RpcResponse();
        response.setRequestId(request.getRequestId());
        response.setError(new RpcException("Service rate limit exceeded"));
        // 发送响应
    }
}
```

## 限流监控与告警

### 限流指标收集

```java
public class RateLimitMetricsCollector {
    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> allowedCounters = new ConcurrentHashMap<>();
    private final Map<String, Counter> deniedCounters = new ConcurrentHashMap<>();
    
    public RateLimitMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordAllowed(String resource) {
        Counter counter = allowedCounters.computeIfAbsent(resource, 
            k -> Counter.builder("rate_limit.allowed")
                .tag("resource", resource)
                .register(meterRegistry));
        counter.increment();
    }
    
    public void recordDenied(String resource) {
        Counter counter = deniedCounters.computeIfAbsent(resource,
            k -> Counter.builder("rate_limit.denied")
                .tag("resource", resource)
                .register(meterRegistry));
        counter.increment();
    }
    
    public double getAllowedRate(String resource) {
        Counter allowed = allowedCounters.get(resource);
        Counter denied = deniedCounters.get(resource);
        
        if (allowed == null) return 0;
        long allowedCount = (long) allowed.count();
        long deniedCount = denied != null ? (long) denied.count() : 0;
        long totalCount = allowedCount + deniedCount;
        
        return totalCount > 0 ? (double) allowedCount / totalCount : 0;
    }
}
```

### 限流告警

```java
public class RateLimitAlertManager {
    private final RateLimitMetricsCollector metricsCollector;
    private final AlertNotifier alertNotifier;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final Map<String, Double> thresholdMap = new ConcurrentHashMap<>();
    
    public RateLimitAlertManager(RateLimitMetricsCollector metricsCollector, 
                               AlertNotifier alertNotifier) {
        this.metricsCollector = metricsCollector;
        this.alertNotifier = alertNotifier;
        
        // 设置告警阈值
        thresholdMap.put("UserService", 0.95); // 拒绝率超过5%时告警
        thresholdMap.put("OrderService", 0.90); // 拒绝率超过10%时告警
        
        // 定时检查
        scheduler.scheduleAtFixedRate(this::checkAndAlert, 0, 60, TimeUnit.SECONDS);
    }
    
    private void checkAndAlert() {
        for (Map.Entry<String, Double> entry : thresholdMap.entrySet()) {
            String resource = entry.getKey();
            Double threshold = entry.getValue();
            
            double allowedRate = metricsCollector.getAllowedRate(resource);
            double deniedRate = 1.0 - allowedRate;
            
            if (deniedRate > (1.0 - threshold)) {
                String alertMessage = String.format(
                    "Rate limit alert for %s: %.2f%% requests denied", 
                    resource, deniedRate * 100);
                alertNotifier.sendAlert(alertMessage);
            }
        }
    }
}

interface AlertNotifier {
    void sendAlert(String message);
}

class LoggingAlertNotifier implements AlertNotifier {
    private static final Logger logger = LoggerFactory.getLogger(LoggingAlertNotifier.class);
    
    @Override
    public void sendAlert(String message) {
        logger.warn("ALERT: {}", message);
    }
}
```

## 总结

服务限流是保障分布式系统稳定性的重要手段。通过合理选择和实现限流算法，我们可以有效控制系统负载，防止资源耗尽和级联故障。

关键要点：

1. **算法选择**：根据业务需求选择合适的限流算法（固定窗口、滑动窗口、令牌桶、漏桶）
2. **分布式实现**：在分布式环境中使用 Redis 或专门的限流组件（如 Sentinel）
3. **自适应调整**：根据系统实时状态动态调整限流策略
4. **监控告警**：建立完善的监控体系，及时发现和处理限流异常
5. **客户端与服务端协同**：在客户端和服务端都实施限流措施

在实际应用中，需要根据具体的业务场景和系统架构来设计限流方案，并进行充分的测试和调优。通过合理的限流策略，我们可以构建出更加稳定、可靠的分布式系统。

至此，我们已经完成了第6章"容错与高可用设计"的所有文章。在下一章中，我们将开始探讨主流 RPC 框架的深度解析。