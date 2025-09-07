---
title: "压测与容量规划: 通过限流平台模拟流量，进行全链路压测，找出系统瓶颈"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在分布式系统中，容量规划是确保系统稳定性和性能的关键环节。通过限流平台进行压测和容量规划，可以帮助我们准确评估系统的处理能力，识别性能瓶颈，优化资源配置，并为限流策略的制定提供科学依据。本章将深入探讨如何利用限流平台进行全链路压测，分析压测结果，制定合理的容量规划策略。

## 压测平台架构设计

### 压测任务管理

```java
// 压测任务管理器
@Component
public class LoadTestManager {
    private final LoadTestTaskRepository taskRepository;
    private final LoadTestExecutor testExecutor;
    private final MetricsCollector metricsCollector;
    private final NotificationService notificationService;
    private final ScheduledExecutorService scheduler;
    private final Map<String, LoadTestTask> runningTasks = new ConcurrentHashMap<>();
    
    public LoadTestManager(LoadTestTaskRepository taskRepository,
                          LoadTestExecutor testExecutor,
                          MetricsCollector metricsCollector,
                          NotificationService notificationService) {
        this.taskRepository = taskRepository;
        this.testExecutor = testExecutor;
        this.metricsCollector = metricsCollector;
        this.notificationService = notificationService;
        this.scheduler = Executors.newScheduledThreadPool(5);
    }
    
    public String createLoadTestTask(LoadTestTaskRequest request) {
        try {
            // 创建压测任务
            LoadTestTask task = new LoadTestTask();
            task.setId(UUID.randomUUID().toString());
            task.setName(request.getName());
            task.setDescription(request.getDescription());
            task.setTargetService(request.getTargetService());
            task.setTargetApi(request.getTargetApi());
            task.setTestScenario(request.getTestScenario());
            task.setDuration(request.getDuration());
            task.setConcurrency(request.getConcurrency());
            task.setRampUpPeriod(request.getRampUpPeriod());
            task.setTestParameters(request.getTestParameters());
            task.setStatus(LoadTestTaskStatus.PENDING);
            task.setCreatedBy(request.getCreatedBy());
            task.setCreatedAt(System.currentTimeMillis());
            task.setScheduledAt(request.getScheduledAt());
            
            // 保存任务
            taskRepository.save(task);
            
            log.info("Created load test task: {}", task.getId());
            
            // 如果是立即执行的任务，启动执行
            if (task.getScheduledAt() <= System.currentTimeMillis()) {
                startLoadTestTask(task.getId());
            } else {
                // 调度定时执行
                scheduleTaskExecution(task);
            }
            
            return task.getId();
        } catch (Exception e) {
            log.error("Failed to create load test task", e);
            throw new RuntimeException("Failed to create load test task", e);
        }
    }
    
    public void startLoadTestTask(String taskId) {
        try {
            LoadTestTask task = taskRepository.findById(taskId);
            if (task == null) {
                throw new IllegalArgumentException("Task not found: " + taskId);
            }
            
            if (task.getStatus() != LoadTestTaskStatus.PENDING && 
                task.getStatus() != LoadTestTaskStatus.SCHEDULED) {
                throw new IllegalStateException("Task is not in a startable state: " + task.getStatus());
            }
            
            // 更新任务状态
            task.setStatus(LoadTestTaskStatus.RUNNING);
            task.setStartedAt(System.currentTimeMillis());
            taskRepository.update(task);
            
            // 记录任务开始
            runningTasks.put(taskId, task);
            
            // 启动压测执行
            testExecutor.executeTask(task);
            
            log.info("Started load test task: {}", taskId);
        } catch (Exception e) {
            log.error("Failed to start load test task: " + taskId, e);
            // 更新任务状态为失败
            updateTaskStatus(taskId, LoadTestTaskStatus.FAILED, e.getMessage());
            throw new RuntimeException("Failed to start load test task", e);
        }
    }
    
    public void stopLoadTestTask(String taskId) {
        try {
            LoadTestTask task = runningTasks.get(taskId);
            if (task == null) {
                throw new IllegalArgumentException("Task not running: " + taskId);
            }
            
            // 停止压测执行
            testExecutor.stopTask(taskId);
            
            // 更新任务状态
            updateTaskStatus(taskId, LoadTestTaskStatus.COMPLETED, "Manually stopped");
            
            log.info("Stopped load test task: {}", taskId);
        } catch (Exception e) {
            log.error("Failed to stop load test task: " + taskId, e);
            throw new RuntimeException("Failed to stop load test task", e);
        }
    }
    
    private void scheduleTaskExecution(LoadTestTask task) {
        long delay = task.getScheduledAt() - System.currentTimeMillis();
        if (delay > 0) {
            scheduler.schedule(() -> {
                try {
                    startLoadTestTask(task.getId());
                } catch (Exception e) {
                    log.error("Failed to execute scheduled task: " + task.getId(), e);
                    updateTaskStatus(task.getId(), LoadTestTaskStatus.FAILED, e.getMessage());
                }
            }, delay, TimeUnit.MILLISECONDS);
        }
    }
    
    private void updateTaskStatus(String taskId, LoadTestTaskStatus status, String message) {
        try {
            LoadTestTask task = taskRepository.findById(taskId);
            if (task != null) {
                task.setStatus(status);
                task.setMessage(message);
                if (status == LoadTestTaskStatus.COMPLETED || status == LoadTestTaskStatus.FAILED) {
                    task.setEndedAt(System.currentTimeMillis());
                }
                taskRepository.update(task);
                
                // 从运行任务列表中移除
                runningTasks.remove(taskId);
                
                // 发送通知
                notificationService.sendTaskStatusNotification(task);
            }
        } catch (Exception e) {
            log.error("Failed to update task status: " + taskId, e);
        }
    }
    
    public List<LoadTestTask> getTaskList(LoadTestTaskStatus status, int page, int size) {
        return taskRepository.findByStatus(status, page, size);
    }
    
    public LoadTestTask getTaskDetail(String taskId) {
        return taskRepository.findById(taskId);
    }
    
    // 压测任务请求
    public static class LoadTestTaskRequest {
        private String name;
        private String description;
        private String targetService;
        private String targetApi;
        private String testScenario;
        private long duration; // 测试持续时间（秒）
        private int concurrency; // 并发数
        private int rampUpPeriod; // 预热时间（秒）
        private Map<String, Object> testParameters;
        private String createdBy;
        private long scheduledAt;
        
        // 构造函数和getter/setter方法
        public LoadTestTaskRequest() {
            this.testParameters = new HashMap<>();
        }
        
        // getter和setter方法
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getTargetService() { return targetService; }
        public void setTargetService(String targetService) { this.targetService = targetService; }
        public String getTargetApi() { return targetApi; }
        public void setTargetApi(String targetApi) { this.targetApi = targetApi; }
        public String getTestScenario() { return testScenario; }
        public void setTestScenario(String testScenario) { this.testScenario = testScenario; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }
        public int getConcurrency() { return concurrency; }
        public void setConcurrency(int concurrency) { this.concurrency = concurrency; }
        public int getRampUpPeriod() { return rampUpPeriod; }
        public void setRampUpPeriod(int rampUpPeriod) { this.rampUpPeriod = rampUpPeriod; }
        public Map<String, Object> getTestParameters() { return testParameters; }
        public void setTestParameters(Map<String, Object> testParameters) { this.testParameters = testParameters; }
        public String getCreatedBy() { return createdBy; }
        public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
        public long getScheduledAt() { return scheduledAt; }
        public void setScheduledAt(long scheduledAt) { this.scheduledAt = scheduledAt; }
    }
    
    // 压测任务状态枚举
    public enum LoadTestTaskStatus {
        PENDING,     // 待执行
        SCHEDULED,   // 已调度
        RUNNING,     // 运行中
        COMPLETED,   // 已完成
        FAILED,      // 失败
        CANCELLED    // 已取消
    }
}
```

### 压测执行引擎

```java
// 压测执行器
@Component
public class LoadTestExecutor {
    private final LoadTestTaskRepository taskRepository;
    private final TestScenarioExecutor scenarioExecutor;
    private final MetricsCollector metricsCollector;
    private final ResultAnalyzer resultAnalyzer;
    private final ScheduledExecutorService executionScheduler;
    private final Map<String, LoadTestContext> activeTests = new ConcurrentHashMap<>();
    
    public LoadTestExecutor(LoadTestTaskRepository taskRepository,
                          TestScenarioExecutor scenarioExecutor,
                          MetricsCollector metricsCollector,
                          ResultAnalyzer resultAnalyzer) {
        this.taskRepository = taskRepository;
        this.scenarioExecutor = scenarioExecutor;
        this.metricsCollector = metricsCollector;
        this.resultAnalyzer = resultAnalyzer;
        this.executionScheduler = Executors.newScheduledThreadPool(10);
    }
    
    public void executeTask(LoadTestTask task) {
        try {
            // 创建压测上下文
            LoadTestContext context = new LoadTestContext();
            context.setTaskId(task.getId());
            context.setTargetService(task.getTargetService());
            context.setTargetApi(task.getTargetApi());
            context.setDuration(task.getDuration());
            context.setConcurrency(task.getConcurrency());
            context.setRampUpPeriod(task.getRampUpPeriod());
            context.setTestParameters(task.getTestParameters());
            context.setStartTime(System.currentTimeMillis());
            
            // 保存上下文
            activeTests.put(task.getId(), context);
            
            // 启动压测执行
            executeLoadTest(context);
            
            log.info("Started load test execution for task: {}", task.getId());
        } catch (Exception e) {
            log.error("Failed to execute load test task: " + task.getId(), e);
            failTask(task.getId(), e);
        }
    }
    
    private void executeLoadTest(LoadTestContext context) {
        // 启动指标收集
        startMetricsCollection(context);
        
        // 执行测试场景
        executeTestScenario(context);
        
        // 定时结束测试
        executionScheduler.schedule(() -> {
            try {
                finishLoadTest(context);
            } catch (Exception e) {
                log.error("Failed to finish load test: " + context.getTaskId(), e);
                failTask(context.getTaskId(), e);
            }
        }, context.getDuration(), TimeUnit.SECONDS);
    }
    
    private void startMetricsCollection(LoadTestContext context) {
        // 启动实时指标收集
        executionScheduler.scheduleAtFixedRate(() -> {
            try {
                collectRealTimeMetrics(context);
            } catch (Exception e) {
                log.warn("Failed to collect real-time metrics for task: " + context.getTaskId(), e);
            }
        }, 0, 1, TimeUnit.SECONDS);
    }
    
    private void executeTestScenario(LoadTestContext context) {
        try {
            // 创建并发执行器
            ExecutorService testExecutor = Executors.newFixedThreadPool(context.getConcurrency());
            
            // 计算预热阶段的请求数
            long rampUpRequests = calculateRampUpRequests(context);
            
            // 预热阶段
            if (context.getRampUpPeriod() > 0) {
                executeRampUpPhase(context, testExecutor, rampUpRequests);
            }
            
            // 主测试阶段
            executeMainTestPhase(context, testExecutor);
            
            // 关闭执行器
            testExecutor.shutdown();
            testExecutor.awaitTermination(30, TimeUnit.SECONDS);
            
        } catch (Exception e) {
            log.error("Failed to execute test scenario for task: " + context.getTaskId(), e);
            throw new RuntimeException("Test scenario execution failed", e);
        }
    }
    
    private long calculateRampUpRequests(LoadTestContext context) {
        // 简化的预热请求数计算
        return context.getConcurrency() * context.getRampUpPeriod() / 10;
    }
    
    private void executeRampUpPhase(LoadTestContext context, ExecutorService executor, 
                                  long rampUpRequests) {
        log.info("Starting ramp-up phase for task: {}, requests: {}", 
                context.getTaskId(), rampUpRequests);
        
        CountDownLatch latch = new CountDownLatch((int) rampUpRequests);
        
        // 分批执行预热请求
        for (int i = 0; i < rampUpRequests; i++) {
            executor.submit(() -> {
                try {
                    scenarioExecutor.executeScenario(context, true); // 预热模式
                } catch (Exception e) {
                    log.warn("Ramp-up request failed", e);
                } finally {
                    latch.countDown();
                }
            });
            
            // 控制预热速度
            try {
                Thread.sleep(context.getRampUpPeriod() * 1000 / rampUpRequests);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        
        try {
            // 等待预热完成
            latch.await(context.getRampUpPeriod(), TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        log.info("Ramp-up phase completed for task: {}", context.getTaskId());
    }
    
    private void executeMainTestPhase(LoadTestContext context, ExecutorService executor) {
        log.info("Starting main test phase for task: {}", context.getTaskId());
        
        long testStartTime = System.currentTimeMillis();
        long testEndTime = testStartTime + context.getDuration() * 1000;
        
        // 持续发送请求直到测试结束
        while (System.currentTimeMillis() < testEndTime) {
            executor.submit(() -> {
                try {
                    scenarioExecutor.executeScenario(context, false); // 正常模式
                } catch (Exception e) {
                    log.warn("Test request failed", e);
                }
            });
            
            // 控制请求发送频率
            try {
                Thread.sleep(10); // 10ms间隔
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        
        log.info("Main test phase completed for task: {}", context.getTaskId());
    }
    
    private void collectRealTimeMetrics(LoadTestContext context) {
        try {
            // 收集实时指标
            RealTimeMetrics metrics = new RealTimeMetrics();
            metrics.setTaskId(context.getTaskId());
            metrics.setTimestamp(System.currentTimeMillis());
            metrics.setCurrentConcurrency(getCurrentConcurrency(context));
            metrics.setCurrentRps(getCurrentRps(context));
            metrics.setAvgResponseTime(getAverageResponseTime(context));
            metrics.setErrorRate(getErrorRate(context));
            
            // 存储指标
            metricsCollector.storeRealTimeMetrics(metrics);
        } catch (Exception e) {
            log.warn("Failed to collect real-time metrics", e);
        }
    }
    
    private int getCurrentConcurrency(LoadTestContext context) {
        // 获取当前并发数
        return context.getConcurrency(); // 简化实现
    }
    
    private double getCurrentRps(LoadTestContext context) {
        // 计算当前RPS
        return 0.0; // 简化实现
    }
    
    private double getAverageResponseTime(LoadTestContext context) {
        // 获取平均响应时间
        return 0.0; // 简化实现
    }
    
    private double getErrorRate(LoadTestContext context) {
        // 计算错误率
        return 0.0; // 简化实现
    }
    
    private void finishLoadTest(LoadTestContext context) {
        try {
            // 停止指标收集
            stopMetricsCollection(context);
            
            // 收集最终结果
            LoadTestResult result = collectFinalResult(context);
            
            // 分析结果
            TestAnalysisReport analysis = resultAnalyzer.analyzeResult(result);
            
            // 保存结果
            saveTestResult(context.getTaskId(), result, analysis);
            
            // 更新任务状态
            completeTask(context.getTaskId());
            
            log.info("Load test completed successfully for task: {}", context.getTaskId());
        } catch (Exception e) {
            log.error("Failed to finish load test: " + context.getTaskId(), e);
            failTask(context.getTaskId(), e);
        } finally {
            // 清理上下文
            activeTests.remove(context.getTaskId());
        }
    }
    
    private void stopMetricsCollection(LoadTestContext context) {
        // 停止指标收集
    }
    
    private LoadTestResult collectFinalResult(LoadTestContext context) {
        LoadTestResult result = new LoadTestResult();
        result.setTaskId(context.getTaskId());
        result.setStartTime(context.getStartTime());
        result.setEndTime(System.currentTimeMillis());
        result.setDuration(context.getDuration());
        result.setConcurrency(context.getConcurrency());
        
        // 收集最终指标
        result.setTotalRequests(getTotalRequests(context));
        result.setSuccessfulRequests(getSuccessfulRequests(context));
        result.setFailedRequests(getFailedRequests(context));
        result.setAvgResponseTime(getFinalAverageResponseTime(context));
        result.setMaxResponseTime(getMaxResponseTime(context));
        result.setMinResponseTime(getMinResponseTime(context));
        result.setPercentiles(calculatePercentiles(context));
        
        return result;
    }
    
    private long getTotalRequests(LoadTestContext context) {
        return 0; // 简化实现
    }
    
    private long getSuccessfulRequests(LoadTestContext context) {
        return 0; // 简化实现
    }
    
    private long getFailedRequests(LoadTestContext context) {
        return 0; // 简化实现
    }
    
    private double getFinalAverageResponseTime(LoadTestContext context) {
        return 0.0; // 简化实现
    }
    
    private long getMaxResponseTime(LoadTestContext context) {
        return 0; // 简化实现
    }
    
    private long getMinResponseTime(LoadTestContext context) {
        return 0; // 简化实现
    }
    
    private Map<String, Double> calculatePercentiles(LoadTestContext context) {
        Map<String, Double> percentiles = new HashMap<>();
        percentiles.put("P50", 0.0);
        percentiles.put("P90", 0.0);
        percentiles.put("P95", 0.0);
        percentiles.put("P99", 0.0);
        return percentiles;
    }
    
    private void saveTestResult(String taskId, LoadTestResult result, 
                              TestAnalysisReport analysis) {
        // 保存测试结果和分析报告
        taskRepository.saveTestResult(taskId, result, analysis);
    }
    
    private void completeTask(String taskId) {
        try {
            LoadTestTask task = taskRepository.findById(taskId);
            if (task != null) {
                task.setStatus(LoadTestManager.LoadTestTaskStatus.COMPLETED);
                task.setEndedAt(System.currentTimeMillis());
                taskRepository.update(task);
            }
        } catch (Exception e) {
            log.error("Failed to complete task: " + taskId, e);
        }
    }
    
    private void failTask(String taskId, Exception error) {
        try {
            LoadTestTask task = taskRepository.findById(taskId);
            if (task != null) {
                task.setStatus(LoadTestManager.LoadTestTaskStatus.FAILED);
                task.setMessage(error.getMessage());
                task.setEndedAt(System.currentTimeMillis());
                taskRepository.update(task);
            }
        } catch (Exception e) {
            log.error("Failed to mark task as failed: " + taskId, e);
        }
        
        // 从活动测试中移除
        activeTests.remove(taskId);
    }
    
    public void stopTask(String taskId) {
        LoadTestContext context = activeTests.get(taskId);
        if (context != null) {
            // 停止测试执行
            finishLoadTest(context);
        }
    }
    
    // 压测上下文
    public static class LoadTestContext {
        private String taskId;
        private String targetService;
        private String targetApi;
        private long duration;
        private int concurrency;
        private int rampUpPeriod;
        private Map<String, Object> testParameters;
        private long startTime;
        private final List<TestRequestRecord> requestRecords = new CopyOnWriteArrayList<>();
        
        // getter和setter方法
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public String getTargetService() { return targetService; }
        public void setTargetService(String targetService) { this.targetService = targetService; }
        public String getTargetApi() { return targetApi; }
        public void setTargetApi(String targetApi) { this.targetApi = targetApi; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }
        public int getConcurrency() { return concurrency; }
        public void setConcurrency(int concurrency) { this.concurrency = concurrency; }
        public int getRampUpPeriod() { return rampUpPeriod; }
        public void setRampUpPeriod(int rampUpPeriod) { this.rampUpPeriod = rampUpPeriod; }
        public Map<String, Object> getTestParameters() { return testParameters; }
        public void setTestParameters(Map<String, Object> testParameters) { this.testParameters = testParameters; }
        public long getStartTime() { return startTime; }
        public void setStartTime(long startTime) { this.startTime = startTime; }
        public List<TestRequestRecord> getRequestRecords() { return requestRecords; }
    }
    
    // 测试请求记录
    public static class TestRequestRecord {
        private long timestamp;
        private long responseTime;
        private boolean success;
        private String errorMessage;
        private Map<String, Object> responseDetails;
        
        public TestRequestRecord() {
            this.responseDetails = new HashMap<>();
        }
        
        // getter和setter方法
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public long getResponseTime() { return responseTime; }
        public void setResponseTime(long responseTime) { this.responseTime = responseTime; }
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getErrorMessage() { return errorMessage; }
        public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
        public Map<String, Object> getResponseDetails() { return responseDetails; }
        public void setResponseDetails(Map<String, Object> responseDetails) { this.responseDetails = responseDetails; }
    }
}
```

## 全链路压测实现

### 分布式压测协调

```java
// 分布式压测协调器
@Component
public class DistributedLoadTestCoordinator {
    private final LoadTestManager loadTestManager;
    private final ClusterNodeManager nodeManager;
    private final LoadTestTaskRepository taskRepository;
    private final MetricsCollector metricsCollector;
    private final ScheduledExecutorService coordinationScheduler;
    
    public DistributedLoadTestCoordinator(LoadTestManager loadTestManager,
                                        ClusterNodeManager nodeManager,
                                        LoadTestTaskRepository taskRepository,
                                        MetricsCollector metricsCollector) {
        this.loadTestManager = loadTestManager;
        this.nodeManager = nodeManager;
        this.taskRepository = taskRepository;
        this.metricsCollector = metricsCollector;
        this.coordinationScheduler = Executors.newScheduledThreadPool(2);
    }
    
    public void coordinateDistributedTest(String taskId) {
        try {
            LoadTestTask task = taskRepository.findById(taskId);
            if (task == null) {
                throw new IllegalArgumentException("Task not found: " + taskId);
            }
            
            // 获取活跃节点列表
            List<ClusterNode> activeNodes = nodeManager.getActiveNodes();
            if (activeNodes.isEmpty()) {
                throw new IllegalStateException("No active nodes available for distributed test");
            }
            
            // 计算每个节点的负载分配
            LoadDistribution distribution = calculateLoadDistribution(task, activeNodes);
            
            // 分发测试任务到各个节点
            distributeTestTasks(task, distribution);
            
            // 启动协调监控
            startCoordinationMonitoring(taskId, distribution);
            
            log.info("Started distributed load test coordination for task: {}", taskId);
        } catch (Exception e) {
            log.error("Failed to coordinate distributed load test: " + taskId, e);
            throw new RuntimeException("Distributed test coordination failed", e);
        }
    }
    
    private LoadDistribution calculateLoadDistribution(LoadTestTask task, 
                                                     List<ClusterNode> nodes) {
        LoadDistribution distribution = new LoadDistribution();
        distribution.setTaskId(task.getId());
        distribution.setTotalConcurrency(task.getConcurrency());
        distribution.setTotalDuration(task.getDuration());
        
        int nodeCount = nodes.size();
        int baseConcurrency = task.getConcurrency() / nodeCount;
        int remainingConcurrency = task.getConcurrency() % nodeCount;
        
        // 为每个节点分配负载
        for (int i = 0; i < nodeCount; i++) {
            NodeLoadAssignment assignment = new NodeLoadAssignment();
            assignment.setNodeId(nodes.get(i).getNodeId());
            assignment.setConcurrency(baseConcurrency + (i < remainingConcurrency ? 1 : 0));
            assignment.setDuration(task.getDuration());
            assignment.setRampUpPeriod(task.getRampUpPeriod());
            
            distribution.addNodeAssignment(assignment);
        }
        
        return distribution;
    }
    
    private void distributeTestTasks(LoadTestTask task, LoadDistribution distribution) {
        List<NodeLoadAssignment> assignments = distribution.getNodeAssignments();
        
        for (NodeLoadAssignment assignment : assignments) {
            try {
                // 构造节点测试任务
                NodeLoadTestTask nodeTask = new NodeLoadTestTask();
                nodeTask.setMasterTaskId(task.getId());
                nodeTask.setTargetService(task.getTargetService());
                nodeTask.setTargetApi(task.getTargetApi());
                nodeTask.setConcurrency(assignment.getConcurrency());
                nodeTask.setDuration(assignment.getDuration());
                nodeTask.setRampUpPeriod(assignment.getRampUpPeriod());
                nodeTask.setTestParameters(task.getTestParameters());
                
                // 发送到节点执行
                sendTaskToNode(assignment.getNodeId(), nodeTask);
                
                // 记录分配
                distribution.markNodeAssigned(assignment.getNodeId());
                
            } catch (Exception e) {
                log.error("Failed to distribute task to node: " + assignment.getNodeId(), e);
                distribution.markNodeFailed(assignment.getNodeId(), e.getMessage());
            }
        }
    }
    
    private void sendTaskToNode(String nodeId, NodeLoadTestTask nodeTask) {
        // 发送任务到指定节点
        // 这里应该通过RPC或HTTP调用节点的测试接口
        log.info("Sending test task to node: {}, concurrency: {}", 
                nodeId, nodeTask.getConcurrency());
    }
    
    private void startCoordinationMonitoring(String taskId, LoadDistribution distribution) {
        // 启动定期监控任务状态
        coordinationScheduler.scheduleAtFixedRate(() -> {
            try {
                monitorTestProgress(taskId, distribution);
            } catch (Exception e) {
                log.warn("Failed to monitor test progress for task: " + taskId, e);
            }
        }, 0, 5, TimeUnit.SECONDS);
        
        // 设置测试超时监控
        coordinationScheduler.schedule(() -> {
            try {
                checkTestTimeout(taskId, distribution);
            } catch (Exception e) {
                log.error("Failed to check test timeout for task: " + taskId, e);
            }
        }, distribution.getTotalDuration() + 60, TimeUnit.SECONDS);
    }
    
    private void monitorTestProgress(String taskId, LoadDistribution distribution) {
        // 收集各节点的进度信息
        List<NodeTestProgress> nodeProgresses = collectNodeProgresses(distribution);
        
        // 聚合进度信息
        AggregatedTestProgress aggregatedProgress = aggregateProgress(nodeProgresses);
        
        // 存储聚合进度
        metricsCollector.storeAggregatedProgress(taskId, aggregatedProgress);
        
        // 检查是否所有节点都已完成
        if (aggregatedProgress.isCompleted()) {
            completeDistributedTest(taskId, aggregatedProgress);
        }
    }
    
    private List<NodeTestProgress> collectNodeProgresses(LoadDistribution distribution) {
        List<NodeTestProgress> progresses = new ArrayList<>();
        
        for (NodeLoadAssignment assignment : distribution.getNodeAssignments()) {
            try {
                // 从节点获取进度信息
                NodeTestProgress progress = getNodeProgress(assignment.getNodeId());
                if (progress != null) {
                    progresses.add(progress);
                }
            } catch (Exception e) {
                log.warn("Failed to get progress from node: " + assignment.getNodeId(), e);
                // 记录节点失败
                NodeTestProgress failedProgress = new NodeTestProgress();
                failedProgress.setNodeId(assignment.getNodeId());
                failedProgress.setStatus(NodeTestStatus.FAILED);
                failedProgress.setErrorMessage(e.getMessage());
                progresses.add(failedProgress);
            }
        }
        
        return progresses;
    }
    
    private NodeTestProgress getNodeProgress(String nodeId) {
        // 通过RPC或HTTP从节点获取进度信息
        return null; // 简化实现
    }
    
    private AggregatedTestProgress aggregateProgress(List<NodeTestProgress> nodeProgresses) {
        AggregatedTestProgress aggregated = new AggregatedTestProgress();
        aggregated.setTimestamp(System.currentTimeMillis());
        
        long totalRequests = 0;
        long successfulRequests = 0;
        long failedRequests = 0;
        double totalResponseTime = 0;
        int completedNodes = 0;
        
        for (NodeTestProgress progress : nodeProgresses) {
            totalRequests += progress.getTotalRequests();
            successfulRequests += progress.getSuccessfulRequests();
            failedRequests += progress.getFailedRequests();
            totalResponseTime += progress.getAvgResponseTime() * progress.getTotalRequests();
            
            if (progress.getStatus() == NodeTestStatus.COMPLETED) {
                completedNodes++;
            }
        }
        
        aggregated.setTotalRequests(totalRequests);
        aggregated.setSuccessfulRequests(successfulRequests);
        aggregated.setFailedRequests(failedRequests);
        aggregated.setAvgResponseTime(totalRequests > 0 ? totalResponseTime / totalRequests : 0);
        aggregated.setCompleted(completedNodes == nodeProgresses.size());
        
        return aggregated;
    }
    
    private void checkTestTimeout(String taskId, LoadDistribution distribution) {
        // 检查测试是否超时
        LoadTestTask task = taskRepository.findById(taskId);
        if (task != null && task.getStatus() == LoadTestManager.LoadTestTaskStatus.RUNNING) {
            long expectedEndTime = task.getStartedAt() + distribution.getTotalDuration() * 1000 + 60000;
            if (System.currentTimeMillis() > expectedEndTime) {
                // 测试超时，标记为失败
                loadTestManager.stopLoadTestTask(taskId);
                log.warn("Distributed test timeout for task: {}", taskId);
            }
        }
    }
    
    private void completeDistributedTest(String taskId, AggregatedTestProgress progress) {
        try {
            // 收集最终结果
            DistributedTestResult result = collectDistributedResult(taskId, progress);
            
            // 保存结果
            taskRepository.saveDistributedTestResult(taskId, result);
            
            // 完成主任务
            loadTestManager.stopLoadTestTask(taskId);
            
            log.info("Distributed load test completed for task: {}", taskId);
        } catch (Exception e) {
            log.error("Failed to complete distributed test: " + taskId, e);
        }
    }
    
    private DistributedTestResult collectDistributedResult(String taskId, 
                                                         AggregatedTestProgress progress) {
        DistributedTestResult result = new DistributedTestResult();
        result.setTaskId(taskId);
        result.setTotalRequests(progress.getTotalRequests());
        result.setSuccessfulRequests(progress.getSuccessfulRequests());
        result.setFailedRequests(progress.getFailedRequests());
        result.setAvgResponseTime(progress.getAvgResponseTime());
        result.setCompletedAt(System.currentTimeMillis());
        
        return result;
    }
    
    // 负载分配信息
    public static class LoadDistribution {
        private String taskId;
        private int totalConcurrency;
        private long totalDuration;
        private final List<NodeLoadAssignment> nodeAssignments = new ArrayList<>();
        private final Map<String, Boolean> nodeAssigned = new ConcurrentHashMap<>();
        private final Map<String, String> nodeFailures = new ConcurrentHashMap<>();
        
        public void addNodeAssignment(NodeLoadAssignment assignment) {
            nodeAssignments.add(assignment);
        }
        
        public void markNodeAssigned(String nodeId) {
            nodeAssigned.put(nodeId, true);
        }
        
        public void markNodeFailed(String nodeId, String errorMessage) {
            nodeFailures.put(nodeId, errorMessage);
        }
        
        // getter方法
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public int getTotalConcurrency() { return totalConcurrency; }
        public void setTotalConcurrency(int totalConcurrency) { this.totalConcurrency = totalConcurrency; }
        public long getTotalDuration() { return totalDuration; }
        public void setTotalDuration(long totalDuration) { this.totalDuration = totalDuration; }
        public List<NodeLoadAssignment> getNodeAssignments() { return nodeAssignments; }
        public Map<String, Boolean> getNodeAssigned() { return nodeAssigned; }
        public Map<String, String> getNodeFailures() { return nodeFailures; }
    }
    
    // 节点负载分配
    public static class NodeLoadAssignment {
        private String nodeId;
        private int concurrency;
        private long duration;
        private int rampUpPeriod;
        
        // getter和setter方法
        public String getNodeId() { return nodeId; }
        public void setNodeId(String nodeId) { this.nodeId = nodeId; }
        public int getConcurrency() { return concurrency; }
        public void setConcurrency(int concurrency) { this.concurrency = concurrency; }
        public long getDuration() { return duration; }
        public void setDuration(long duration) { this.duration = duration; }
        public int getRampUpPeriod() { return rampUpPeriod; }
        public void setRampUpPeriod(int rampUpPeriod) { this.rampUpPeriod = rampUpPeriod; }
    }
}
```

## 瓶颈识别与分析

### 性能瓶颈检测

```java
// 性能瓶颈分析器
@Component
public class PerformanceBottleneckAnalyzer {
    private final MetricsQueryService metricsQueryService;
    private final TracingQueryService tracingQueryService;
    private final SystemMetricsCollector systemMetricsCollector;
    
    public PerformanceBottleneckAnalyzer(MetricsQueryService metricsQueryService,
                                       TracingQueryService tracingQueryService,
                                       SystemMetricsCollector systemMetricsCollector) {
        this.metricsQueryService = metricsQueryService;
        this.tracingQueryService = tracingQueryService;
        this.systemMetricsCollector = systemMetricsCollector;
    }
    
    public BottleneckAnalysisReport analyzeBottlenecks(String taskId, LoadTestResult result) {
        try {
            BottleneckAnalysisReport report = new BottleneckAnalysisReport();
            report.setTaskId(taskId);
            report.setAnalysisTime(System.currentTimeMillis());
            
            // 分析系统资源瓶颈
            analyzeSystemBottlenecks(report, taskId);
            
            // 分析应用性能瓶颈
            analyzeApplicationBottlenecks(report, taskId, result);
            
            // 分析调用链瓶颈
            analyzeCallChainBottlenecks(report, taskId);
            
            // 生成优化建议
            generateOptimizationRecommendations(report);
            
            return report;
        } catch (Exception e) {
            log.error("Failed to analyze bottlenecks for task: " + taskId, e);
            throw new RuntimeException("Bottleneck analysis failed", e);
        }
    }
    
    private void analyzeSystemBottlenecks(BottleneckAnalysisReport report, String taskId) {
        try {
            // 获取压测期间的系统指标
            LocalDateTime startTime = getTestStartTime(taskId);
            LocalDateTime endTime = getTestEndTime(taskId);
            
            List<SystemMetricsData> systemMetrics = 
                metricsQueryService.querySystemMetrics(startTime, endTime);
            
            SystemBottleneckAnalysis systemAnalysis = new SystemBottleneckAnalysis();
            
            // 分析CPU瓶颈
            analyzeCpuBottlenecks(systemAnalysis, systemMetrics);
            
            // 分析内存瓶颈
            analyzeMemoryBottlenecks(systemAnalysis, systemMetrics);
            
            // 分析网络瓶颈
            analyzeNetworkBottlenecks(systemAnalysis, systemMetrics);
            
            // 分析磁盘瓶颈
            analyzeDiskBottlenecks(systemAnalysis, systemMetrics);
            
            report.setSystemAnalysis(systemAnalysis);
        } catch (Exception e) {
            log.warn("Failed to analyze system bottlenecks", e);
        }
    }
    
    private void analyzeCpuBottlenecks(SystemBottleneckAnalysis analysis, 
                                     List<SystemMetricsData> metrics) {
        if (metrics.isEmpty()) return;
        
        // 计算CPU使用率统计
        DoubleSummaryStatistics cpuStats = metrics.stream()
            .mapToDouble(SystemMetricsData::getCpuUsage)
            .summaryStatistics();
        
        CpuBottleneck cpuBottleneck = new CpuBottleneck();
        cpuBottleneck.setAvgUsage(cpuStats.getAverage());
        cpuBottleneck.setMaxUsage(cpuStats.getMax());
        cpuBottleneck.setMinUsage(cpuStats.getMin());
        
        // 判断是否存在CPU瓶颈
        if (cpuStats.getAverage() > 80) {
            cpuBottleneck.setBottleneckDetected(true);
            cpuBottleneck.setSeverity(BottleneckSeverity.HIGH);
            cpuBottleneck.setDescription("High CPU usage detected during load test");
        } else if (cpuStats.getAverage() > 60) {
            cpuBottleneck.setBottleneckDetected(true);
            cpuBottleneck.setSeverity(BottleneckSeverity.MEDIUM);
            cpuBottleneck.setDescription("Moderate CPU usage detected during load test");
        }
        
        analysis.setCpuBottleneck(cpuBottleneck);
    }
    
    private void analyzeMemoryBottlenecks(SystemBottleneckAnalysis analysis, 
                                        List<SystemMetricsData> metrics) {
        if (metrics.isEmpty()) return;
        
        // 计算内存使用率统计
        DoubleSummaryStatistics memoryStats = metrics.stream()
            .mapToDouble(SystemMetricsData::getMemoryUsage)
            .summaryStatistics();
        
        MemoryBottleneck memoryBottleneck = new MemoryBottleneck();
        memoryBottleneck.setAvgUsage(memoryStats.getAverage());
        memoryBottleneck.setMaxUsage(memoryStats.getMax());
        memoryBottleneck.setMinUsage(memoryStats.getMin());
        
        // 判断是否存在内存瓶颈
        if (memoryStats.getAverage() > 85) {
            memoryBottleneck.setBottleneckDetected(true);
            memoryBottleneck.setSeverity(BottleneckSeverity.HIGH);
            memoryBottleneck.setDescription("High memory usage detected during load test");
        } else if (memoryStats.getAverage() > 70) {
            memoryBottleneck.setBottleneckDetected(true);
            memoryBottleneck.setSeverity(BottleneckSeverity.MEDIUM);
            memoryBottleneck.setDescription("Moderate memory usage detected during load test");
        }
        
        analysis.setMemoryBottleneck(memoryBottleneck);
    }
    
    private void analyzeApplicationBottlenecks(BottleneckAnalysisReport report, 
                                             String taskId, LoadTestResult result) {
        try {
            ApplicationBottleneckAnalysis appAnalysis = new ApplicationBottleneckAnalysis();
            
            // 分析响应时间瓶颈
            analyzeResponseTimeBottlenecks(appAnalysis, result);
            
            // 分析吞吐量瓶颈
            analyzeThroughputBottlenecks(appAnalysis, result);
            
            // 分析错误率瓶颈
            analyzeErrorRateBottlenecks(appAnalysis, result);
            
            report.setApplicationAnalysis(appAnalysis);
        } catch (Exception e) {
            log.warn("Failed to analyze application bottlenecks", e);
        }
    }
    
    private void analyzeResponseTimeBottlenecks(ApplicationBottleneckAnalysis analysis, 
                                              LoadTestResult result) {
        ResponseTimeBottleneck rtBottleneck = new ResponseTimeBottleneck();
        rtBottleneck.setAvgResponseTime(result.getAvgResponseTime());
        rtBottleneck.setMaxResponseTime(result.getMaxResponseTime());
        rtBottleneck.setMinResponseTime(result.getMinResponseTime());
        
        // 检查百分位数
        Map<String, Double> percentiles = result.getPercentiles();
        rtBottleneck.setP99ResponseTime(percentiles.getOrDefault("P99", 0.0));
        rtBottleneck.setP95ResponseTime(percentiles.getOrDefault("P95", 0.0));
        
        // 判断是否存在响应时间瓶颈
        if (rtBottleneck.getP99ResponseTime() > 1000) { // 1秒
            rtBottleneck.setBottleneckDetected(true);
            rtBottleneck.setSeverity(BottleneckSeverity.HIGH);
            rtBottleneck.setDescription("High P99 response time detected");
        } else if (rtBottleneck.getP99ResponseTime() > 500) { // 500毫秒
            rtBottleneck.setBottleneckDetected(true);
            rtBottleneck.setSeverity(BottleneckSeverity.MEDIUM);
            rtBottleneck.setDescription("Moderate P99 response time detected");
        }
        
        analysis.setResponseTimeBottleneck(rtBottleneck);
    }
    
    private void analyzeCallChainBottlenecks(BottleneckAnalysisReport report, String taskId) {
        try {
            // 查询慢调用链
            List<SlowTraceInfo> slowTraces = tracingQueryService.querySlowTraces(
                getTestStartTime(taskId), getTestEndTime(taskId), 1000); // 1秒以上
            
            CallChainBottleneckAnalysis chainAnalysis = new CallChainBottleneckAnalysis();
            
            // 分析慢调用链
            analyzeSlowCallChains(chainAnalysis, slowTraces);
            
            // 识别热点服务
            identifyHotServices(chainAnalysis, slowTraces);
            
            report.setCallChainAnalysis(chainAnalysis);
        } catch (Exception e) {
            log.warn("Failed to analyze call chain bottlenecks", e);
        }
    }
    
    private void analyzeSlowCallChains(CallChainBottleneckAnalysis analysis, 
                                     List<SlowTraceInfo> slowTraces) {
        if (slowTraces.isEmpty()) return;
        
        // 统计慢调用链信息
        long totalSlowTraces = slowTraces.size();
        double avgDuration = slowTraces.stream()
            .mapToLong(SlowTraceInfo::getDuration)
            .average()
            .orElse(0.0);
        
        SlowCallChainAnalysis slowChainAnalysis = new SlowCallChainAnalysis();
        slowChainAnalysis.setTotalSlowTraces(totalSlowTraces);
        slowChainAnalysis.setAvgDuration(avgDuration);
        
        // 识别最常见的慢调用模式
        Map<String, Long> patternCounts = slowTraces.stream()
            .collect(Collectors.groupingBy(
                this::extractCallPattern,
                Collectors.counting()
            ));
        
        List<Map.Entry<String, Long>> topPatterns = patternCounts.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .limit(5)
            .collect(Collectors.toList());
        
        slowChainAnalysis.setTopPatterns(topPatterns);
        
        analysis.setSlowCallChainAnalysis(slowChainAnalysis);
    }
    
    private String extractCallPattern(SlowTraceInfo trace) {
        // 提取调用链模式
        return trace.getServiceName() + "->" + trace.getOperationName();
    }
    
    private void generateOptimizationRecommendations(BottleneckAnalysisReport report) {
        List<OptimizationRecommendation> recommendations = new ArrayList<>();
        
        // 基于系统瓶颈生成建议
        if (report.getSystemAnalysis() != null) {
            recommendations.addAll(
                generateSystemRecommendations(report.getSystemAnalysis())
            );
        }
        
        // 基于应用瓶颈生成建议
        if (report.getApplicationAnalysis() != null) {
            recommendations.addAll(
                generateApplicationRecommendations(report.getApplicationAnalysis())
            );
        }
        
        // 基于调用链瓶颈生成建议
        if (report.getCallChainAnalysis() != null) {
            recommendations.addAll(
                generateCallChainRecommendations(report.getCallChainAnalysis())
            );
        }
        
        report.setRecommendations(recommendations);
    }
    
    private List<OptimizationRecommendation> generateSystemRecommendations(
            SystemBottleneckAnalysis analysis) {
        List<OptimizationRecommendation> recommendations = new ArrayList<>();
        
        // CPU相关建议
        if (analysis.getCpuBottleneck() != null && 
            analysis.getCpuBottleneck().isBottleneckDetected()) {
            OptimizationRecommendation cpuRec = new OptimizationRecommendation();
            cpuRec.setCategory("System");
            cpuRec.setSubCategory("CPU");
            cpuRec.setPriority(Priority.HIGH);
            cpuRec.setDescription("High CPU usage detected");
            cpuRec.setSuggestion("Consider scaling up CPU resources or optimizing CPU-intensive operations");
            recommendations.add(cpuRec);
        }
        
        // 内存相关建议
        if (analysis.getMemoryBottleneck() != null && 
            analysis.getMemoryBottleneck().isBottleneckDetected()) {
            OptimizationRecommendation memoryRec = new OptimizationRecommendation();
            memoryRec.setCategory("System");
            memoryRec.setSubCategory("Memory");
            memoryRec.setPriority(Priority.HIGH);
            memoryRec.setDescription("High memory usage detected");
            memoryRec.setSuggestion("Consider increasing memory allocation or optimizing memory usage");
            recommendations.add(memoryRec);
        }
        
        return recommendations;
    }
    
    // 瓶颈分析报告
    public static class BottleneckAnalysisReport {
        private String taskId;
        private long analysisTime;
        private SystemBottleneckAnalysis systemAnalysis;
        private ApplicationBottleneckAnalysis applicationAnalysis;
        private CallChainBottleneckAnalysis callChainAnalysis;
        private List<OptimizationRecommendation> recommendations;
        
        public BottleneckAnalysisReport() {
            this.recommendations = new ArrayList<>();
        }
        
        // getter和setter方法
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public long getAnalysisTime() { return analysisTime; }
        public void setAnalysisTime(long analysisTime) { this.analysisTime = analysisTime; }
        public SystemBottleneckAnalysis getSystemAnalysis() { return systemAnalysis; }
        public void setSystemAnalysis(SystemBottleneckAnalysis systemAnalysis) { this.systemAnalysis = systemAnalysis; }
        public ApplicationBottleneckAnalysis getApplicationAnalysis() { return applicationAnalysis; }
        public void setApplicationAnalysis(ApplicationBottleneckAnalysis applicationAnalysis) { this.applicationAnalysis = applicationAnalysis; }
        public CallChainBottleneckAnalysis getCallChainAnalysis() { return callChainAnalysis; }
        public void setCallChainAnalysis(CallChainBottleneckAnalysis callChainAnalysis) { this.callChainAnalysis = callChainAnalysis; }
        public List<OptimizationRecommendation> getRecommendations() { return recommendations; }
        public void setRecommendations(List<OptimizationRecommendation> recommendations) { this.recommendations = recommendations; }
    }
    
    // 瓶颈严重程度枚举
    public enum BottleneckSeverity {
        LOW, MEDIUM, HIGH, CRITICAL
    }
    
    // 优先级枚举
    public enum Priority {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}
```

## 容量规划策略

### 容量评估与规划

```java
// 容量规划器
@Component
public class CapacityPlanner {
    private final PerformanceBottleneckAnalyzer bottleneckAnalyzer;
    private final MetricsQueryService metricsQueryService;
    private final LoadTestTaskRepository taskRepository;
    
    public CapacityPlanner(PerformanceBottleneckAnalyzer bottleneckAnalyzer,
                          MetricsQueryService metricsQueryService,
                          LoadTestTaskRepository taskRepository) {
        this.bottleneckAnalyzer = bottleneckAnalyzer;
        this.metricsQueryService = metricsQueryService;
        this.taskRepository = taskRepository;
    }
    
    public CapacityPlan generateCapacityPlan(String taskId) {
        try {
            // 获取压测结果
            LoadTestResult result = taskRepository.getTestResult(taskId);
            if (result == null) {
                throw new IllegalArgumentException("Test result not found: " + taskId);
            }
            
            // 分析瓶颈
            BottleneckAnalysisReport bottleneckReport = 
                bottleneckAnalyzer.analyzeBottlenecks(taskId, result);
            
            // 生成容量规划
            CapacityPlan plan = new CapacityPlan();
            plan.setTaskId(taskId);
            plan.setGeneratedAt(System.currentTimeMillis());
            
            // 评估当前容量
            assessCurrentCapacity(plan, result);
            
            // 预测未来需求
            predictFutureDemand(plan);
            
            // 制定扩容策略
            developScalingStrategy(plan, bottleneckReport, result);
            
            // 计算资源需求
            calculateResourceRequirements(plan);
            
            return plan;
        } catch (Exception e) {
            log.error("Failed to generate capacity plan for task: " + taskId, e);
            throw new RuntimeException("Capacity planning failed", e);
        }
    }
    
    private void assessCurrentCapacity(CapacityPlan plan, LoadTestResult result) {
        CurrentCapacityAssessment assessment = new CurrentCapacityAssessment();
        
        // 评估最大并发处理能力
        assessment.setMaxConcurrency(result.getConcurrency());
        
        // 评估最大吞吐量
        long testDurationSeconds = result.getDuration();
        double maxThroughput = (double) result.getSuccessfulRequests() / testDurationSeconds;
        assessment.setMaxThroughput(maxThroughput);
        
        // 评估性能指标
        assessment.setAvgResponseTime(result.getAvgResponseTime());
        assessment.setP99ResponseTime(result.getPercentiles().getOrDefault("P99", 0.0));
        assessment.setErrorRate((double) result.getFailedRequests() / result.getTotalRequests());
        
        // 评估资源利用率
        assessment.setResourceUtilization(analyzeResourceUtilization(result));
        
        plan.setCurrentCapacity(assessment);
    }
    
    private ResourceUtilization analyzeResourceUtilization(LoadTestResult result) {
        ResourceUtilization utilization = new ResourceUtilization();
        
        // 这里应该从系统指标中获取资源利用率数据
        // 简化实现
        utilization.setCpuUtilization(75.0);
        utilization.setMemoryUtilization(65.0);
        utilization.setNetworkUtilization(45.0);
        utilization.setDiskUtilization(30.0);
        
        return utilization;
    }
    
    private void predictFutureDemand(CapacityPlan plan) {
        FutureDemandPrediction prediction = new FutureDemandPrediction();
        
        // 基于历史数据预测未来需求增长
        // 这里简化处理，实际应该基于业务数据进行预测
        prediction.setGrowthRate(0.2); // 预计20%年增长率
        prediction.setPredictedPeakLoad(1.5); // 预计峰值负载是平均负载的1.5倍
        prediction.setSeasonalFactors(Map.of(
            "Q1", 1.1,
            "Q2", 1.3,
            "Q3", 1.0,
            "Q4", 1.4
        ));
        
        plan.setFutureDemand(prediction);
    }
    
    private void developScalingStrategy(CapacityPlan plan, 
                                      BottleneckAnalysisReport bottleneckReport,
                                      LoadTestResult result) {
        ScalingStrategy strategy = new ScalingStrategy();
        
        // 基于瓶颈分析制定扩容策略
        List<ScalingRecommendation> recommendations = new ArrayList<>();
        
        // CPU瓶颈扩容建议
        if (bottleneckReport.getSystemAnalysis() != null && 
            bottleneckReport.getSystemAnalysis().getCpuBottleneck() != null &&
            bottleneckReport.getSystemAnalysis().getCpuBottleneck().isBottleneckDetected()) {
            
            ScalingRecommendation cpuRec = new ScalingRecommendation();
            cpuRec.setResourceType("CPU");
            cpuRec.setScalingType(ScalingType.VERTICAL); // 垂直扩容
            cpuRec.setRecommendedChange(calculateCpuScaling(result));
            cpuRec.setReason("CPU bottleneck detected during load test");
            recommendations.add(cpuRec);
        }
        
        // 内存瓶颈扩容建议
        if (bottleneckReport.getSystemAnalysis() != null && 
            bottleneckReport.getSystemAnalysis().getMemoryBottleneck() != null &&
            bottleneckReport.getSystemAnalysis().getMemoryBottleneck().isBottleneckDetected()) {
            
            ScalingRecommendation memoryRec = new ScalingRecommendation();
            memoryRec.setResourceType("Memory");
            memoryRec.setScalingType(ScalingType.VERTICAL);
            memoryRec.setRecommendedChange(calculateMemoryScaling(result));
            memoryRec.setReason("Memory bottleneck detected during load test");
            recommendations.add(memoryRec);
        }
        
        // 水平扩容建议
        if (result.getSuccessfulRequests() > 10000) { // 高负载情况下建议水平扩容
            ScalingRecommendation horizontalRec = new ScalingRecommendation();
            horizontalRec.setResourceType("Instances");
            horizontalRec.setScalingType(ScalingType.HORIZONTAL);
            horizontalRec.setRecommendedChange(calculateHorizontalScaling(result));
            horizontalRec.setReason("High load suggests horizontal scaling");
            recommendations.add(horizontalRec);
        }
        
        strategy.setRecommendations(recommendations);
        plan.setScalingStrategy(strategy);
    }
    
    private double calculateCpuScaling(LoadTestResult result) {
        // 基于CPU使用率计算扩容比例
        // 简化实现
        return 1.5; // 建议增加50% CPU资源
    }
    
    private double calculateMemoryScaling(LoadTestResult result) {
        // 基于内存使用率计算扩容比例
        // 简化实现
        return 1.3; // 建议增加30% 内存资源
    }
    
    private int calculateHorizontalScaling(LoadTestResult result) {
        // 基于吞吐量计算需要增加的实例数
        // 简化实现
        return 2; // 建议增加2个实例
    }
    
    private void calculateResourceRequirements(CapacityPlan plan) {
        ResourceRequirements requirements = new ResourceRequirements();
        
        CurrentCapacityAssessment current = plan.getCurrentCapacity();
        FutureDemandPrediction future = plan.getFutureDemand();
        ScalingStrategy strategy = plan.getScalingStrategy();
        
        if (current != null && future != null) {
            // 计算未来资源需求
            double futureMultiplier = future.getPredictedPeakLoad() * (1 + future.getGrowthRate());
            
            requirements.setCpuCores((int) Math.ceil(current.getMaxConcurrency() * futureMultiplier / 1000));
            requirements.setMemoryGb((int) Math.ceil(current.getMaxThroughput() * futureMultiplier / 1000));
            requirements.setStorageGb(100); // 固定存储需求
            requirements.setNetworkBandwidthMbps(1000); // 固定网络带宽需求
        }
        
        // 应用扩容策略
        if (strategy != null) {
            applyScalingStrategy(requirements, strategy);
        }
        
        plan.setResourceRequirements(requirements);
    }
    
    private void applyScalingStrategy(ResourceRequirements requirements, 
                                    ScalingStrategy strategy) {
        for (ScalingRecommendation recommendation : strategy.getRecommendations()) {
            switch (recommendation.getResourceType()) {
                case "CPU":
                    requirements.setCpuCores((int) Math.ceil(
                        requirements.getCpuCores() * recommendation.getRecommendedChange()));
                    break;
                case "Memory":
                    requirements.setMemoryGb((int) Math.ceil(
                        requirements.getMemoryGb() * recommendation.getRecommendedChange()));
                    break;
                case "Instances":
                    // 水平扩容已经在实例数计算中考虑
                    break;
            }
        }
    }
    
    // 容量规划
    public static class CapacityPlan {
        private String taskId;
        private long generatedAt;
        private CurrentCapacityAssessment currentCapacity;
        private FutureDemandPrediction futureDemand;
        private ScalingStrategy scalingStrategy;
        private ResourceRequirements resourceRequirements;
        
        // getter和setter方法
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public long getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(long generatedAt) { this.generatedAt = generatedAt; }
        public CurrentCapacityAssessment getCurrentCapacity() { return currentCapacity; }
        public void setCurrentCapacity(CurrentCapacityAssessment currentCapacity) { this.currentCapacity = currentCapacity; }
        public FutureDemandPrediction getFutureDemand() { return futureDemand; }
        public void setFutureDemand(FutureDemandPrediction futureDemand) { this.futureDemand = futureDemand; }
        public ScalingStrategy getScalingStrategy() { return scalingStrategy; }
        public void setScalingStrategy(ScalingStrategy scalingStrategy) { this.scalingStrategy = scalingStrategy; }
        public ResourceRequirements getResourceRequirements() { return resourceRequirements; }
        public void setResourceRequirements(ResourceRequirements resourceRequirements) { this.resourceRequirements = resourceRequirements; }
    }
    
    // 扩容类型枚举
    public enum ScalingType {
        VERTICAL, // 垂直扩容
        HORIZONTAL // 水平扩容
    }
}
```

通过以上实现，我们构建了一个完整的压测与容量规划系统，能够通过限流平台模拟流量进行全链路压测，识别系统瓶颈，并制定合理的容量规划策略。该系统提供了分布式压测协调、性能瓶颈分析、容量评估与规划等核心功能，为系统的稳定运行和持续优化提供了有力支持。在实际应用中，需要根据具体的业务场景和技术架构进行相应的调整和优化。