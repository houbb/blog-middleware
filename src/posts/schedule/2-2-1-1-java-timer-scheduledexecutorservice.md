---
title: 2.1 基于 Java Timer/ScheduledExecutorService
date: 2025-08-30
categories: [Schedule]
tags: [schedule]
published: true
---

在分布式任务调度系统的演进过程中，从单机调度器开始学习是理解复杂分布式调度原理的重要基础。Java 提供了内置的定时任务调度工具 Timer 和 ScheduledExecutorService，它们虽然适用于单机环境，但其设计思想和实现机制为构建分布式调度系统提供了宝贵的参考。本文将深入探讨这两种调度器的实现原理、使用方式以及它们的局限性。

## Java Timer 的实现与局限

Java Timer 是 JDK 1.3 引入的定时任务调度工具，它允许我们以简单的方式安排任务在将来的某个时间点执行，或者定期执行。

### Timer 的基本使用

```java
import java.util.Timer;
import java.util.TimerTask;
import java.util.Date;

// 定义一个定时任务
class MyTimerTask extends TimerTask {
    private String taskName;
    
    public MyTimerTask(String taskName) {
        this.taskName = taskName;
    }
    
    @Override
    public void run() {
        System.out.println("[" + new Date() + "] 执行任务: " + taskName);
        // 模拟任务执行时间
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        System.out.println("[" + new Date() + "] 任务完成: " + taskName);
    }
}

// 使用 Timer 调度任务
public class TimerExample {
    public static void main(String[] args) {
        Timer timer = new Timer("MyTimer");
        
        // 一次性任务：5秒后执行
        timer.schedule(new MyTimerTask("一次性任务"), 5000);
        
        // 周期性任务：立即开始，每隔3秒执行一次
        timer.scheduleAtFixedRate(new MyTimerTask("周期性任务"), 0, 3000);
        
        // 运行一段时间后取消
        try {
            Thread.sleep(20000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        timer.cancel();
        System.out.println("Timer 已取消");
    }
}
```

### Timer 的内部实现机制

```java
// Timer 的核心实现原理
public class TimerAnalysis {
    
    /*
     * Timer 的工作原理：
     * 1. 内部使用一个单独的后台线程执行所有任务
     * 2. 使用最小堆（TaskQueue）来管理任务的执行时间
     * 3. 通过 TaskQueue 的 wait/notify 机制实现任务调度
     */
    
    // TimerThread 是 Timer 的内部类，负责执行任务
    class TimerThread extends Thread {
        // 任务队列，实际上是一个最小堆
        private TaskQueue queue = new TaskQueue();
        
        public TimerThread(boolean isDaemon) {
            this.daemon = isDaemon;
        }
        
        public void run() {
            try {
                mainLoop();
            } finally {
                // 清理资源
                synchronized(queue) {
                    queue.clear();
                    queue = null;
                }
            }
        }
        
        private void mainLoop() {
            while (true) {
                try {
                    TimerTask task;
                    boolean taskFired;
                    synchronized(queue) {
                        // 如果队列为空，等待任务
                        while (queue.isEmpty() && !newTasksMayBeScheduled)
                            queue.wait();
                        if (queue.isEmpty())
                            break; // 队列为空且不允许新任务，退出循环
                        
                        // 获取最近需要执行的任务
                        long currentTime = System.currentTimeMillis();
                        task = queue.getMin();
                        long timeToWait = task.nextExecutionTime - currentTime;
                        
                        if (timeToWait <= 0) {
                            // 任务到期，准备执行
                            taskFired = true;
                            task.scheduleTime = task.period < 0 ? 
                                task.nextExecutionTime : currentTime + task.period;
                            task.nextExecutionTime += task.period;
                        } else {
                            // 任务未到期，等待
                            taskFired = false;
                            queue.wait(timeToWait);
                        }
                    }
                    
                    // 执行任务
                    if (taskFired) {
                        task.run();
                    }
                } catch (InterruptedException e) {
                    // 线程被中断，退出循环
                    break;
                }
            }
        }
    }
    
    // TaskQueue 是 Timer 的内部类，使用最小堆管理任务
    class TaskQueue {
        private TimerTask[] queue = new TimerTask[128];
        private int size = 0;
        
        // 添加任务
        void add(TimerTask task) {
            if (size + 1 == queue.length)
                queue = Arrays.copyOf(queue, 2*queue.length);
            
            queue[++size] = task;
            fixUp(size);
        }
        
        // 获取最近需要执行的任务
        TimerTask getMin() {
            return queue[1];
        }
        
        // 移除最近需要执行的任务
        TimerTask removeMin() {
            if (size == 0)
                return null;
                
            TimerTask result = queue[1];
            queue[1] = queue[size];
            queue[size--] = null;
            fixDown(1);
            return result;
        }
        
        // 堆的上浮操作
        private void fixUp(int k) {
            while (k > 1) {
                int j = k >> 1;
                if (queue[j].nextExecutionTime <= queue[k].nextExecutionTime)
                    break;
                TimerTask tmp = queue[j];
                queue[j] = queue[k];
                queue[k] = tmp;
                k = j;
            }
        }
        
        // 堆的下沉操作
        private void fixDown(int k) {
            while (true) {
                int j = k << 1;
                if (j > size)
                    break;
                if (j < size && 
                    queue[j].nextExecutionTime > queue[j+1].nextExecutionTime)
                    j++;
                if (queue[k].nextExecutionTime <= queue[j].nextExecutionTime)
                    break;
                TimerTask tmp = queue[j];
                queue[j] = queue[k];
                queue[k] = tmp;
                k = j;
            }
        }
    }
}
```

### Timer 的局限性

尽管 Timer 使用简单，但它存在一些重要的局限性：

```java
// Timer 局限性演示
public class TimerLimitations {
    
    // 1. 单线程执行问题
    public void singleThreadIssue() {
        Timer timer = new Timer();
        
        // 添加一个长时间运行的任务
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                System.out.println("长时间任务开始: " + new Date());
                try {
                    // 模拟长时间运行的任务
                    Thread.sleep(10000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                System.out.println("长时间任务结束: " + new Date());
            }
        }, 0, 2000);
        
        // 添加一个短时间任务
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                System.out.println("短时间任务执行: " + new Date());
            }
        }, 1000, 1000);
        
        // 结果：短时间任务会被长时间任务阻塞，无法按时执行
    }
    
    // 2. 异常处理问题
    public void exceptionHandlingIssue() {
        Timer timer = new Timer();
        
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                System.out.println("任务执行: " + new Date());
                // 抛出异常会导致整个 Timer 停止工作
                throw new RuntimeException("任务执行异常");
            }
        }, 0, 1000);
        
        // 结果：一旦任务抛出异常，Timer 就会终止，后续任务不会执行
    }
    
    // 3. 取消任务的问题
    public void taskCancellationIssue() {
        Timer timer = new Timer();
        TimerTask task = new TimerTask() {
            @Override
            public void run() {
                System.out.println("任务执行: " + new Date());
            }
        };
        
        timer.scheduleAtFixedRate(task, 0, 1000);
        
        // 取消任务
        task.cancel();
        
        // 问题：被取消的任务仍然在队列中，占用内存
        // 需要调用 timer.purge() 来清理已取消的任务
    }
}
```

## ScheduledExecutorService 的改进

ScheduledExecutorService 是 Java 5 引入的并发工具类，它解决了 Timer 的许多局限性，提供了更强大和灵活的调度功能。

### ScheduledExecutorService 的基本使用

```java
import java.util.concurrent.*;
import java.util.Date;

// 使用 ScheduledExecutorService
public class ScheduledExecutorServiceExample {
    
    public static void main(String[] args) {
        // 创建调度线程池
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
        
        // 一次性任务：5秒后执行
        ScheduledFuture<?> oneTimeTask = scheduler.schedule(
            new Runnable() {
                @Override
                public void run() {
                    System.out.println("[" + new Date() + "] 一次性任务执行");
                }
            }, 
            5, 
            TimeUnit.SECONDS
        );
        
        // 周期性任务：立即开始，每隔3秒执行一次
        ScheduledFuture<?> fixedRateTask = scheduler.scheduleAtFixedRate(
            new Runnable() {
                @Override
                public void run() {
                    System.out.println("[" + new Date() + "] 固定频率任务执行");
                    // 模拟任务执行时间
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
            },
            0,
            3,
            TimeUnit.SECONDS
        );
        
        // 固定延迟任务：任务完成后等待3秒再执行下一次
        ScheduledFuture<?> fixedDelayTask = scheduler.scheduleWithFixedDelay(
            new Runnable() {
                @Override
                public void run() {
                    System.out.println("[" + new Date() + "] 固定延迟任务执行");
                    // 模拟任务执行时间
                    try {
                        Thread.sleep(1000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
            },
            1,
            3,
            TimeUnit.SECONDS
        );
        
        // 运行一段时间后关闭
        try {
            Thread.sleep(20000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // 取消任务
        oneTimeTask.cancel(false);
        fixedRateTask.cancel(false);
        fixedDelayTask.cancel(false);
        
        // 关闭调度器
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        
        System.out.println("ScheduledExecutorService 已关闭");
    }
}
```

### ScheduledExecutorService 的内部实现

```java
// ScheduledExecutorService 的核心实现分析
public class ScheduledExecutorServiceAnalysis {
    
    /*
     * ScheduledThreadPoolExecutor 的关键特性：
     * 1. 使用线程池执行任务，支持并发执行多个任务
     * 2. 使用 DelayedWorkQueue 作为任务队列，基于堆实现
     * 3. 提供更好的异常处理机制
     * 4. 支持优雅关闭
     */
    
    // ScheduledThreadPoolExecutor 的核心实现
    public class ScheduledThreadPoolExecutorAnalysis extends ThreadPoolExecutor {
        
        // 任务装饰器，用于支持调度功能
        private class ScheduledFutureTask<V> extends FutureTask<V> implements RunnableScheduledFuture<V> {
            // 任务序列号，用于保证任务的唯一性
            private final long sequenceNumber;
            // 任务的执行时间
            private long time;
            // 任务周期（正数表示固定频率，负数表示固定延迟，0表示一次性任务）
            private final long period;
            // 任务在队列中的索引
            private volatile int heapIndex;
            
            ScheduledFutureTask(Runnable r, V result, long ns) {
                this(r, result, ns, 0);
            }
            
            ScheduledFutureTask(Runnable r, V result, long ns, long period) {
                super(r, result);
                this.time = ns;
                this.period = period;
                this.sequenceNumber = sequencer.getAndIncrement();
            }
            
            // 比较任务的执行时间
            public int compareTo(Delayed other) {
                if (other == this)
                    return 0;
                if (other instanceof ScheduledFutureTask) {
                    ScheduledFutureTask<?> x = (ScheduledFutureTask<?>)other;
                    long diff = time - x.time;
                    if (diff < 0)
                        return -1;
                    else if (diff > 0)
                        return 1;
                    else if (sequenceNumber < x.sequenceNumber)
                        return -1;
                    else
                        return 1;
                }
                long d = (getDelay(TimeUnit.NANOSECONDS) - 
                         other.getDelay(TimeUnit.NANOSECONDS));
                return (d == 0) ? 0 : ((d < 0) ? -1 : 1);
            }
            
            // 执行任务
            public void run() {
                boolean periodic = isPeriodic();
                if (!canRunInCurrentRunState(periodic))
                    cancel(false);
                else if (!periodic)
                    ScheduledFutureTask.super.run();
                else if (ScheduledFutureTask.super.runAndReset()) {
                    setNextRunTime();
                    reExecutePeriodic(this);
                }
            }
            
            // 设置下一次执行时间
            private void setNextRunTime() {
                long p = period;
                if (p > 0)
                    time += p;
                else
                    time = triggerTime(-p);
            }
        }
        
        // 延迟工作队列
        static class DelayedWorkQueue extends AbstractQueue<Runnable> implements BlockingQueue<Runnable> {
            // 队列容量
            private static final int INITIAL_CAPACITY = 16;
            // 存储任务的数组
            private RunnableScheduledFuture<?>[] queue = new RunnableScheduledFuture<?>[INITIAL_CAPACITY];
            // 队列锁
            private final ReentrantLock lock = new ReentrantLock();
            // 队列大小
            private int size = 0;
            // 领导线程，用于减少不必要的等待
            private Thread leader = null;
            // 条件变量，用于通知等待的线程
            private final Condition available = lock.newCondition();
            
            // 添加任务
            public boolean offer(Runnable x) {
                if (x == null)
                    throw new NullPointerException();
                RunnableScheduledFuture<?> e = (RunnableScheduledFuture<?>)x;
                final ReentrantLock lock = this.lock;
                lock.lock();
                try {
                    int i = size;
                    if (i >= queue.length)
                        grow();
                    size = i + 1;
                    if (i == 0) {
                        queue[0] = e;
                        setIndex(e, 0);
                    } else {
                        siftUp(i, e);
                    }
                    if (queue[0] == e) {
                        leader = null;
                        available.signal();
                    }
                } finally {
                    lock.unlock();
                }
                return true;
            }
            
            // 堆的上浮操作
            private void siftUp(int k, RunnableScheduledFuture<?> key) {
                while (k > 0) {
                    int parent = (k - 1) >>> 1;
                    RunnableScheduledFuture<?> e = queue[parent];
                    if (key.compareTo(e) >= 0)
                        break;
                    queue[k] = e;
                    setIndex(e, k);
                    k = parent;
                }
                queue[k] = key;
                setIndex(key, k);
            }
        }
    }
}
```

### ScheduledExecutorService 的优势

```java
// ScheduledExecutorService 的优势演示
public class ScheduledExecutorServiceAdvantages {
    
    // 1. 多线程并发执行
    public void concurrentExecution() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(3);
        
        // 添加多个长时间运行的任务
        for (int i = 0; i < 3; i++) {
            final int taskId = i;
            scheduler.scheduleAtFixedRate(new Runnable() {
                @Override
                public void run() {
                    System.out.println("[" + new Date() + "] 任务 " + taskId + " 开始执行");
                    try {
                        // 模拟长时间运行的任务
                        Thread.sleep(5000);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    System.out.println("[" + new Date() + "] 任务 " + taskId + " 执行完成");
                }
            }, 0, 10, TimeUnit.SECONDS);
        }
        
        // 结果：三个任务可以并发执行，不会相互阻塞
    }
    
    // 2. 更好的异常处理
    public void betterExceptionHandling() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
        
        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                System.out.println("[" + new Date() + "] 任务执行");
                // 抛出异常不会影响调度器和其他任务
                if (Math.random() > 0.7) {
                    throw new RuntimeException("任务执行异常");
                }
            }
        }, 0, 1, TimeUnit.SECONDS);
        
        // 结果：单个任务的异常不会影响整个调度器和其他任务
    }
    
    // 3. 灵活的任务控制
    public void flexibleTaskControl() throws InterruptedException {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
        
        // 创建可取消的任务
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                System.out.println("[" + new Date() + "] 周期性任务执行");
            }
        }, 0, 2, TimeUnit.SECONDS);
        
        // 延迟一段时间后取消任务
        Thread.sleep(10000);
        future.cancel(false);
        
        // 检查任务是否已取消
        if (future.isCancelled()) {
            System.out.println("任务已成功取消");
        }
        
        // 关闭调度器
        scheduler.shutdown();
        if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
            scheduler.shutdownNow();
        }
    }
}
```

## 构建简单的调度器

基于对 Timer 和 ScheduledExecutorService 的理解，我们可以构建一个简单的调度器：

```java
// 简单的调度器实现
public class SimpleScheduler {
    private final ScheduledExecutorService executorService;
    private final Map<String, ScheduledFuture<?>> scheduledTasks;
    private final Object lock = new Object();
    
    public SimpleScheduler() {
        this.executorService = Executors.newScheduledThreadPool(10);
        this.scheduledTasks = new ConcurrentHashMap<>();
    }
    
    // 一次性任务
    public String scheduleOnce(Runnable task, long delay, TimeUnit unit) {
        String taskId = generateTaskId();
        ScheduledFuture<?> future = executorService.schedule(task, delay, unit);
        scheduledTasks.put(taskId, future);
        return taskId;
    }
    
    // 固定频率任务
    public String scheduleAtFixedRate(Runnable task, long initialDelay, long period, TimeUnit unit) {
        String taskId = generateTaskId();
        ScheduledFuture<?> future = executorService.scheduleAtFixedRate(task, initialDelay, period, unit);
        scheduledTasks.put(taskId, future);
        return taskId;
    }
    
    // 固定延迟任务
    public String scheduleWithFixedDelay(Runnable task, long initialDelay, long delay, TimeUnit unit) {
        String taskId = generateTaskId();
        ScheduledFuture<?> future = executorService.scheduleWithFixedDelay(task, initialDelay, delay, unit);
        scheduledTasks.put(taskId, future);
        return taskId;
    }
    
    // 取消任务
    public boolean cancelTask(String taskId) {
        ScheduledFuture<?> future = scheduledTasks.remove(taskId);
        if (future != null) {
            return future.cancel(false);
        }
        return false;
    }
    
    // 获取任务状态
    public TaskStatus getTaskStatus(String taskId) {
        ScheduledFuture<?> future = scheduledTasks.get(taskId);
        if (future == null) {
            return TaskStatus.NOT_FOUND;
        }
        if (future.isCancelled()) {
            return TaskStatus.CANCELLED;
        }
        if (future.isDone()) {
            return TaskStatus.COMPLETED;
        }
        return TaskStatus.SCHEDULED;
    }
    
    // 关闭调度器
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
        scheduledTasks.clear();
    }
    
    // 生成任务ID
    private String generateTaskId() {
        return "task_" + System.currentTimeMillis() + "_" + ThreadLocalRandom.current().nextInt(1000);
    }
    
    // 任务状态枚举
    public enum TaskStatus {
        SCHEDULED,    // 已调度
        RUNNING,      // 运行中
        COMPLETED,    // 已完成
        CANCELLED,    // 已取消
        NOT_FOUND     // 未找到
    }
}

// 使用示例
class SimpleSchedulerExample {
    public static void main(String[] args) throws InterruptedException {
        SimpleScheduler scheduler = new SimpleScheduler();
        
        // 创建一个简单的任务
        Runnable task = new Runnable() {
            @Override
            public void run() {
                System.out.println("[" + new Date() + "] 任务执行: " + Thread.currentThread().getName());
            }
        };
        
        // 调度不同类型的任务
        String onceTaskId = scheduler.scheduleOnce(task, 2, TimeUnit.SECONDS);
        String fixedRateTaskId = scheduler.scheduleAtFixedRate(task, 0, 3, TimeUnit.SECONDS);
        String fixedDelayTaskId = scheduler.scheduleWithFixedDelay(task, 1, 4, TimeUnit.SECONDS);
        
        // 查看任务状态
        System.out.println("一次性任务状态: " + scheduler.getTaskStatus(onceTaskId));
        System.out.println("固定频率任务状态: " + scheduler.getTaskStatus(fixedRateTaskId));
        System.out.println("固定延迟任务状态: " + scheduler.getTaskStatus(fixedDelayTaskId));
        
        // 运行一段时间
        Thread.sleep(15000);
        
        // 取消部分任务
        scheduler.cancelTask(fixedDelayTaskId);
        System.out.println("取消固定延迟任务后状态: " + scheduler.getTaskStatus(fixedDelayTaskId));
        
        // 关闭调度器
        scheduler.shutdown();
        System.out.println("调度器已关闭");
    }
}
```

## 总结

Java 内置的 Timer 和 ScheduledExecutorService 为我们提供了实现定时任务调度的基础工具。虽然它们主要用于单机环境，但其设计思想和实现机制对理解分布式调度系统具有重要价值：

1. **Timer** 简单易用，但存在单线程执行、异常处理不当等局限性
2. **ScheduledExecutorService** 提供了更强大和灵活的功能，支持多线程并发执行、更好的异常处理和任务控制
3. 基于这些工具，我们可以构建更复杂的调度系统，为后续学习分布式调度打下坚实基础

在下一节中，我们将探讨简单的 Cron 表达式解析实现，进一步提升调度器的功能。