---
title: 熔断与降级（参考 Hystrix、Resilience4j）
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在分布式系统中，服务之间的依赖关系错综复杂，一个服务的故障可能会引发连锁反应，导致整个系统崩溃。熔断器模式和降级机制是应对这种问题的有效手段，它们能够防止故障扩散，提高系统的稳定性和可用性。本章将深入探讨熔断与降级的原理、实现以及在主流框架中的应用。

## 熔断器模式原理

### 什么是熔断器模式？

熔断器模式（Circuit Breaker Pattern）源于物理学中的电路保护装置。在软件系统中，熔断器用于监控服务调用的状态，当失败率达到一定阈值时，熔断器会"跳闸"，阻止后续请求继续发送到故障服务，从而避免系统资源的浪费和故障的扩散。

### 熔断器的三种状态

熔断器通常有三种状态：

1. **关闭状态（Closed）**：正常状态下，允许请求通过
2. **打开状态（Open）**：当失败率达到阈值时，熔断器打开，拒绝所有请求
3. **半开状态（Half-Open）**：经过一段时间后，允许少量请求通过以测试服务是否恢复

```java
public enum CircuitBreakerState {
    CLOSED,   // 关闭状态
    OPEN,     // 打开状态
    HALF_OPEN // 半开状态
}
```

### 熔断器核心组件

一个完整的熔断器实现需要包含以下核心组件：

```java
public class CircuitBreaker {
    private final String name;
    private volatile CircuitBreakerState state = CircuitBreakerState.CLOSED;
    private final int failureThreshold;      // 失败阈值
    private final long timeout;              // 熔断超时时间
    private final int requestVolumeThreshold; // 请求量阈值
    private int failureCount = 0;            // 失败计数
    private int successCount = 0;            // 成功计数
    private long lastFailureTime = 0;        // 最后一次失败时间
    
    public CircuitBreaker(String name, int failureThreshold, long timeout, int requestVolumeThreshold) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.timeout = timeout;
        this.requestVolumeThreshold = requestVolumeThreshold;
    }
    
    public boolean canPass() {
        switch (state) {
            case CLOSED:
                return true;
            case OPEN:
                // 检查是否可以进入半开状态
                if (System.currentTimeMillis() - lastFailureTime > timeout) {
                    state = CircuitBreakerState.HALF_OPEN;
                    successCount = 0;
                    return true;
                }
                return false;
            case HALF_OPEN:
                // 半开状态下允许部分请求通过
                return true;
            default:
                return true;
        }
    }
    
    public void recordSuccess() {
        switch (state) {
            case CLOSED:
                failureCount = 0; // 重置失败计数
                break;
            case OPEN:
                // OPEN状态下不应该有成功记录
                break;
            case HALF_OPEN:
                successCount++;
                // 如果成功次数达到阈值，恢复到关闭状态
                if (successCount >= requestVolumeThreshold) {
                    state = CircuitBreakerState.CLOSED;
                    failureCount = 0;
                }
                break;
        }
    }
    
    public void recordFailure() {
        switch (state) {
            case CLOSED:
                failureCount++;
                lastFailureTime = System.currentTimeMillis();
                // 如果失败次数达到阈值，进入打开状态
                if (failureCount >= failureThreshold) {
                    state = CircuitBreakerState.OPEN;
                }
                break;
            case OPEN:
                // OPEN状态下更新最后失败时间
                lastFailureTime = System.currentTimeMillis();
                break;
            case HALF_OPEN:
                // 半开状态下失败，重新进入打开状态
                state = CircuitBreakerState.OPEN;
                lastFailureTime = System.currentTimeMillis();
                break;
        }
    }
    
    public CircuitBreakerState getState() {
        return state;
    }
}
```

## 熔断器实现

### 基础熔断器实现

```java
public class SimpleCircuitBreaker {
    private final CircuitBreaker circuitBreaker;
    private final long timeoutMs;
    
    public SimpleCircuitBreaker(String name) {
        this.circuitBreaker = new CircuitBreaker(name, 5, 60000, 3); // 5次失败后熔断，60秒恢复，3次成功后恢复
        this.timeoutMs = 5000; // 5秒超时
    }
    
    public <T> T execute(Supplier<T> supplier) throws Exception {
        if (!circuitBreaker.canPass()) {
            throw new CircuitBreakerOpenException("Circuit breaker is open for " + circuitBreaker.name);
        }
        
        try {
            // 执行业务逻辑
            T result = withTimeout(supplier, timeoutMs);
            circuitBreaker.recordSuccess();
            return result;
        } catch (Exception e) {
            circuitBreaker.recordFailure();
            throw e;
        }
    }
    
    private <T> T withTimeout(Supplier<T> supplier, long timeoutMs) throws Exception {
        CompletableFuture<T> future = CompletableFuture.supplyAsync(supplier);
        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new TimeoutException("Execution timed out after " + timeoutMs + "ms");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof Exception) {
                throw (Exception) e.getCause();
            }
            throw e;
        }
    }
}

class CircuitBreakerOpenException extends Exception {
    public CircuitBreakerOpenException(String message) {
        super(message);
    }
}
```

### 带统计信息的熔断器

```java
public class AdvancedCircuitBreaker {
    private final CircuitBreaker circuitBreaker;
    private final MetricsCollector metricsCollector;
    private final long timeoutMs;
    
    public AdvancedCircuitBreaker(String name) {
        this.circuitBreaker = new CircuitBreaker(name, 5, 60000, 3);
        this.metricsCollector = new MetricsCollector(name);
        this.timeoutMs = 5000;
    }
    
    public <T> T execute(Supplier<T> supplier) throws Exception {
        long startTime = System.currentTimeMillis();
        boolean success = false;
        
        try {
            if (!circuitBreaker.canPass()) {
                metricsCollector.recordRejected();
                throw new CircuitBreakerOpenException("Circuit breaker is open for " + circuitBreaker.name);
            }
            
            T result = withTimeout(supplier, timeoutMs);
            success = true;
            circuitBreaker.recordSuccess();
            return result;
        } catch (Exception e) {
            if (!success) {
                circuitBreaker.recordFailure();
            }
            throw e;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            if (success) {
                metricsCollector.recordSuccess(duration);
            } else {
                metricsCollector.recordFailure(duration);
            }
        }
    }
    
    private <T> T withTimeout(Supplier<T> supplier, long timeoutMs) throws Exception {
        CompletableFuture<T> future = CompletableFuture.supplyAsync(supplier);
        try {
            return future.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new TimeoutException("Execution timed out after " + timeoutMs + "ms");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof Exception) {
                throw (Exception) e.getCause();
            }
            throw e;
        }
    }
    
    public CircuitBreakerState getState() {
        return circuitBreaker.getState();
    }
    
    public Metrics getMetrics() {
        return metricsCollector.getMetrics();
    }
}

class MetricsCollector {
    private final String name;
    private final AtomicLong successCount = new AtomicLong(0);
    private final AtomicLong failureCount = new AtomicLong(0);
    private final AtomicLong rejectedCount = new AtomicLong(0);
    private final AtomicLong totalLatency = new AtomicLong(0);
    private final AtomicLong minLatency = new AtomicLong(Long.MAX_VALUE);
    private final AtomicLong maxLatency = new AtomicLong(0);
    
    public MetricsCollector(String name) {
        this.name = name;
    }
    
    public void recordSuccess(long latency) {
        successCount.incrementAndGet();
        totalLatency.addAndGet(latency);
        minLatency.updateAndGet(current -> Math.min(current, latency));
        maxLatency.updateAndGet(current -> Math.max(current, latency));
    }
    
    public void recordFailure(long latency) {
        failureCount.incrementAndGet();
        totalLatency.addAndGet(latency);
        minLatency.updateAndGet(current -> Math.min(current, latency));
        maxLatency.updateAndGet(current -> Math.max(current, latency));
    }
    
    public void recordRejected() {
        rejectedCount.incrementAndGet();
    }
    
    public Metrics getMetrics() {
        long success = successCount.get();
        long failure = failureCount.get();
        long rejected = rejectedCount.get();
        long total = success + failure;
        long totalLat = totalLatency.get();
        long avgLatency = total > 0 ? totalLat / total : 0;
        
        return new Metrics(name, success, failure, rejected, avgLatency, 
                          minLatency.get(), maxLatency.get());
    }
}

class Metrics {
    private final String name;
    private final long successCount;
    private final long failureCount;
    private final long rejectedCount;
    private final long averageLatency;
    private final long minLatency;
    private final long maxLatency;
    
    public Metrics(String name, long successCount, long failureCount, long rejectedCount,
                   long averageLatency, long minLatency, long maxLatency) {
        this.name = name;
        this.successCount = successCount;
        this.failureCount = failureCount;
        this.rejectedCount = rejectedCount;
        this.averageLatency = averageLatency;
        this.minLatency = minLatency;
        this.maxLatency = maxLatency;
    }
    
    // getter methods
    public String getName() { return name; }
    public long getSuccessCount() { return successCount; }
    public long getFailureCount() { return failureCount; }
    public long getRejectedCount() { return rejectedCount; }
    public long getAverageLatency() { return averageLatency; }
    public long getMinLatency() { return minLatency; }
    public long getMaxLatency() { return maxLatency; }
    
    public double getErrorPercentage() {
        long total = successCount + failureCount;
        return total > 0 ? (double) failureCount / total * 100 : 0;
    }
    
    @Override
    public String toString() {
        return String.format(
            "Metrics{name='%s', success=%d, failure=%d, rejected=%d, errorRate=%.2f%%, " +
            "avgLatency=%dms, minLatency=%dms, maxLatency=%dms}",
            name, successCount, failureCount, rejectedCount, getErrorPercentage(),
            averageLatency, minLatency, maxLatency);
    }
}
```

## Hystrix 实现分析

### Hystrix 简介

Hystrix 是 Netflix 开源的容错库，旨在通过添加延迟容忍和容错逻辑来控制分布式服务之间的交互。Hystrix 通过隔离服务之间的访问点、阻止级联故障并在复杂的分布式系统中实现恢复能力来提高系统的整体弹性。

### Hystrix 核心概念

```java
// Hystrix 命令示例
public class UserCommand extends HystrixCommand<User> {
    private final UserService userService;
    private final String userId;
    
    protected UserCommand(UserService userService, String userId) {
        super(Setter.withGroupKey(HystrixCommandGroupKey.Factory.asKey("UserGroup"))
                .andCommandKey(HystrixCommandKey.Factory.asKey("GetUser"))
                .andThreadPoolKey(HystrixThreadPoolKey.Factory.asKey("UserThreadPool"))
                .andCommandPropertiesDefaults(
                        HystrixCommandProperties.Setter()
                                .withExecutionTimeoutInMilliseconds(5000)
                                .withCircuitBreakerRequestVolumeThreshold(10)
                                .withCircuitBreakerSleepWindowInMilliseconds(10000)
                                .withCircuitBreakerErrorThresholdPercentage(50)
                )
                .andThreadPoolPropertiesDefaults(
                        HystrixThreadPoolProperties.Setter()
                                .withCoreSize(10)
                                .withMaximumSize(20)
                                .withMaxQueueSize(100)
                ));
        this.userService = userService;
        this.userId = userId;
    }
    
    @Override
    protected User run() throws Exception {
        // 实际业务逻辑
        return userService.getUserById(userId);
    }
    
    @Override
    protected User getFallback() {
        // 降级逻辑
        return new User("default", "Default User");
    }
}
```

### Hystrix 熔断器机制

Hystrix 的熔断器机制包括以下关键参数：

1. **请求量阈值（RequestVolumeThreshold）**：熔断器是否打开需要统计的最小请求数
2. **错误百分比阈值（ErrorThresholdPercentage）**：当错误百分比超过此值时，熔断器打开
3. **休眠窗口（SleepWindowInMilliseconds）**：熔断器打开后，经过多长时间允许一次请求通过

```java
// Hystrix 熔断器状态检查逻辑
public class HystrixCircuitBreakerImpl implements HystrixCircuitBreaker {
    private final HystrixCommandProperties properties;
    private final String circuitBreakerName;
    private final AtomicInteger circuitOpenOrPending = new AtomicInteger(0);
    private volatile long circuitOpenedOrLastTestedTime = 0;
    
    @Override
    public boolean isOpen() {
        if (circuitOpenOrPending.get() == 0) {
            // 熔断器关闭，检查是否应该打开
            HealthCounts health = metrics.getHealthCounts();
            
            // 检查请求量是否达到阈值
            if (health.getTotalRequests() < properties.circuitBreakerRequestVolumeThreshold().get()) {
                // 请求量不足，不打开熔断器
                return false;
            }
            
            // 检查错误百分比是否超过阈值
            if (health.getErrorPercentage() < properties.circuitBreakerErrorThresholdPercentage().get()) {
                // 错误率未达到阈值，不打开熔断器
                return false;
            } else {
                // 错误率超过阈值，尝试打开熔断器
                if (circuitOpenOrPending.compareAndSet(0, 1)) {
                    // 成功设置为打开状态
                    circuitOpenedOrLastTestedTime = System.currentTimeMillis();
                    return true;
                } else {
                    // 其他线程已经设置了打开状态
                    return true;
                }
            }
        } else {
            // 熔断器已经打开
            return true;
        }
    }
    
    @Override
    public boolean allowRequest() {
        if (properties.circuitBreakerForceOpen().get()) {
            // 强制打开
            return false;
        }
        if (properties.circuitBreakerForceClosed().get()) {
            // 强制关闭，允许请求
            return true;
        }
        if (circuitOpenOrPending.get() == 0) {
            // 熔断器关闭，允许请求
            return true;
        } else {
            // 熔断器打开，检查是否可以进入半开状态
            return isAfterSleepWindow();
        }
    }
    
    private boolean isAfterSleepWindow() {
        final long circuitOpenTime = circuitOpenedOrLastTestedTime;
        final long currentTime = System.currentTimeMillis();
        final long sleepWindowTime = properties.circuitBreakerSleepWindowInMilliseconds().get();
        
        // 检查是否超过了休眠窗口时间
        return currentTime - circuitOpenTime >= sleepWindowTime;
    }
}
```

## Resilience4j 实现分析

### Resilience4j 简介

Resilience4j 是一个轻量级的容错库，专为 Java 8 和函数式编程设计。与 Hystrix 相比，Resilience4j 的设计更加模块化，只使用 Vavr（以前称为 Javaslang）库，不依赖任何外部库。

### Resilience4j 核心模块

```java
// Resilience4j 熔断器示例
public class Resilience4jExample {
    private final CircuitBreaker circuitBreaker;
    private final UserService userService;
    
    public Resilience4jExample(UserService userService) {
        this.userService = userService;
        
        // 创建熔断器配置
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .failureRateThreshold(50) // 错误率阈值 50%
                .waitDurationInOpenState(Duration.ofSeconds(10)) // 打开状态持续时间
                .permittedNumberOfCallsInHalfOpenState(3) // 半开状态允许的请求数
                .slidingWindowSize(10) // 滑动窗口大小
                .recordExceptions(Exception.class) // 记录为失败的异常
                .build();
        
        // 创建熔断器实例
        this.circuitBreaker = CircuitBreaker.of("userService", config);
        
        // 添加事件监听器
        circuitBreaker.getEventPublisher()
                .onStateTransition(event -> 
                    System.out.println("CircuitBreaker state changed: " + event.getStateTransition())
                );
    }
    
    public User getUser(String userId) {
        // 创建受熔断器保护的 Supplier
        Supplier<User> decoratedSupplier = CircuitBreaker
                .decorateSupplier(circuitBreaker, () -> userService.getUserById(userId));
        
        // 执行并返回结果
        return Try.ofSupplier(decoratedSupplier)
                .recover(throwable -> {
                    // 降级逻辑
                    System.err.println("Fallback executed due to: " + throwable.getMessage());
                    return new User("default", "Default User");
                })
                .get();
    }
}
```

### Resilience4j 高级特性

```java
// 结合重试和熔断器
public class AdvancedResilience4jExample {
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final RateLimiter rateLimiter;
    
    public AdvancedResilience4jExample() {
        // 熔断器配置
        CircuitBreakerConfig circuitBreakerConfig = CircuitBreakerConfig.custom()
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .slidingWindowSize(10)
                .build();
        
        // 重试配置
        RetryConfig retryConfig = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(Duration.ofSeconds(1))
                .retryExceptions(TimeoutException.class, ConnectException.class)
                .build();
        
        // 限流器配置
        RateLimiterConfig rateLimiterConfig = RateLimiterConfig.custom()
                .limitRefreshPeriod(Duration.ofSeconds(1))
                .limitForPeriod(10) // 每秒最多10个请求
                .timeoutDuration(Duration.ofSeconds(5))
                .build();
        
        this.circuitBreaker = CircuitBreaker.of("backendService", circuitBreakerConfig);
        this.retry = Retry.of("backendService", retryConfig);
        this.rateLimiter = RateLimiter.of("backendService", rateLimiterConfig);
    }
    
    public String callExternalService(String request) {
        // 组合多个弹性模式
        Supplier<String> supplier = () -> {
            // 模拟外部服务调用
            if (Math.random() < 0.7) {
                throw new RuntimeException("Service temporarily unavailable");
            }
            return "Response for: " + request;
        };
        
        // 应用限流器
        Supplier<String> rateLimiterSupplier = RateLimiter
                .decorateSupplier(rateLimiter, supplier);
        
        // 应用重试
        Supplier<String> retrySupplier = Retry
                .decorateSupplier(retry, rateLimiterSupplier);
        
        // 应用熔断器
        Supplier<String> circuitBreakerSupplier = CircuitBreaker
                .decorateSupplier(circuitBreaker, retrySupplier);
        
        // 执行并处理降级
        return Try.ofSupplier(circuitBreakerSupplier)
                .recover(throwable -> {
                    System.err.println("All retries failed, falling back: " + throwable.getMessage());
                    return "Fallback response for: " + request;
                })
                .get();
    }
}
```

## 降级机制实现

### 降级策略

降级机制是在系统出现故障或压力过大时，为了保证核心功能的正常运行而采取的一种措施。常见的降级策略包括：

1. **返回默认值**：返回预设的默认数据
2. **缓存数据**：返回最近一次成功获取的数据
3. **简化逻辑**：执行简化的业务逻辑
4. **静态页面**：返回静态的响应内容

```java
public class FallbackManager {
    private final Cache<String, Object> fallbackCache = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .build();
    
    public <T> T executeWithFallback(Supplier<T> primary, Supplier<T> fallback, String cacheKey) {
        try {
            T result = primary.get();
            // 缓存成功结果
            fallbackCache.put(cacheKey, result);
            return result;
        } catch (Exception e) {
            System.err.println("Primary execution failed: " + e.getMessage());
            
            // 尝试从缓存获取
            T cached = (T) fallbackCache.getIfPresent(cacheKey);
            if (cached != null) {
                System.out.println("Returning cached result");
                return cached;
            }
            
            // 执行降级逻辑
            try {
                T fallbackResult = fallback.get();
                System.out.println("Fallback executed successfully");
                return fallbackResult;
            } catch (Exception fallbackException) {
                System.err.println("Fallback also failed: " + fallbackException.getMessage());
                throw new RuntimeException("Both primary and fallback failed", fallbackException);
            }
        }
    }
}

// 使用示例
public class UserServiceWithFallback {
    private final FallbackManager fallbackManager = new FallbackManager();
    
    public User getUserWithFallback(String userId) {
        return fallbackManager.executeWithFallback(
            () -> {
                // 主要逻辑
                return fetchUserFromDatabase(userId);
            },
            () -> {
                // 降级逻辑
                System.out.println("Using fallback user data");
                return new User("fallback", "Fallback User");
            },
            "user_" + userId
        );
    }
    
    private User fetchUserFromDatabase(String userId) {
        // 模拟数据库查询
        if (Math.random() < 0.3) {
            throw new RuntimeException("Database unavailable");
        }
        return new User(userId, "User " + userId);
    }
}
```

### 自适应降级

```java
public class AdaptiveFallbackManager {
    private final Map<String, ServiceHealth> serviceHealthMap = new ConcurrentHashMap<>();
    
    public <T> T executeWithAdaptiveFallback(String serviceName, Supplier<T> primary, 
                                           Map<FallbackLevel, Supplier<T>> fallbacks) {
        ServiceHealth health = serviceHealthMap.computeIfAbsent(serviceName, 
            k -> new ServiceHealth());
        
        // 根据服务健康状况选择合适的降级级别
        FallbackLevel fallbackLevel = determineFallbackLevel(health);
        
        try {
            T result = primary.get();
            // 更新健康状态
            health.recordSuccess();
            return result;
        } catch (Exception e) {
            System.err.println("Primary execution failed for " + serviceName + ": " + e.getMessage());
            health.recordFailure();
            
            // 根据降级级别执行相应的降级逻辑
            Supplier<T> fallback = fallbacks.get(fallbackLevel);
            if (fallback != null) {
                try {
                    T fallbackResult = fallback.get();
                    System.out.println("Executed fallback level: " + fallbackLevel);
                    return fallbackResult;
                } catch (Exception fallbackException) {
                    System.err.println("Fallback also failed: " + fallbackException.getMessage());
                    throw new RuntimeException("Both primary and fallback failed", fallbackException);
                }
            } else {
                throw new RuntimeException("No fallback available for level: " + fallbackLevel);
            }
        }
    }
    
    private FallbackLevel determineFallbackLevel(ServiceHealth health) {
        double errorRate = health.getErrorRate();
        if (errorRate < 0.1) {
            return FallbackLevel.NONE; // 不需要降级
        } else if (errorRate < 0.3) {
            return FallbackLevel.BASIC; // 基础降级
        } else if (errorRate < 0.6) {
            return FallbackLevel.PARTIAL; // 部分降级
        } else {
            return FallbackLevel.FULL; // 完全降级
        }
    }
}

enum FallbackLevel {
    NONE,    // 不降级
    BASIC,   // 基础降级
    PARTIAL, // 部分降级
    FULL     // 完全降级
}

class ServiceHealth {
    private final AtomicLong successCount = new AtomicLong(0);
    private final AtomicLong failureCount = new AtomicLong(0);
    private final long windowSize = 100; // 滑动窗口大小
    
    public void recordSuccess() {
        successCount.incrementAndGet();
        // 限制计数器大小
        if (successCount.get() + failureCount.get() > windowSize) {
            successCount.updateAndGet(current -> Math.max(0, current - 1));
            failureCount.updateAndGet(current -> Math.max(0, current - 1));
        }
    }
    
    public void recordFailure() {
        failureCount.incrementAndGet();
        // 限制计数器大小
        if (successCount.get() + failureCount.get() > windowSize) {
            successCount.updateAndGet(current -> Math.max(0, current - 1));
            failureCount.updateAndGet(current -> Math.max(0, current - 1));
        }
    }
    
    public double getErrorRate() {
        long total = successCount.get() + failureCount.get();
        return total > 0 ? (double) failureCount.get() / total : 0;
    }
}
```

## 总结

熔断与降级是构建高可用分布式系统的重要手段。通过合理设计和实现熔断器模式，我们可以有效防止故障的级联传播，提高系统的稳定性和用户体验。

关键要点：

1. **熔断器三状态**：关闭、打开、半开状态的合理转换
2. **核心参数配置**：失败阈值、超时时间、请求量阈值等
3. **主流框架对比**：Hystrix 与 Resilience4j 的特点和适用场景
4. **降级策略**：默认值、缓存数据、简化逻辑等多种降级方式
5. **组合使用**：熔断器、重试、限流等模式的协同工作

在实际应用中，需要根据具体的业务场景和系统要求来选择合适的熔断降级方案，并进行合理的参数调优。在下一章中，我们将探讨服务限流机制，进一步完善 RPC 系统的容错能力。