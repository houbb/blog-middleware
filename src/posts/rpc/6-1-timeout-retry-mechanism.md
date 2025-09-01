---
title: 超时控制、重试机制
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在分布式系统中，网络延迟、服务不可用、资源争用等问题是常态而非例外。为了构建高可用的 RPC 系统，我们必须设计合理的容错机制，其中超时控制和重试机制是两个核心组件。它们不仅能够提高系统的稳定性，还能在面对瞬时故障时自动恢复，从而提升用户体验。

## 超时控制的重要性

### 为什么需要超时控制？

在 RPC 调用中，如果没有合理的超时控制，可能会出现以下问题：

1. **资源耗尽**：长时间等待无响应的请求会占用大量线程和连接资源
2. **雪崩效应**：一个服务的延迟可能导致整个调用链的阻塞
3. **用户体验差**：用户需要等待很长时间才能得到响应或错误信息

### 超时类型

在 RPC 系统中，通常需要设置多种类型的超时：

#### 连接超时（Connection Timeout）

连接超时是指建立 TCP 连接的最大等待时间。如果在这个时间内无法建立连接，则认为连接失败。

```java
public class RpcClient {
    private int connectionTimeout = 3000; // 3秒
    
    public void connect(String host, int port) throws RpcException {
        try {
            // 使用 NIO 或 Netty 实现连接超时
            ChannelFuture future = bootstrap.connect(host, port);
            if (!future.await(connectionTimeout, TimeUnit.MILLISECONDS)) {
                throw new RpcException("Connection timeout to " + host + ":" + port);
            }
            if (!future.isSuccess()) {
                throw new RpcException("Failed to connect to " + host + ":" + port, 
                                     future.cause());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RpcException("Connection interrupted", e);
        }
    }
}
```

#### 读取超时（Read Timeout）

读取超时是指从建立连接到接收到响应数据的最大等待时间。

```java
public class TimeoutHandler extends ChannelInboundHandlerAdapter {
    private ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private ScheduledFuture<?> timeoutFuture;
    private int readTimeout = 5000; // 5秒
    
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        // 收到数据，取消超时任务
        if (timeoutFuture != null && !timeoutFuture.isDone()) {
            timeoutFuture.cancel(false);
        }
        super.channelRead(ctx, msg);
    }
    
    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        // 设置新的读取超时
        timeoutFuture = scheduler.schedule(() -> {
            ctx.close(); // 关闭连接
            System.err.println("Read timeout occurred");
        }, readTimeout, TimeUnit.MILLISECONDS);
        super.channelReadComplete(ctx);
    }
}
```

#### 整体超时（Overall Timeout）

整体超时是指从发送请求到接收完整响应的总时间限制。

```java
public class RpcRequestManager {
    private Map<String, RequestContext> pendingRequests = new ConcurrentHashMap<>();
    private ScheduledExecutorService timeoutScheduler = Executors.newScheduledThreadPool(2);
    
    public CompletableFuture<RpcResponse> sendRequest(RpcRequest request, int timeoutMs) {
        CompletableFuture<RpcResponse> future = new CompletableFuture<>();
        String requestId = request.getRequestId();
        
        // 创建请求上下文
        RequestContext context = new RequestContext(request, future);
        pendingRequests.put(requestId, context);
        
        // 设置整体超时
        ScheduledFuture<?> timeoutTask = timeoutScheduler.schedule(() -> {
            RequestContext removed = pendingRequests.remove(requestId);
            if (removed != null) {
                future.completeExceptionally(new TimeoutException("Request timeout after " + timeoutMs + "ms"));
                System.err.println("Request timeout: " + requestId);
            }
        }, timeoutMs, TimeUnit.MILLISECONDS);
        
        context.setTimeoutTask(timeoutTask);
        
        // 发送请求
        sendNetworkRequest(request);
        return future;
    }
    
    public void handleResponse(RpcResponse response) {
        String requestId = response.getRequestId();
        RequestContext context = pendingRequests.remove(requestId);
        
        if (context != null) {
            // 取消超时任务
            context.getTimeoutTask().cancel(false);
            context.getFuture().complete(response);
        }
    }
}

class RequestContext {
    private RpcRequest request;
    private CompletableFuture<RpcResponse> future;
    private ScheduledFuture<?> timeoutTask;
    
    public RequestContext(RpcRequest request, CompletableFuture<RpcResponse> future) {
        this.request = request;
        this.future = future;
    }
    
    // getter and setter methods
    public CompletableFuture<RpcResponse> getFuture() { return future; }
    public ScheduledFuture<?> getTimeoutTask() { return timeoutTask; }
    public void setTimeoutTask(ScheduledFuture<?> timeoutTask) { this.timeoutTask = timeoutTask; }
}
```

## 重试机制设计

### 重试策略

合理的重试机制需要考虑以下几个方面：

1. **重试次数**：限制最大重试次数，避免无限重试
2. **重试间隔**：使用指数退避等策略避免雪崩
3. **重试条件**：只对特定类型的错误进行重试
4. **重试上下文**：保持重试状态和上下文信息

### 基础重试实现

```java
public class RetryableRpcClient {
    private int maxRetries = 3;
    private long baseDelay = 1000; // 1秒
    private double multiplier = 2.0;
    
    public CompletableFuture<RpcResponse> sendRequestWithRetry(RpcRequest request) {
        return sendRequestWithRetry(request, 0);
    }
    
    private CompletableFuture<RpcResponse> sendRequestWithRetry(RpcRequest request, int retryCount) {
        return sendRequest(request).handle((response, throwable) -> {
            if (throwable == null) {
                // 成功响应
                return CompletableFuture.completedFuture(response);
            }
            
            // 检查是否应该重试
            if (shouldRetry(throwable) && retryCount < maxRetries) {
                long delay = calculateDelay(retryCount);
                System.out.println("Retrying request " + request.getRequestId() + 
                                 " after " + delay + "ms, attempt " + (retryCount + 1));
                
                // 延迟后重试
                CompletableFuture<RpcResponse> delayedFuture = new CompletableFuture<>();
                ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
                scheduler.schedule(() -> {
                    sendRequestWithRetry(request, retryCount + 1)
                        .whenComplete((result, error) -> {
                            if (error != null) {
                                delayedFuture.completeExceptionally(error);
                            } else {
                                delayedFuture.complete(result);
                            }
                        });
                }, delay, TimeUnit.MILLISECONDS);
                
                return delayedFuture;
            } else {
                // 不重试或达到最大重试次数
                return CompletableFuture.<RpcResponse>failedFuture(throwable);
            }
        }).thenCompose(Function.identity()); // 展开 CompletableFuture<CompletableFuture<RpcResponse>>
    }
    
    private CompletableFuture<RpcResponse> sendRequest(RpcRequest request) {
        // 实际发送请求的逻辑
        // 这里简化处理，实际实现会涉及网络通信
        return CompletableFuture.completedFuture(new RpcResponse());
    }
    
    private boolean shouldRetry(Throwable throwable) {
        // 只对特定类型的错误进行重试
        if (throwable instanceof TimeoutException) {
            return true;
        }
        if (throwable instanceof ConnectException) {
            return true;
        }
        if (throwable instanceof RpcException) {
            RpcException rpcEx = (RpcException) throwable;
            // 对于临时性错误进行重试
            return rpcEx.isTemporary();
        }
        return false;
    }
    
    private long calculateDelay(int retryCount) {
        // 指数退避算法
        return (long) (baseDelay * Math.pow(multiplier, retryCount));
    }
}
```

### 高级重试策略

#### 带抖动的指数退避

为了避免多个客户端同时重试导致的冲击，可以在指数退避基础上添加随机抖动：

```java
public class JitteredRetryStrategy {
    private int maxRetries = 3;
    private long baseDelay = 1000;
    private double multiplier = 2.0;
    private double jitter = 0.1; // 10% 抖动
    private Random random = new Random();
    
    public long calculateDelayWithJitter(int retryCount) {
        long exponentialDelay = (long) (baseDelay * Math.pow(multiplier, retryCount));
        long jitterAmount = (long) (exponentialDelay * jitter * random.nextDouble());
        return exponentialDelay + jitterAmount;
    }
    
    public CompletableFuture<RpcResponse> sendRequestWithJitteredRetry(RpcRequest request) {
        return sendRequestWithJitteredRetry(request, 0);
    }
    
    private CompletableFuture<RpcResponse> sendRequestWithJitteredRetry(
            RpcRequest request, int retryCount) {
        return sendRequest(request).handle((response, throwable) -> {
            if (throwable == null) {
                return CompletableFuture.completedFuture(response);
            }
            
            if (shouldRetry(throwable) && retryCount < maxRetries) {
                long delay = calculateDelayWithJitter(retryCount);
                System.out.println("Retrying with jittered delay: " + delay + "ms");
                
                CompletableFuture<RpcResponse> delayedFuture = new CompletableFuture<>();
                ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
                scheduler.schedule(() -> {
                    sendRequestWithJitteredRetry(request, retryCount + 1)
                        .whenComplete((result, error) -> {
                            if (error != null) {
                                delayedFuture.completeExceptionally(error);
                            } else {
                                delayedFuture.complete(result);
                            }
                        });
                }, delay, TimeUnit.MILLISECONDS);
                
                return delayedFuture;
            } else {
                return CompletableFuture.<RpcResponse>failedFuture(throwable);
            }
        }).thenCompose(Function.identity());
    }
    
    private CompletableFuture<RpcResponse> sendRequest(RpcRequest request) {
        // 实际发送请求的逻辑
        return CompletableFuture.completedFuture(new RpcResponse());
    }
    
    private boolean shouldRetry(Throwable throwable) {
        // 重试条件判断逻辑
        return throwable instanceof TimeoutException || 
               throwable instanceof ConnectException;
    }
}
```

#### 基于电路 breaker 的重试

结合熔断器模式，可以更智能地控制重试行为：

```java
public class CircuitBreakerRetryClient {
    private CircuitBreaker circuitBreaker;
    private RetryableRpcClient retryableClient;
    
    public CircuitBreakerRetryClient() {
        this.circuitBreaker = new CircuitBreaker(5, 60000); // 5次失败后熔断，60秒后恢复
        this.retryableClient = new RetryableRpcClient();
    }
    
    public CompletableFuture<RpcResponse> sendRequest(RpcRequest request) {
        if (circuitBreaker.isOpen()) {
            return CompletableFuture.failedFuture(
                new RpcException("Circuit breaker is open, service unavailable"));
        }
        
        return retryableClient.sendRequestWithRetry(request)
            .whenComplete((response, throwable) -> {
                if (throwable != null) {
                    circuitBreaker.recordFailure();
                } else {
                    circuitBreaker.recordSuccess();
                }
            });
    }
}

class CircuitBreaker {
    private final int failureThreshold;
    private final long recoveryTimeout;
    private int failureCount = 0;
    private long lastFailureTime = 0;
    private volatile boolean open = false;
    
    public CircuitBreaker(int failureThreshold, long recoveryTimeout) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
    }
    
    public synchronized void recordFailure() {
        failureCount++;
        lastFailureTime = System.currentTimeMillis();
        if (failureCount >= failureThreshold) {
            open = true;
        }
    }
    
    public synchronized void recordSuccess() {
        failureCount = 0;
        open = false;
    }
    
    public boolean isOpen() {
        if (open && System.currentTimeMillis() - lastFailureTime > recoveryTimeout) {
            // 半开状态，允许一次请求通过
            open = false;
            failureCount = 0;
            return false;
        }
        return open;
    }
}
```

## 超时与重试的最佳实践

### 配置管理

合理的超时和重试配置应该支持动态调整：

```java
public class RpcConfigManager {
    private volatile RpcConfig config = new RpcConfig();
    
    public static class RpcConfig {
        private int connectionTimeout = 3000;
        private int readTimeout = 5000;
        private int overallTimeout = 10000;
        private int maxRetries = 3;
        private long baseRetryDelay = 1000;
        
        // getter and setter methods
        public int getConnectionTimeout() { return connectionTimeout; }
        public void setConnectionTimeout(int connectionTimeout) { this.connectionTimeout = connectionTimeout; }
        
        public int getReadTimeout() { return readTimeout; }
        public void setReadTimeout(int readTimeout) { this.readTimeout = readTimeout; }
        
        public int getOverallTimeout() { return overallTimeout; }
        public void setOverallTimeout(int overallTimeout) { this.overallTimeout = overallTimeout; }
        
        public int getMaxRetries() { return maxRetries; }
        public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
        
        public long getBaseRetryDelay() { return baseRetryDelay; }
        public void setBaseRetryDelay(long baseRetryDelay) { this.baseRetryDelay = baseRetryDelay; }
    }
    
    public RpcConfig getConfig() {
        return config;
    }
    
    // 动态更新配置
    public void updateConfig(RpcConfig newConfig) {
        this.config = newConfig;
    }
}
```

### 监控与告警

实施有效的监控来跟踪超时和重试情况：

```java
public class RpcMetricsCollector {
    private final MeterRegistry meterRegistry;
    
    public RpcMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordTimeout(String serviceName, String methodName) {
        Counter.builder("rpc.timeouts")
            .tag("service", serviceName)
            .tag("method", methodName)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordRetry(String serviceName, String methodName, int retryCount) {
        Timer.builder("rpc.retries")
            .tag("service", serviceName)
            .tag("method", methodName)
            .tag("retry_count", String.valueOf(retryCount))
            .register(meterRegistry)
            .record(retryCount, TimeUnit.MILLISECONDS);
    }
    
    public void recordLatency(String serviceName, String methodName, long latencyMs) {
        Timer.builder("rpc.latency")
            .tag("service", serviceName)
            .tag("method", methodName)
            .register(meterRegistry)
            .record(latencyMs, TimeUnit.MILLISECONDS);
    }
}
```

## 总结

超时控制和重试机制是构建高可用 RPC 系统的重要组成部分。通过合理设置不同类型的超时、实现智能的重试策略，并结合熔断器模式，我们可以显著提高系统的稳定性和用户体验。

关键要点：

1. **多层次超时控制**：连接超时、读取超时和整体超时应该分别设置
2. **智能重试策略**：使用指数退避和抖动避免雪崩效应
3. **条件重试**：只对特定类型的错误进行重试
4. **动态配置**：支持运行时调整超时和重试参数
5. **监控告警**：跟踪超时和重试指标，及时发现问题

在实际应用中，需要根据具体业务场景和系统要求来调整这些参数，以达到最佳的平衡点。在下一章中，我们将探讨熔断与降级机制，进一步完善 RPC 系统的容错能力。