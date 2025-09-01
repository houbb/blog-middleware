---
title: 任务执行与容错机制
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统中，任务执行的可靠性和容错能力是确保系统稳定运行的关键。由于网络波动、节点故障、资源不足等各种因素，任务执行过程中可能会出现失败。为了提高系统的可用性和数据一致性，我们需要实现完善的容错机制，包括重试机制、超时控制和幂等性保障等。本文将深入探讨这些关键技术的实现原理和最佳实践。

## 重试机制与补偿任务

重试机制是处理临时性故障的有效手段，通过自动重试可以解决网络抖动、资源暂时不可用等问题。补偿任务则用于处理事务性操作的回滚需求。

### 重试机制实现

```java
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

// 重试策略枚举
public enum RetryStrategy {
    FIXED,      // 固定间隔重试
    EXPONENTIAL, // 指数退避重试
    FIBONACCI    // 斐波那契退避重试
}

// 重试配置
public class RetryConfig {
    private int maxAttempts;           // 最大重试次数
    private Duration initialDelay;     // 初始延迟
    private Duration maxDelay;         // 最大延迟
    private RetryStrategy strategy;    // 重试策略
    private double multiplier;         // 倍数因子（用于指数退避）
    
    public RetryConfig() {
        this.maxAttempts = 3;
        this.initialDelay = Duration.ofSeconds(1);
        this.maxDelay = Duration.ofMinutes(1);
        this.strategy = RetryStrategy.EXPONENTIAL;
        this.multiplier = 2.0;
    }
    
    // builders
    public static RetryConfigBuilder builder() {
        return new RetryConfigBuilder();
    }
    
    // getters
    public int getMaxAttempts() { return maxAttempts; }
    public Duration getInitialDelay() { return initialDelay; }
    public Duration getMaxDelay() { return maxDelay; }
    public RetryStrategy getStrategy() { return strategy; }
    public double getMultiplier() { return multiplier; }
    
    // setters
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
    public void setInitialDelay(Duration initialDelay) { this.initialDelay = initialDelay; }
    public void setMaxDelay(Duration maxDelay) { this.maxDelay = maxDelay; }
    public void setStrategy(RetryStrategy strategy) { this.strategy = strategy; }
    public void setMultiplier(double multiplier) { this.multiplier = multiplier; }
}

// 重试配置构建器
public class RetryConfigBuilder {
    private RetryConfig config = new RetryConfig();
    
    public RetryConfigBuilder maxAttempts(int maxAttempts) {
        config.setMaxAttempts(maxAttempts);
        return this;
    }
    
    public RetryConfigBuilder initialDelay(Duration initialDelay) {
        config.setInitialDelay(initialDelay);
        return this;
    }
    
    public RetryConfigBuilder maxDelay(Duration maxDelay) {
        config.setMaxDelay(maxDelay);
        return this;
    }
    
    public RetryConfigBuilder strategy(RetryStrategy strategy) {
        config.setStrategy(strategy);
        return this;
    }
    
    public RetryConfigBuilder multiplier(double multiplier) {
        config.setMultiplier(multiplier);
        return this;
    }
    
    public RetryConfig build() {
        return config;
    }
}

// 重试执行器
public class RetryableTaskExecutor {
    private ScheduledExecutorService scheduler;
    
    public RetryableTaskExecutor(ScheduledExecutorService scheduler) {
        this.scheduler = scheduler;
    }
    
    /**
     * 执行可重试的任务
     */
    public <T> CompletableFuture<T> executeWithRetry(
            Supplier<T> task, 
            RetryConfig config,
            java.util.function.Predicate<Exception> retryCondition) {
        
        CompletableFuture<T> future = new CompletableFuture<>();
        executeWithRetryInternal(task, config, retryCondition, 1, future);
        return future;
    }
    
    private <T> void executeWithRetryInternal(
            Supplier<T> task,
            RetryConfig config,
            java.util.function.Predicate<Exception> retryCondition,
            int attempt,
            CompletableFuture<T> future) {
        
        try {
            T result = task.get();
            future.complete(result);
        } catch (Exception e) {
            if (attempt >= config.getMaxAttempts() || !retryCondition.test(e)) {
                future.completeExceptionally(e);
                return;
            }
            
            // 计算下次重试的延迟时间
            Duration delay = calculateDelay(config, attempt);
            
            // 安排下次重试
            scheduler.schedule(() -> {
                executeWithRetryInternal(task, config, retryCondition, attempt + 1, future);
            }, delay.toMillis(), TimeUnit.MILLISECONDS);
        }
    }
    
    /**
     * 计算重试延迟时间
     */
    private Duration calculateDelay(RetryConfig config, int attempt) {
        Duration delay;
        
        switch (config.getStrategy()) {
            case FIXED:
                delay = config.getInitialDelay();
                break;
            case EXPONENTIAL:
                long exponentialDelay = (long) (config.getInitialDelay().toMillis() * 
                                              Math.pow(config.getMultiplier(), attempt - 1));
                delay = Duration.ofMillis(Math.min(exponentialDelay, config.getMaxDelay().toMillis()));
                break;
            case FIBONACCI:
                delay = calculateFibonacciDelay(config, attempt);
                break;
            default:
                delay = config.getInitialDelay();
        }
        
        return delay;
    }
    
    /**
     * 计算斐波那契退避延迟
     */
    private Duration calculateFibonacciDelay(RetryConfig config, int attempt) {
        if (attempt <= 1) {
            return config.getInitialDelay();
        }
        
        long fib1 = 1, fib2 = 1;
        for (int i = 2; i < attempt; i++) {
            long temp = fib2;
            fib2 = fib1 + fib2;
            fib1 = temp;
        }
        
        long delayMillis = Math.min(fib2 * config.getInitialDelay().toMillis(), 
                                   config.getMaxDelay().toMillis());
        return Duration.ofMillis(delayMillis);
    }
}
```

### 补偿任务实现

```java
// 补偿任务接口
public interface CompensableTask<T> {
    /**
     * 执行任务
     */
    T execute() throws Exception;
    
    /**
     * 补偿操作（回滚）
     */
    void compensate() throws Exception;
}

// 事务性任务执行器
public class TransactionalTaskExecutor {
    private RetryableTaskExecutor retryableExecutor;
    
    public TransactionalTaskExecutor(RetryableTaskExecutor retryableExecutor) {
        this.retryableExecutor = retryableExecutor;
    }
    
    /**
     * 执行事务性任务
     */
    public <T> CompletableFuture<T> executeTransactional(
            CompensableTask<T> task,
            RetryConfig retryConfig) {
        
        CompletableFuture<T> future = new CompletableFuture<>();
        
        // 执行任务
        retryableExecutor.executeWithRetry(
            task::execute,
            retryConfig,
            e -> shouldRetry(e)
        ).whenComplete((result, throwable) -> {
            if (throwable != null) {
                // 任务执行失败，执行补偿操作
                executeCompensation(task, future, throwable);
            } else {
                // 任务执行成功
                future.complete(result);
            }
        });
        
        return future;
    }
    
    /**
     * 执行补偿操作
     */
    private <T> void executeCompensation(
            CompensableTask<T> task,
            CompletableFuture<T> future,
            Throwable originalError) {
        
        try {
            task.compensate();
            future.completeExceptionally(new RuntimeException(
                "Task failed and compensation executed", originalError));
        } catch (Exception compensationError) {
            // 补偿也失败了
            future.completeExceptionally(new RuntimeException(
                "Task failed and compensation also failed", 
                originalError.getCause() != null ? originalError.getCause() : originalError));
        }
    }
    
    /**
     * 判断是否应该重试
     */
    private boolean shouldRetry(Exception e) {
        // 可以根据异常类型决定是否重试
        return e instanceof java.net.SocketTimeoutException ||
               e instanceof java.net.ConnectException ||
               e instanceof java.util.concurrent.TimeoutException;
    }
}

// 示例：数据库操作的补偿任务
public class DatabaseOperationTask implements CompensableTask<String> {
    private String operation;
    private String data;
    private String transactionId;
    
    public DatabaseOperationTask(String operation, String data) {
        this.operation = operation;
        this.data = data;
        this.transactionId = java.util.UUID.randomUUID().toString();
    }
    
    @Override
    public String execute() throws Exception {
        System.out.println("执行数据库操作: " + operation + ", 数据: " + data);
        
        // 模拟数据库操作
        if (Math.random() < 0.3) { // 30% 概率失败
            throw new RuntimeException("数据库操作失败");
        }
        
        // 记录事务ID用于补偿
        System.out.println("操作成功，事务ID: " + transactionId);
        return "操作成功";
    }
    
    @Override
    public void compensate() throws Exception {
        System.out.println("执行补偿操作，回滚事务: " + transactionId);
        // 实际的回滚逻辑
    }
}
```

## 超时控制与中断执行

超时控制是防止任务无限期执行的重要机制，中断执行则允许在必要时主动终止任务执行。

### 超时控制实现

```java
import java.time.Duration;
import java.util.concurrent.*;

// 超时控制任务执行器
public class TimeoutTaskExecutor {
    private ScheduledExecutorService scheduler;
    private ExecutorService taskExecutor;
    
    public TimeoutTaskExecutor(ScheduledExecutorService scheduler, ExecutorService taskExecutor) {
        this.scheduler = scheduler;
        this.taskExecutor = taskExecutor;
    }
    
    /**
     * 执行带超时控制的任务
     */
    public <T> CompletableFuture<T> executeWithTimeout(
            Callable<T> task,
            Duration timeout) {
        
        CompletableFuture<T> future = new CompletableFuture<>();
        CompletableFuture<T> taskFuture = CompletableFuture.supplyAsync(
            () -> {
                try {
                    return task.call();
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }, 
            taskExecutor
        );
        
        // 设置超时处理
        ScheduledFuture<?> timeoutFuture = scheduler.schedule(() -> {
            if (!taskFuture.isDone()) {
                taskFuture.cancel(true);
                future.completeExceptionally(new TimeoutException("Task execution timed out"));
            }
        }, timeout.toMillis(), TimeUnit.MILLISECONDS);
        
        // 任务完成时的处理
        taskFuture.whenComplete((result, throwable) -> {
            timeoutFuture.cancel(false); // 取消超时定时器
            
            if (throwable != null) {
                future.completeExceptionally(throwable);
            } else {
                future.complete(result);
            }
        });
        
        return future;
    }
    
    /**
     * 执行带超时和重试的任务
     */
    public <T> CompletableFuture<T> executeWithTimeoutAndRetry(
            Callable<T> task,
            Duration timeout,
            RetryConfig retryConfig) {
        
        CompletableFuture<T> future = new CompletableFuture<>();
        executeWithTimeoutAndRetryInternal(task, timeout, retryConfig, 1, future);
        return future;
    }
    
    private <T> void executeWithTimeoutAndRetryInternal(
            Callable<T> task,
            Duration timeout,
            RetryConfig retryConfig,
            int attempt,
            CompletableFuture<T> future) {
        
        executeWithTimeout(task, timeout).whenComplete((result, throwable) -> {
            if (throwable == null) {
                // 任务成功
                future.complete(result);
            } else {
                // 任务失败
                if (attempt >= retryConfig.getMaxAttempts() || 
                    !isRetryableException(throwable)) {
                    // 达到最大重试次数或不可重试的异常
                    future.completeExceptionally(throwable);
                } else {
                    // 安排重试
                    Duration delay = calculateDelay(retryConfig, attempt);
                    scheduler.schedule(() -> {
                        executeWithTimeoutAndRetryInternal(
                            task, timeout, retryConfig, attempt + 1, future);
                    }, delay.toMillis(), TimeUnit.MILLISECONDS);
                }
            }
        });
    }
    
    /**
     * 判断异常是否可重试
     */
    private boolean isRetryableException(Throwable throwable) {
        if (throwable instanceof TimeoutException) {
            return true;
        }
        if (throwable instanceof RuntimeException) {
            return !(throwable instanceof IllegalArgumentException) &&
                   !(throwable instanceof IllegalStateException);
        }
        return false;
    }
    
    /**
     * 计算重试延迟时间
     */
    private Duration calculateDelay(RetryConfig config, int attempt) {
        long delayMillis = (long) (config.getInitialDelay().toMillis() * 
                                 Math.pow(config.getMultiplier(), attempt - 1));
        return Duration.ofMillis(Math.min(delayMillis, config.getMaxDelay().toMillis()));
    }
}
```

### 中断执行机制

```java
// 可中断任务接口
public interface InterruptibleTask<T> {
    T execute(CancellationToken cancellationToken) throws Exception;
}

// 取消令牌
public class CancellationToken {
    private volatile boolean cancelled = false;
    private final Object lock = new Object();
    private Runnable onCancelled;
    
    public boolean isCancelled() {
        return cancelled;
    }
    
    public void cancel() {
        synchronized (lock) {
            if (!cancelled) {
                cancelled = true;
                if (onCancelled != null) {
                    onCancelled.run();
                }
            }
        }
    }
    
    public void setOnCancelled(Runnable onCancelled) {
        synchronized (lock) {
            this.onCancelled = onCancelled;
            if (cancelled && onCancelled != null) {
                onCancelled.run();
            }
        }
    }
}

// 可中断任务执行器
public class InterruptibleTaskExecutor {
    private ExecutorService executorService;
    
    public InterruptibleTaskExecutor(ExecutorService executorService) {
        this.executorService = executorService;
    }
    
    /**
     * 执行可中断任务
     */
    public <T> CompletableFuture<T> executeInterruptible(
            InterruptibleTask<T> task,
            Duration timeout) {
        
        CompletableFuture<T> future = new CompletableFuture<>();
        CancellationToken cancellationToken = new CancellationToken();
        
        // 设置超时取消
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.schedule(() -> {
            if (!future.isDone()) {
                cancellationToken.cancel();
            }
        }, timeout.toMillis(), TimeUnit.MILLISECONDS);
        
        // 执行任务
        executorService.submit(() -> {
            try {
                T result = task.execute(cancellationToken);
                if (!cancellationToken.isCancelled()) {
                    future.complete(result);
                } else {
                    future.completeExceptionally(new CancellationException("Task was cancelled"));
                }
            } catch (Exception e) {
                if (cancellationToken.isCancelled()) {
                    future.completeExceptionally(new CancellationException("Task was cancelled"));
                } else {
                    future.completeExceptionally(e);
                }
            } finally {
                scheduler.shutdown();
            }
        });
        
        return future;
    }
}

// 示例：可中断的长时间运行任务
public class LongRunningTask implements InterruptibleTask<String> {
    private String taskId;
    
    public LongRunningTask(String taskId) {
        this.taskId = taskId;
    }
    
    @Override
    public String execute(CancellationToken cancellationToken) throws Exception {
        System.out.println("开始执行长时间任务: " + taskId);
        
        // 模拟长时间运行的任务
        for (int i = 0; i < 100; i++) {
            // 检查是否被取消
            if (cancellationToken.isCancelled()) {
                System.out.println("任务被取消: " + taskId);
                throw new CancellationException("Task was cancelled");
            }
            
            // 模拟工作
            Thread.sleep(100);
            System.out.println("任务进度: " + (i + 1) + "%");
        }
        
        return "任务完成: " + taskId;
    }
}
```

## 幂等性保障

幂等性是指同一个操作多次执行产生的结果是一致的，这对于分布式系统中的任务执行至关重要。

### 幂等性实现

```java
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

// 幂等性管理器
public class IdempotencyManager {
    private final ConcurrentHashMap<String, IdempotencyRecord> recordCache;
    private final long ttlMillis; // 记录生存时间
    
    public IdempotencyManager(long ttlMinutes) {
        this.recordCache = new ConcurrentHashMap<>();
        this.ttlMillis = TimeUnit.MINUTES.toMillis(ttlMinutes);
        // 启动清理线程
        startCleanupThread();
    }
    
    /**
     * 检查并记录操作幂等性
     */
    public boolean checkAndRecord(String operationId, String parameters) {
        String key = generateKey(operationId, parameters);
        long currentTime = System.currentTimeMillis();
        
        IdempotencyRecord existingRecord = recordCache.get(key);
        if (existingRecord != null) {
            // 检查是否过期
            if (currentTime - existingRecord.getTimestamp() < ttlMillis) {
                // 操作已存在且未过期
                return false;
            } else {
                // 记录已过期，移除
                recordCache.remove(key, existingRecord);
            }
        }
        
        // 记录新操作
        IdempotencyRecord newRecord = new IdempotencyRecord(currentTime);
        recordCache.put(key, newRecord);
        return true;
    }
    
    /**
     * 生成幂等性键
     */
    private String generateKey(String operationId, String parameters) {
        try {
            String input = operationId + "|" + parameters;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Failed to generate hash", e);
        }
    }
    
    /**
     * 启动清理线程
     */
    private void startCleanupThread() {
        Thread cleanupThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    cleanupExpiredRecords();
                    Thread.sleep(TimeUnit.MINUTES.toMillis(5)); // 每5分钟清理一次
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        });
        cleanupThread.setDaemon(true);
        cleanupThread.start();
    }
    
    /**
     * 清理过期记录
     */
    private void cleanupExpiredRecords() {
        long currentTime = System.currentTimeMillis();
        recordCache.entrySet().removeIf(entry -> 
            currentTime - entry.getValue().getTimestamp() >= ttlMillis);
    }
    
    /**
     * 幂等性记录
     */
    private static class IdempotencyRecord {
        private final long timestamp;
        
        public IdempotencyRecord(long timestamp) {
            this.timestamp = timestamp;
        }
        
        public long getTimestamp() {
            return timestamp;
        }
    }
}

// 幂等性任务执行器
public class IdempotentTaskExecutor {
    private IdempotencyManager idempotencyManager;
    private RetryableTaskExecutor retryableExecutor;
    
    public IdempotentTaskExecutor(IdempotencyManager idempotencyManager, 
                                 RetryableTaskExecutor retryableExecutor) {
        this.idempotencyManager = idempotencyManager;
        this.retryableExecutor = retryableExecutor;
    }
    
    /**
     * 执行幂等性任务
     */
    public <T> CompletableFuture<T> executeIdempotent(
            String operationId,
            String parameters,
            Supplier<T> task,
            RetryConfig retryConfig) {
        
        // 检查幂等性
        if (!idempotencyManager.checkAndRecord(operationId, parameters)) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Duplicate operation detected"));
        }
        
        // 执行任务
        return retryableExecutor.executeWithRetry(task, retryConfig, e -> true);
    }
}

// 示例：幂等性支付任务
public class PaymentTask implements Supplier<String> {
    private String orderId;
    private double amount;
    private String accountId;
    
    public PaymentTask(String orderId, double amount, String accountId) {
        this.orderId = orderId;
        this.amount = amount;
        this.accountId = accountId;
    }
    
    @Override
    public String get() {
        System.out.println("执行支付操作 - 订单: " + orderId + ", 金额: " + amount + ", 账户: " + accountId);
        
        // 模拟支付操作
        if (Math.random() < 0.1) { // 10% 概率失败
            throw new RuntimeException("支付失败");
        }
        
        return "支付成功 - 订单: " + orderId;
    }
}
```

## 综合示例

```java
public class FaultToleranceExample {
    public static void main(String[] args) throws Exception {
        // 初始化执行器
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
        ExecutorService taskExecutor = Executors.newFixedThreadPool(5);
        RetryableTaskExecutor retryableExecutor = new RetryableTaskExecutor(scheduler);
        TimeoutTaskExecutor timeoutExecutor = new TimeoutTaskExecutor(scheduler, taskExecutor);
        IdempotencyManager idempotencyManager = new IdempotencyManager(60); // 60分钟TTL
        IdempotentTaskExecutor idempotentExecutor = new IdempotentTaskExecutor(
            idempotencyManager, retryableExecutor);
        
        // 示例1: 重试机制
        System.out.println("=== 示例1: 重试机制 ===");
        RetryConfig retryConfig = RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofSeconds(1))
            .strategy(RetryStrategy.EXPONENTIAL)
            .multiplier(2.0)
            .build();
        
        DatabaseOperationTask dbTask = new DatabaseOperationTask("INSERT", "user_data");
        retryableExecutor.executeWithRetry(
            dbTask::execute,
            retryConfig,
            e -> true
        ).whenComplete((result, throwable) -> {
            if (throwable != null) {
                System.out.println("任务最终失败: " + throwable.getMessage());
            } else {
                System.out.println("任务成功: " + result);
            }
        }).get(30, TimeUnit.SECONDS);
        
        // 示例2: 超时控制
        System.out.println("\n=== 示例2: 超时控制 ===");
        LongRunningTask longTask = new LongRunningTask("LONG_TASK_001");
        CancellationToken token = new CancellationToken();
        
        // 设置5秒超时
        timeoutExecutor.executeWithTimeout(
            () -> longTask.execute(token),
            Duration.ofSeconds(5)
        ).whenComplete((result, throwable) -> {
            if (throwable instanceof TimeoutException) {
                System.out.println("任务超时");
            } else if (throwable != null) {
                System.out.println("任务失败: " + throwable.getMessage());
            } else {
                System.out.println("任务完成: " + result);
            }
        }).get(10, TimeUnit.SECONDS);
        
        // 示例3: 幂等性保障
        System.out.println("\n=== 示例3: 幂等性保障 ===");
        PaymentTask paymentTask = new PaymentTask("ORDER_001", 100.0, "ACCOUNT_001");
        try {
            String result = idempotentExecutor.executeIdempotent(
                "PAYMENT",
                "ORDER_001|100.0|ACCOUNT_001",
                paymentTask,
                retryConfig
            ).get(30, TimeUnit.SECONDS);
            System.out.println("支付结果: " + result);
        } catch (Exception e) {
            System.out.println("支付异常: " + e.getMessage());
        }
        
        // 尝试重复执行相同的操作（应该被幂等性阻止）
        try {
            String result = idempotentExecutor.executeIdempotent(
                "PAYMENT",
                "ORDER_001|100.0|ACCOUNT_001",
                paymentTask,
                retryConfig
            ).get(30, TimeUnit.SECONDS);
            System.out.println("重复支付结果: " + result);
        } catch (Exception e) {
            System.out.println("重复支付被阻止: " + e.getMessage());
        }
        
        // 关闭执行器
        scheduler.shutdown();
        taskExecutor.shutdown();
    }
}
```

## 最佳实践

### 1. 合理配置重试策略

```java
// 针对不同场景的重试配置
public class RetryConfigurations {
    
    // 网络操作重试配置
    public static RetryConfig networkRetryConfig() {
        return RetryConfig.builder()
            .maxAttempts(5)
            .initialDelay(Duration.ofSeconds(1))
            .maxDelay(Duration.ofSeconds(30))
            .strategy(RetryStrategy.EXPONENTIAL)
            .multiplier(2.0)
            .build();
    }
    
    // 数据库操作重试配置
    public static RetryConfig databaseRetryConfig() {
        return RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofMillis(500))
            .maxDelay(Duration.ofSeconds(5))
            .strategy(RetryStrategy.FIXED)
            .build();
    }
    
    // 文件操作重试配置
    public static RetryConfig fileRetryConfig() {
        return RetryConfig.builder()
            .maxAttempts(3)
            .initialDelay(Duration.ofSeconds(1))
            .strategy(RetryStrategy.FIBONACCI)
            .build();
    }
}
```

### 2. 监控和告警

```java
// 任务执行监控
public class TaskExecutionMonitor {
    private final MeterRegistry meterRegistry;
    
    public TaskExecutionMonitor(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }
    
    public void recordTaskExecution(String taskName, boolean success, long durationMs) {
        Timer.Sample sample = Timer.start(meterRegistry);
        sample.stop(Timer.builder("task.execution")
            .tag("task", taskName)
            .tag("success", String.valueOf(success))
            .register(meterRegistry));
        
        // 记录执行时间分布
        DistributionSummary.builder("task.duration")
            .tag("task", taskName)
            .register(meterRegistry)
            .record(durationMs);
    }
    
    public void recordRetry(String taskName, int retryCount) {
        Counter.builder("task.retry")
            .tag("task", taskName)
            .register(meterRegistry)
            .increment(retryCount);
    }
    
    public void recordTimeout(String taskName) {
        Counter.builder("task.timeout")
            .tag("task", taskName)
            .register(meterRegistry)
            .increment();
    }
}
```

## 总结

任务执行与容错机制是构建高可用分布式调度系统的关键技术。通过实现完善的重试机制、超时控制、中断执行和幂等性保障，我们可以显著提高系统的稳定性和可靠性。

关键要点包括：

1. **重试机制**：通过指数退避等策略处理临时性故障
2. **超时控制**：防止任务无限期执行，提高系统响应性
3. **中断执行**：允许主动终止长时间运行的任务
4. **幂等性保障**：确保重复操作不会产生副作用
5. **监控告警**：实时监控任务执行状态，及时发现和处理问题

在实际应用中，需要根据具体的业务场景和系统要求，合理配置这些容错机制，并建立完善的监控体系，确保系统能够稳定可靠地运行。

在下一章中，我们将探讨调度性能优化，包括大规模任务并发调度、数据分片与批处理优化、调度延迟与准确性等关键技术。