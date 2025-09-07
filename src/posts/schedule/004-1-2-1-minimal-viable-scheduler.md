---
title: 最小可用调度器
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度的学习过程中，理论知识固然重要，但动手实践更能加深理解。本文将带领读者从零开始，构建一个最小可用的调度器，通过实际代码演示调度器的核心工作机制。这个简单的调度器虽然功能有限，但它包含了任务调度的基本要素，为进一步学习复杂的分布式调度系统奠定基础。

## 基于 Java Timer/ScheduledExecutorService

Java 提供了内置的任务调度工具，我们可以基于这些工具快速构建一个简单的调度器。

### Timer 的基本使用

Java 的 [Timer](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/Timer.java#L53-L576) 类是最早的调度工具之一，它允许我们安排任务在将来的某个时间点执行或定期执行。

```java
import java.util.Timer;
import java.util.TimerTask;
import java.util.Date;

public class SimpleTimerExample {
    public static void main(String[] args) {
        Timer timer = new Timer();
        
        // 安排任务在指定时间执行
        timer.schedule(new SayHelloTask(), new Date(System.currentTimeMillis() + 5000));
        
        // 安排任务定期执行（延迟1秒后，每2秒执行一次）
        timer.scheduleAtFixedRate(new PrintTimeTask(), 1000, 2000);
        
        // 运行10秒后停止
        timer.schedule(new StopTimerTask(timer), 10000);
    }
}

class SayHelloTask extends TimerTask {
    @Override
    public void run() {
        System.out.println("Hello, World! Time: " + new Date());
    }
}

class PrintTimeTask extends TimerTask {
    @Override
    public void run() {
        System.out.println("Current time: " + new Date());
    }
}

class StopTimerTask extends TimerTask {
    private Timer timer;
    
    public StopTimerTask(Timer timer) {
        this.timer = timer;
    }
    
    @Override
    public void run() {
        System.out.println("Stopping timer...");
        timer.cancel();
    }
}
```

虽然 [Timer](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/Timer.java#L53-L576) 使用简单，但它存在一些局限性：
1. 单线程执行：所有任务都在同一个线程中执行，一个任务的延迟会影响其他任务
2. 异常处理：如果某个任务抛出异常，会导致整个 [Timer](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/Timer.java#L53-L576) 停止工作
3. 不支持线程池：无法利用多核 CPU 的优势

### ScheduledExecutorService 的改进

为了解决 [Timer](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/Timer.java#L53-L576) 的局限性，Java 5 引入了 [ScheduledExecutorService](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/concurrent/ScheduledExecutorService.java#L84-L301)，它基于线程池实现，提供了更好的并发性和健壮性。

```java
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class ScheduledExecutorExample {
    public static void main(String[] args) {
        // 创建一个包含3个线程的调度线程池
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(3);
        
        // 安排任务延迟执行
        scheduler.schedule(new SimpleTask("Delayed Task"), 2, TimeUnit.SECONDS);
        
        // 安排任务定期执行
        scheduler.scheduleAtFixedRate(
            new SimpleTask("Fixed Rate Task"), 
            1, 2, TimeUnit.SECONDS
        );
        
        // 安排任务以固定延迟执行
        scheduler.scheduleWithFixedDelay(
            new SimpleTask("Fixed Delay Task"), 
            1, 3, TimeUnit.SECONDS
        );
        
        // 运行15秒后关闭
        scheduler.schedule(() -> {
            System.out.println("Shutting down scheduler...");
            scheduler.shutdown();
        }, 15, TimeUnit.SECONDS);
    }
}

class SimpleTask implements Runnable {
    private String name;
    
    public SimpleTask(String name) {
        this.name = name;
    }
    
    @Override
    public void run() {
        System.out.println(name + " executed at: " + System.currentTimeMillis());
        // 模拟任务执行时间
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

[ScheduledExecutorService](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/concurrent/ScheduledExecutorService.java#L84-L301) 相比 [Timer](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/Timer.java#L53-L576) 有以下优势：
1. 多线程执行：可以并行执行多个任务
2. 更好的异常处理：一个任务的异常不会影响其他任务
3. 灵活的调度策略：支持固定频率和固定延迟两种调度模式

## 简单的 Cron 表达式解析

为了实现更灵活的时间调度，我们需要支持 Cron 表达式。让我们实现一个简单的 Cron 表达式解析器。

```java
import java.time.LocalDateTime;
import java.time.temporal.ChronoField;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class SimpleCronParser {
    private Set<Integer> seconds;
    private Set<Integer> minutes;
    private Set<Integer> hours;
    private Set<Integer> days;
    private Set<Integer> months;
    private Set<Integer> weekdays;
    
    public SimpleCronParser(String cronExpression) {
        String[] parts = cronExpression.split("\\s+");
        if (parts.length != 6) {
            throw new IllegalArgumentException("Invalid cron expression: " + cronExpression);
        }
        
        seconds = parseField(parts[0], 0, 59);
        minutes = parseField(parts[1], 0, 59);
        hours = parseField(parts[2], 0, 23);
        days = parseField(parts[3], 1, 31);
        months = parseField(parts[4], 1, 12);
        weekdays = parseField(parts[5], 0, 7);
    }
    
    private Set<Integer> parseField(String field, int min, int max) {
        Set<Integer> values = new HashSet<>();
        
        if ("*".equals(field)) {
            // 通配符，包含所有值
            for (int i = min; i <= max; i++) {
                values.add(i);
            }
        } else if (field.contains("/")) {
            // 步长表达式，如 */5
            String[] parts = field.split("/");
            int step = Integer.parseInt(parts[1]);
            int start = "*".equals(parts[0]) ? min : Integer.parseInt(parts[0]);
            for (int i = start; i <= max; i += step) {
                values.add(i);
            }
        } else if (field.contains(",")) {
            // 列表表达式，如 1,3,5
            String[] items = field.split(",");
            for (String item : items) {
                values.add(Integer.parseInt(item));
            }
        } else if (field.contains("-")) {
            // 范围表达式，如 1-5
            String[] range = field.split("-");
            int start = Integer.parseInt(range[0]);
            int end = Integer.parseInt(range[1]);
            for (int i = start; i <= end; i++) {
                values.add(i);
            }
        } else {
            // 单个值
            values.add(Integer.parseInt(field));
        }
        
        return values;
    }
    
    public boolean matches(LocalDateTime time) {
        return seconds.contains(time.getSecond()) &&
               minutes.contains(time.getMinute()) &&
               hours.contains(time.getHour()) &&
               days.contains(time.getDayOfMonth()) &&
               months.contains(time.getMonthValue()) &&
               weekdays.contains(time.getDayOfWeek().getValue() % 7);
    }
    
    public static void main(String[] args) {
        // 测试 Cron 表达式解析
        SimpleCronParser parser = new SimpleCronParser("0 */5 9-17 * * 1-5");
        
        // 检查时间是否匹配
        LocalDateTime testTime = LocalDateTime.of(2025, 9, 1, 10, 15, 0);
        System.out.println("Time " + testTime + " matches cron: " + parser.matches(testTime));
        
        testTime = LocalDateTime.of(2025, 9, 1, 10, 17, 0);
        System.out.println("Time " + testTime + " matches cron: " + parser.matches(testTime));
    }
}
```

## 单机定时任务实现

基于前面的组件，我们可以构建一个简单的单机定时任务调度器。

```java
import java.time.LocalDateTime;
import java.util.concurrent.*;

public class SimpleScheduler {
    private ScheduledExecutorService executorService;
    private ConcurrentHashMap<String, ScheduledFuture<?>> scheduledTasks;
    
    public SimpleScheduler() {
        this.executorService = Executors.newScheduledThreadPool(10);
        this.scheduledTasks = new ConcurrentHashMap<>();
    }
    
    public void scheduleTask(String taskId, Runnable task, String cronExpression) {
        SimpleCronParser parser = new SimpleCronParser(cronExpression);
        
        ScheduledFuture<?> future = executorService.scheduleAtFixedRate(() -> {
            LocalDateTime now = LocalDateTime.now();
            if (parser.matches(now)) {
                try {
                    task.run();
                } catch (Exception e) {
                    System.err.println("Task " + taskId + " execution failed: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        }, 0, 1, TimeUnit.MINUTES); // 每分钟检查一次
        
        scheduledTasks.put(taskId, future);
        System.out.println("Task " + taskId + " scheduled with cron: " + cronExpression);
    }
    
    public void cancelTask(String taskId) {
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
            System.out.println("Task " + taskId + " cancelled");
        }
    }
    
    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
    
    public static void main(String[] args) throws InterruptedException {
        SimpleScheduler scheduler = new SimpleScheduler();
        
        // 定义一个简单的任务
        Runnable task = () -> {
            System.out.println("Executing task at: " + LocalDateTime.now());
            // 模拟任务执行
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        };
        
        // 调度任务：每5分钟执行一次
        scheduler.scheduleTask("task1", task, "0 */5 * * * *");
        
        // 运行30秒后停止
        Thread.sleep(30000);
        scheduler.shutdown();
    }
}
```

## 核心设计要点

在实现最小可用调度器时，我们需要关注以下几个核心设计要点：

### 1. 任务管理

任务管理是调度器的核心功能，需要考虑：
- 任务的注册与注销
- 任务状态的维护
- 任务的唯一标识

### 2. 时间调度

时间调度决定了任务何时执行，需要考虑：
- 时间表达式的解析与匹配
- 调度精度与性能平衡
- 时区处理

### 3. 执行控制

执行控制确保任务正确执行，需要考虑：
- 并发执行控制
- 异常处理机制
- 资源限制与隔离

### 4. 系统监控

系统监控帮助我们了解调度器运行状态，需要考虑：
- 任务执行日志
- 性能指标收集
- 告警机制

## 性能优化考虑

虽然这是一个最小可用调度器，但我们仍需考虑一些基本的性能优化：

### 1. 线程池管理

合理配置线程池大小，避免资源浪费或竞争：
```java
// 根据任务特点配置线程池
int corePoolSize = Runtime.getRuntime().availableProcessors() * 2;
ScheduledExecutorService executor = Executors.newScheduledThreadPool(corePoolSize);
```

### 2. 时间检查优化

避免过于频繁的时间检查，平衡调度精度与系统开销：
```java
// 每分钟检查一次，而不是每秒检查
executorService.scheduleAtFixedRate(checkTask, 0, 1, TimeUnit.MINUTES);
```

### 3. 内存管理

及时清理已完成的任务，避免内存泄漏：
```java
// 任务完成后从映射中移除
scheduledTasks.remove(taskId);
```

## 扩展性设计

虽然这是一个最小实现，但我们可以考虑一些扩展性设计：

### 1. 插件化架构

通过接口设计，支持不同的任务类型：
```java
public interface SchedulableTask {
    void execute();
    boolean shouldExecute(LocalDateTime time);
}
```

### 2. 配置管理

支持外部配置文件，便于管理任务：
```java
// 从配置文件加载任务定义
Properties props = new Properties();
props.load(new FileInputStream("scheduler.properties"));
```

### 3. 监控集成

提供监控接口，便于集成监控系统：
```java
public interface SchedulerMonitor {
    void onTaskScheduled(String taskId);
    void onTaskExecuted(String taskId, long executionTime);
    void onTaskFailed(String taskId, Exception error);
}
```

## 总结

通过本文的实践，我们实现了一个最小可用的调度器，它虽然功能简单，但涵盖了任务调度的核心概念。这个调度器基于 Java 的 [ScheduledExecutorService](file:///d:/dev/java/jdk1.8.0_201/src.zip!/java/util/concurrent/ScheduledExecutorService.java#L84-L301)，支持基本的 Cron 表达式解析，并能管理单机环境下的定时任务。

虽然这个调度器还不能满足生产环境的需求，但它为我们理解分布式调度系统的工作原理提供了坚实的基础。在下一章中，我们将在此基础上扩展功能，实现一个具备分布式特性的调度系统雏形。

通过动手实践，我们不仅加深了对调度器工作原理的理解，也掌握了实现任务调度系统的关键技术要点。这些经验将为我们在后续章节中学习和使用成熟的分布式调度框架打下坚实的基础。