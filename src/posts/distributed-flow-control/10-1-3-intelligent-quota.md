---
title: "智能配额分配: 根据服务重要性、SLA动态分配集群总配额"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
在复杂的分布式系统中，如何合理分配有限的系统资源给不同的服务是一个关键挑战。智能配额分配通过综合考虑服务的重要性、SLA要求、历史使用情况等多个维度，动态地为各个服务分配集群总配额，确保关键业务获得足够的资源保障，同时最大化整体资源利用率。本章将深入探讨智能配额分配的实现原理、核心算法以及最佳实践。

## 配额分配概述

### 传统配额分配的局限性

传统的静态配额分配方式存在以下局限性：

1. **固定分配**：配额一旦设定就很少调整，无法适应业务变化
2. **缺乏优先级**：无法区分不同服务的重要性和紧急程度
3. **资源浪费**：部分服务可能分配过多资源但使用不足
4. **缺乏弹性**：无法根据实时负载情况动态调整配额
5. **维护成本高**：需要人工监控和调整配额配置

### 智能配额分配的优势

智能配额分配相比传统方式具有以下优势：

1. **动态调整**：根据实时情况动态调整各服务的配额分配
2. **优先级感知**：考虑服务重要性和SLA要求进行差异化分配
3. **资源优化**：最大化资源利用率，避免浪费
4. **自适应能力**：能够自动响应业务负载变化
5. **降低运维成本**：减少人工干预，提高系统自治能力

## 服务重要性评估

### 服务重要性模型

```java
// 服务重要性评估器
@Component
public class ServiceImportanceEvaluator {
    private final ServiceMetadataRepository metadataRepository;
    private final BusinessImpactAnalyzer impactAnalyzer;
    private final HistoricalUsageAnalyzer usageAnalyzer;
    private final ScheduledExecutorService evaluationScheduler;
    private final Map<String, ServiceImportanceScore> importanceCache = new ConcurrentHashMap<>();
    
    public ServiceImportanceEvaluator(ServiceMetadataRepository metadataRepository,
                                   BusinessImpactAnalyzer impactAnalyzer,
                                   HistoricalUsageAnalyzer usageAnalyzer) {
        this.metadataRepository = metadataRepository;
        this.impactAnalyzer = impactAnalyzer;
        this.usageAnalyzer = usageAnalyzer;
        this.evaluationScheduler = Executors.newScheduledThreadPool(1);
        
        // 启动定期评估任务
        evaluationScheduler.scheduleAtFixedRate(this::evaluateAllServices, 
            0, 30, TimeUnit.MINUTES);
    }
    
    public ServiceImportanceScore evaluateServiceImportance(String serviceId) {
        try {
            // 检查缓存
            ServiceImportanceScore cachedScore = importanceCache.get(serviceId);
            if (cachedScore != null && 
                System.currentTimeMillis() - cachedScore.getEvaluatedAt() < 30 * 60 * 1000) {
                return cachedScore;
            }
            
            // 获取服务元数据
            ServiceMetadata metadata = metadataRepository.findByServiceId(serviceId);
            if (metadata == null) {
                return createDefaultImportanceScore(serviceId);
            }
            
            // 计算各项重要性因子
            double businessImpactScore = calculateBusinessImpactScore(metadata);
            double userImpactScore = calculateUserImpactScore(metadata);
            double revenueImpactScore = calculateRevenueImpactScore(metadata);
            double historicalUsageScore = calculateHistoricalUsageScore(serviceId);
            double dependencyScore = calculateDependencyScore(metadata);
            
            // 综合计算重要性得分
            ServiceImportanceScore importanceScore = new ServiceImportanceScore();
            importanceScore.setServiceId(serviceId);
            importanceScore.setBusinessImpact(businessImpactScore);
            importanceScore.setUserImpact(userImpactScore);
            importanceScore.setRevenueImpact(revenueImpactScore);
            importanceScore.setHistoricalUsage(historicalUsageScore);
            importanceScore.setDependencyImpact(dependencyScore);
            
            // 计算综合得分（加权平均）
            double compositeScore = calculateCompositeScore(importanceScore, metadata);
            importanceScore.setCompositeScore(compositeScore);
            
            // 确定重要性等级
            ImportanceLevel level = determineImportanceLevel(compositeScore);
            importanceScore.setLevel(level);
            
            importanceScore.setEvaluatedAt(System.currentTimeMillis());
            
            // 更新缓存
            importanceCache.put(serviceId, importanceScore);
            
            return importanceScore;
        } catch (Exception e) {
            log.error("Failed to evaluate service importance for: " + serviceId, e);
            return createDefaultImportanceScore(serviceId);
        }
    }
    
    private double calculateBusinessImpactScore(ServiceMetadata metadata) {
        // 基于业务类型计算影响分
        switch (metadata.getBusinessType()) {
            case "CORE": return 1.0;      // 核心业务
            case "IMPORTANT": return 0.8; // 重要业务
            case "NORMAL": return 0.5;    // 普通业务
            case "LOW": return 0.2;       // 低优先级业务
            default: return 0.5;
        }
    }
    
    private double calculateUserImpactScore(ServiceMetadata metadata) {
        // 基于用户影响范围计算得分
        int userCount = metadata.getAffectedUserCount();
        if (userCount > 1000000) {      // 百万级用户
            return 1.0;
        } else if (userCount > 100000) { // 十万级用户
            return 0.8;
        } else if (userCount > 10000) {  // 万级用户
            return 0.6;
        } else if (userCount > 1000) {   // 千级用户
            return 0.4;
        } else {
            return 0.2;
        }
    }
    
    private double calculateRevenueImpactScore(ServiceMetadata metadata) {
        // 基于收入影响计算得分
        double revenueImpact = metadata.getRevenueImpact();
        if (revenueImpact > 1000000) {    // 百万级收入影响
            return 1.0;
        } else if (revenueImpact > 100000) { // 十万级收入影响
            return 0.8;
        } else if (revenueImpact > 10000) {  // 万级收入影响
            return 0.6;
        } else if (revenueImpact > 1000) {   // 千级收入影响
            return 0.4;
        } else {
            return 0.2;
        }
    }
    
    private double calculateHistoricalUsageScore(String serviceId) {
        try {
            // 基于历史使用情况计算得分
            UsageStatistics stats = usageAnalyzer.getUsageStatistics(serviceId);
            if (stats == null) {
                return 0.5; // 默认值
            }
            
            // 使用率越高，得分越高
            double utilizationRate = stats.getAverageUtilization();
            return Math.min(1.0, utilizationRate * 2); // 放大2倍，最高1.0
        } catch (Exception e) {
            log.warn("Failed to calculate historical usage score for: " + serviceId, e);
            return 0.5;
        }
    }
    
    private double calculateDependencyScore(ServiceMetadata metadata) {
        try {
            // 基于依赖关系计算得分
            List<String> dependencies = metadata.getDependencies();
            if (dependencies == null || dependencies.isEmpty()) {
                return 0.3; // 独立服务，依赖影响较小
            }
            
            // 计算依赖服务的重要性的平均值
            double totalDependencyScore = 0;
            int validDependencies = 0;
            
            for (String dependency : dependencies) {
                ServiceImportanceScore depScore = evaluateServiceImportance(dependency);
                if (depScore != null) {
                    totalDependencyScore += depScore.getCompositeScore();
                    validDependencies++;
                }
            }
            
            if (validDependencies > 0) {
                return totalDependencyScore / validDependencies * 0.5; // 依赖影响系数0.5
            } else {
                return 0.3;
            }
        } catch (Exception e) {
            log.warn("Failed to calculate dependency score for: " + metadata.getServiceId(), e);
            return 0.3;
        }
    }
    
    private double calculateCompositeScore(ServiceImportanceScore score, ServiceMetadata metadata) {
        // 加权计算综合得分
        double businessWeight = 0.3;
        double userWeight = 0.25;
        double revenueWeight = 0.2;
        double usageWeight = 0.15;
        double dependencyWeight = 0.1;
        
        return score.getBusinessImpact() * businessWeight +
               score.getUserImpact() * userWeight +
               score.getRevenueImpact() * revenueWeight +
               score.getHistoricalUsage() * usageWeight +
               score.getDependencyImpact() * dependencyWeight;
    }
    
    private ImportanceLevel determineImportanceLevel(double compositeScore) {
        if (compositeScore >= 0.8) {
            return ImportanceLevel.CRITICAL;
        } else if (compositeScore >= 0.6) {
            return ImportanceLevel.HIGH;
        } else if (compositeScore >= 0.4) {
            return ImportanceLevel.MEDIUM;
        } else if (compositeScore >= 0.2) {
            return ImportanceLevel.LOW;
        } else {
            return ImportanceLevel.VERY_LOW;
        }
    }
    
    private ServiceImportanceScore createDefaultImportanceScore(String serviceId) {
        ServiceImportanceScore score = new ServiceImportanceScore();
        score.setServiceId(serviceId);
        score.setBusinessImpact(0.5);
        score.setUserImpact(0.5);
        score.setRevenueImpact(0.5);
        score.setHistoricalUsage(0.5);
        score.setDependencyImpact(0.3);
        score.setCompositeScore(0.5);
        score.setLevel(ImportanceLevel.MEDIUM);
        score.setEvaluatedAt(System.currentTimeMillis());
        return score;
    }
    
    private void evaluateAllServices() {
        try {
            List<String> serviceIds = metadataRepository.getAllServiceIds();
            for (String serviceId : serviceIds) {
                evaluateServiceImportance(serviceId);
            }
        } catch (Exception e) {
            log.error("Failed to evaluate all services", e);
        }
    }
    
    // 服务重要性等级枚举
    public enum ImportanceLevel {
        VERY_LOW(1), LOW(2), MEDIUM(3), HIGH(4), CRITICAL(5);
        
        private final int priority;
        
        ImportanceLevel(int priority) {
            this.priority = priority;
        }
        
        public int getPriority() {
            return priority;
        }
    }
    
    // 服务重要性得分
    public static class ServiceImportanceScore {
        private String serviceId;
        private double businessImpact;
        private double userImpact;
        private double revenueImpact;
        private double historicalUsage;
        private double dependencyImpact;
        private double compositeScore;
        private ImportanceLevel level;
        private long evaluatedAt;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public double getBusinessImpact() { return businessImpact; }
        public void setBusinessImpact(double businessImpact) { this.businessImpact = businessImpact; }
        public double getUserImpact() { return userImpact; }
        public void setUserImpact(double userImpact) { this.userImpact = userImpact; }
        public double getRevenueImpact() { return revenueImpact; }
        public void setRevenueImpact(double revenueImpact) { this.revenueImpact = revenueImpact; }
        public double getHistoricalUsage() { return historicalUsage; }
        public void setHistoricalUsage(double historicalUsage) { this.historicalUsage = historicalUsage; }
        public double getDependencyImpact() { return dependencyImpact; }
        public void setDependencyImpact(double dependencyImpact) { this.dependencyImpact = dependencyImpact; }
        public double getCompositeScore() { return compositeScore; }
        public void setCompositeScore(double compositeScore) { this.compositeScore = compositeScore; }
        public ImportanceLevel getLevel() { return level; }
        public void setLevel(ImportanceLevel level) { this.level = level; }
        public long getEvaluatedAt() { return evaluatedAt; }
        public void setEvaluatedAt(long evaluatedAt) { this.evaluatedAt = evaluatedAt; }
    }
}
```

### SLA要求分析

```java
// SLA要求分析器
@Component
public class SlaRequirementAnalyzer {
    private final SlaRepository slaRepository;
    private final ServiceMetadataRepository metadataRepository;
    private final MetricsQueryService metricsQueryService;
    
    public SlaRequirementAnalyzer(SlaRepository slaRepository,
                                ServiceMetadataRepository metadataRepository,
                                MetricsQueryService metricsQueryService) {
        this.slaRepository = slaRepository;
        this.metadataRepository = metadataRepository;
        this.metricsQueryService = metricsQueryService;
    }
    
    public SlaRequirements analyzeSlaRequirements(String serviceId) {
        try {
            // 获取服务的SLA配置
            ServiceSlaConfig slaConfig = slaRepository.findByServiceId(serviceId);
            if (slaConfig == null) {
                return createDefaultSlaRequirements(serviceId);
            }
            
            SlaRequirements requirements = new SlaRequirements();
            requirements.setServiceId(serviceId);
            
            // 分析响应时间要求
            requirements.setResponseTimeRequirement(
                analyzeResponseTimeRequirement(slaConfig));
            
            // 分析可用性要求
            requirements.setAvailabilityRequirement(
                analyzeAvailabilityRequirement(slaConfig));
            
            // 分析吞吐量要求
            requirements.setThroughputRequirement(
                analyzeThroughputRequirement(slaConfig));
            
            // 分析错误率要求
            requirements.setErrorRateRequirement(
                analyzeErrorRateRequirement(slaConfig));
            
            // 计算SLA优先级
            requirements.setPriority(calculateSlaPriority(slaConfig));
            
            // 计算资源需求系数
            requirements.setResourceRequirementFactor(
                calculateResourceRequirementFactor(requirements));
            
            return requirements;
        } catch (Exception e) {
            log.error("Failed to analyze SLA requirements for: " + serviceId, e);
            return createDefaultSlaRequirements(serviceId);
        }
    }
    
    private ResponseTimeRequirement analyzeResponseTimeRequirement(ServiceSlaConfig slaConfig) {
        ResponseTimeRequirement requirement = new ResponseTimeRequirement();
        
        requirement.setTarget(slaConfig.getTargetResponseTime());
        requirement.setThreshold(slaConfig.getThresholdResponseTime());
        requirement.setP99(slaConfig.getP99ResponseTime());
        requirement.setP95(slaConfig.getP95ResponseTime());
        
        // 计算紧急程度
        double urgency = 0.0;
        if (requirement.getP99() < 100) {      // 100ms以下
            urgency = 1.0;
        } else if (requirement.getP99() < 500) { // 500ms以下
            urgency = 0.8;
        } else if (requirement.getP99() < 1000) { // 1秒以下
            urgency = 0.6;
        } else if (requirement.getP99() < 2000) { // 2秒以下
            urgency = 0.4;
        } else {
            urgency = 0.2;
        }
        requirement.setUrgency(urgency);
        
        return requirement;
    }
    
    private AvailabilityRequirement analyzeAvailabilityRequirement(ServiceSlaConfig slaConfig) {
        AvailabilityRequirement requirement = new AvailabilityRequirement();
        
        requirement.setTarget(slaConfig.getTargetAvailability());
        requirement.setThreshold(slaConfig.getThresholdAvailability());
        
        // 计算重要性
        double importance = 0.0;
        double availability = requirement.getTarget();
        if (availability >= 0.999) {     // 99.9%以上
            importance = 1.0;
        } else if (availability >= 0.995) { // 99.5%以上
            importance = 0.8;
        } else if (availability >= 0.99) {  // 99%以上
            importance = 0.6;
        } else if (availability >= 0.95) {  // 95%以上
            importance = 0.4;
        } else {
            importance = 0.2;
        }
        requirement.setImportance(importance);
        
        return requirement;
    }
    
    private ThroughputRequirement analyzeThroughputRequirement(ServiceSlaConfig slaConfig) {
        ThroughputRequirement requirement = new ThroughputRequirement();
        
        requirement.setTarget(slaConfig.getTargetThroughput());
        requirement.setThreshold(slaConfig.getThresholdThroughput());
        requirement.setPeak(slaConfig.getPeakThroughput());
        
        // 计算容量需求
        double capacityNeed = 0.0;
        if (requirement.getPeak() > 10000) {     // 1万QPS以上
            capacityNeed = 1.0;
        } else if (requirement.getPeak() > 5000) { // 5000QPS以上
            capacityNeed = 0.8;
        } else if (requirement.getPeak() > 1000) { // 1000QPS以上
            capacityNeed = 0.6;
        } else if (requirement.getPeak() > 100) {  // 100QPS以上
            capacityNeed = 0.4;
        } else {
            capacityNeed = 0.2;
        }
        requirement.setCapacityNeed(capacityNeed);
        
        return requirement;
    }
    
    private ErrorRateRequirement analyzeErrorRateRequirement(ServiceSlaConfig slaConfig) {
        ErrorRateRequirement requirement = new ErrorRateRequirement();
        
        requirement.setTarget(slaConfig.getTargetErrorRate());
        requirement.setThreshold(slaConfig.getThresholdErrorRate());
        
        // 计算质量要求
        double qualityRequirement = 0.0;
        double errorRate = requirement.getTarget();
        if (errorRate < 0.001) {    // 0.1%以下
            qualityRequirement = 1.0;
        } else if (errorRate < 0.01) { // 1%以下
            qualityRequirement = 0.8;
        } else if (errorRate < 0.05) { // 5%以下
            qualityRequirement = 0.6;
        } else if (errorRate < 0.1) {  // 10%以下
            qualityRequirement = 0.4;
        } else {
            qualityRequirement = 0.2;
        }
        requirement.setQualityRequirement(qualityRequirement);
        
        return requirement;
    }
    
    private SlaPriority calculateSlaPriority(ServiceSlaConfig slaConfig) {
        // 综合各项SLA要求计算优先级
        double responseTimeWeight = 0.3;
        double availabilityWeight = 0.3;
        double throughputWeight = 0.2;
        double errorRateWeight = 0.2;
        
        double priorityScore = 
            slaConfig.getTargetResponseTime() < 1000 ? 1.0 : 0.5 * responseTimeWeight +
            slaConfig.getTargetAvailability() > 0.999 ? 1.0 : 0.5 * availabilityWeight +
            slaConfig.getPeakThroughput() > 1000 ? 1.0 : 0.5 * throughputWeight +
            slaConfig.getTargetErrorRate() < 0.01 ? 1.0 : 0.5 * errorRateWeight;
        
        if (priorityScore >= 0.8) {
            return SlaPriority.CRITICAL;
        } else if (priorityScore >= 0.6) {
            return SlaPriority.HIGH;
        } else if (priorityScore >= 0.4) {
            return SlaPriority.MEDIUM;
        } else {
            return SlaPriority.LOW;
        }
    }
    
    private double calculateResourceRequirementFactor(SlaRequirements requirements) {
        // 基于SLA要求计算资源需求系数
        double factor = 1.0;
        
        // 响应时间要求影响
        ResponseTimeRequirement rtReq = requirements.getResponseTimeRequirement();
        if (rtReq != null) {
            factor *= (2.0 - rtReq.getUrgency()); // 紧急程度越高，系数越大
        }
        
        // 可用性要求影响
        AvailabilityRequirement availReq = requirements.getAvailabilityRequirement();
        if (availReq != null) {
            factor *= (1.0 + availReq.getImportance()); // 重要性越高，系数越大
        }
        
        // 吞吐量要求影响
        ThroughputRequirement tpReq = requirements.getThroughputRequirement();
        if (tpReq != null) {
            factor *= (1.0 + tpReq.getCapacityNeed()); // 容量需求越高，系数越大
        }
        
        // 错误率要求影响
        ErrorRateRequirement erReq = requirements.getErrorRateRequirement();
        if (erReq != null) {
            factor *= (1.0 + erReq.getQualityRequirement()); // 质量要求越高，系数越大
        }
        
        return Math.max(1.0, Math.min(3.0, factor)); // 限制在1-3之间
    }
    
    private SlaRequirements createDefaultSlaRequirements(String serviceId) {
        SlaRequirements requirements = new SlaRequirements();
        requirements.setServiceId(serviceId);
        requirements.setPriority(SlaPriority.MEDIUM);
        requirements.setResourceRequirementFactor(1.0);
        return requirements;
    }
    
    // SLA优先级枚举
    public enum SlaPriority {
        LOW(1), MEDIUM(2), HIGH(3), CRITICAL(4);
        
        private final int level;
        
        SlaPriority(int level) {
            this.level = level;
        }
        
        public int getLevel() {
            return level;
        }
    }
    
    // SLA要求
    public static class SlaRequirements {
        private String serviceId;
        private ResponseTimeRequirement responseTimeRequirement;
        private AvailabilityRequirement availabilityRequirement;
        private ThroughputRequirement throughputRequirement;
        private ErrorRateRequirement errorRateRequirement;
        private SlaPriority priority;
        private double resourceRequirementFactor;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public ResponseTimeRequirement getResponseTimeRequirement() { return responseTimeRequirement; }
        public void setResponseTimeRequirement(ResponseTimeRequirement responseTimeRequirement) { this.responseTimeRequirement = responseTimeRequirement; }
        public AvailabilityRequirement getAvailabilityRequirement() { return availabilityRequirement; }
        public void setAvailabilityRequirement(AvailabilityRequirement availabilityRequirement) { this.availabilityRequirement = availabilityRequirement; }
        public ThroughputRequirement getThroughputRequirement() { return throughputRequirement; }
        public void setThroughputRequirement(ThroughputRequirement throughputRequirement) { this.throughputRequirement = throughputRequirement; }
        public ErrorRateRequirement getErrorRateRequirement() { return errorRateRequirement; }
        public void setErrorRateRequirement(ErrorRateRequirement errorRateRequirement) { this.errorRateRequirement = errorRateRequirement; }
        public SlaPriority getPriority() { return priority; }
        public void setPriority(SlaPriority priority) { this.priority = priority; }
        public double getResourceRequirementFactor() { return resourceRequirementFactor; }
        public void setResourceRequirementFactor(double resourceRequirementFactor) { this.resourceRequirementFactor = resourceRequirementFactor; }
    }
}
```

## 动态配额分配算法

### 配额分配引擎

```java
// 智能配额分配引擎
@Component
public class IntelligentQuotaAllocator {
    private final ServiceImportanceEvaluator importanceEvaluator;
    private final SlaRequirementAnalyzer slaAnalyzer;
    private final ResourceUsageMonitor usageMonitor;
    private final ClusterResourceManager resourceManager;
    private final QuotaAllocationStrategy allocationStrategy;
    private final ScheduledExecutorService allocationScheduler;
    private final AtomicReference<ClusterResourceQuota> currentQuota = new AtomicReference<>();
    
    public IntelligentQuotaAllocator(ServiceImportanceEvaluator importanceEvaluator,
                                   SlaRequirementAnalyzer slaAnalyzer,
                                   ResourceUsageMonitor usageMonitor,
                                   ClusterResourceManager resourceManager,
                                   QuotaAllocationStrategy allocationStrategy) {
        this.importanceEvaluator = importanceEvaluator;
        this.slaAnalyzer = slaAnalyzer;
        this.usageMonitor = usageMonitor;
        this.resourceManager = resourceManager;
        this.allocationStrategy = allocationStrategy;
        this.allocationScheduler = Executors.newScheduledThreadPool(1);
        
        // 启动定期配额分配任务
        allocationScheduler.scheduleAtFixedRate(this::allocateQuotas, 
            0, 5, TimeUnit.MINUTES);
    }
    
    public void allocateQuotas() {
        try {
            // 获取集群总资源配额
            ClusterResourceQuota totalQuota = resourceManager.getTotalResourceQuota();
            if (totalQuota == null) {
                log.warn("Failed to get total resource quota");
                return;
            }
            
            // 获取所有服务列表
            List<String> serviceIds = resourceManager.getAllServiceIds();
            if (serviceIds.isEmpty()) {
                log.info("No services found for quota allocation");
                return;
            }
            
            // 为每个服务计算配额需求
            List<ServiceQuotaRequest> quotaRequests = calculateQuotaRequests(serviceIds);
            
            // 执行配额分配
            ClusterResourceQuota allocatedQuota = allocationStrategy.allocate(
                totalQuota, quotaRequests);
            
            // 应用配额分配结果
            applyQuotaAllocation(allocatedQuota);
            
            // 更新当前配额
            currentQuota.set(allocatedQuota);
            
            log.info("Quota allocation completed for {} services", serviceIds.size());
        } catch (Exception e) {
            log.error("Failed to allocate quotas", e);
        }
    }
    
    private List<ServiceQuotaRequest> calculateQuotaRequests(List<String> serviceIds) {
        List<ServiceQuotaRequest> requests = new ArrayList<>();
        
        for (String serviceId : serviceIds) {
            try {
                ServiceQuotaRequest request = new ServiceQuotaRequest();
                request.setServiceId(serviceId);
                
                // 评估服务重要性
                ServiceImportanceEvaluator.ServiceImportanceScore importanceScore = 
                    importanceEvaluator.evaluateServiceImportance(serviceId);
                request.setImportanceScore(importanceScore);
                
                // 分析SLA要求
                SlaRequirementAnalyzer.SlaRequirements slaRequirements = 
                    slaAnalyzer.analyzeSlaRequirements(serviceId);
                request.setSlaRequirements(slaRequirements);
                
                // 获取当前资源使用情况
                ResourceUsage usage = usageMonitor.getCurrentUsage(serviceId);
                request.setCurrentUsage(usage);
                
                // 计算配额需求
                calculateQuotaRequirements(request);
                
                requests.add(request);
            } catch (Exception e) {
                log.warn("Failed to calculate quota request for service: " + serviceId, e);
            }
        }
        
        return requests;
    }
    
    private void calculateQuotaRequirements(ServiceQuotaRequest request) {
        // 基于重要性得分计算基础配额
        double importanceFactor = request.getImportanceScore().getCompositeScore();
        
        // 基于SLA要求计算配额调整因子
        double slaFactor = request.getSlaRequirements().getResourceRequirementFactor();
        
        // 基于当前使用情况计算需求
        ResourceUsage currentUsage = request.getCurrentUsage();
        double usageFactor = 1.0;
        if (currentUsage != null) {
            // 如果当前使用率很高，需要更多配额
            double cpuUsage = currentUsage.getCpuUsage();
            double memoryUsage = currentUsage.getMemoryUsage();
            usageFactor = Math.max(1.0, (cpuUsage + memoryUsage) / 2 / 50); // 50%为基准
        }
        
        // 综合计算配额需求因子
        double requirementFactor = importanceFactor * slaFactor * usageFactor;
        request.setRequirementFactor(requirementFactor);
        
        // 计算建议配额（基于历史使用和需求因子）
        calculateSuggestedQuotas(request);
    }
    
    private void calculateSuggestedQuotas(ServiceQuotaRequest request) {
        ResourceUsage currentUsage = request.getCurrentUsage();
        if (currentUsage == null) {
            return;
        }
        
        SuggestedQuotas suggested = new SuggestedQuotas();
        
        // CPU配额建议
        double suggestedCpu = currentUsage.getCpuUsage() * request.getRequirementFactor();
        suggested.setCpuCores(Math.max(1, (int) Math.ceil(suggestedCpu)));
        
        // 内存配额建议
        double suggestedMemory = currentUsage.getMemoryUsage() * request.getRequirementFactor();
        suggested.setMemoryGb(Math.max(1, (int) Math.ceil(suggestedMemory / 1024))); // 转换为GB
        
        // 网络配额建议
        double suggestedNetwork = currentUsage.getNetworkUsage() * request.getRequirementFactor();
        suggested.setNetworkMbps(Math.max(10, (int) Math.ceil(suggestedNetwork)));
        
        // 存储配额建议
        double suggestedStorage = currentUsage.getStorageUsage() * request.getRequirementFactor();
        suggested.setStorageGb(Math.max(10, (int) Math.ceil(suggestedStorage / 1024))); // 转换为GB
        
        request.setSuggestedQuotas(suggested);
    }
    
    private void applyQuotaAllocation(ClusterResourceQuota allocatedQuota) {
        try {
            // 应用配额到各个服务
            for (ServiceResourceQuota serviceQuota : allocatedQuota.getServiceQuotas()) {
                try {
                    resourceManager.applyServiceQuota(serviceQuota);
                    
                    // 记录配额分配事件
                    recordQuotaAllocationEvent(serviceQuota);
                } catch (Exception e) {
                    log.error("Failed to apply quota for service: " + serviceQuota.getServiceId(), e);
                }
            }
            
            // 更新集群总配额
            resourceManager.updateTotalQuota(allocatedQuota);
            
            log.info("Applied quota allocation to {} services", 
                    allocatedQuota.getServiceQuotas().size());
        } catch (Exception e) {
            log.error("Failed to apply quota allocation", e);
        }
    }
    
    private void recordQuotaAllocationEvent(ServiceResourceQuota serviceQuota) {
        QuotaAllocationEvent event = new QuotaAllocationEvent();
        event.setServiceId(serviceQuota.getServiceId());
        event.setAllocatedCpu(serviceQuota.getCpuCores());
        event.setAllocatedMemory(serviceQuota.getMemoryGb());
        event.setAllocatedNetwork(serviceQuota.getNetworkMbps());
        event.setAllocatedStorage(serviceQuota.getStorageGb());
        event.setTimestamp(System.currentTimeMillis());
        
        // 存储事件到数据库或日志系统
        log.info("Quota allocated for service {}: CPU={}, Memory={}GB, Network={}Mbps, Storage={}GB",
                serviceQuota.getServiceId(),
                serviceQuota.getCpuCores(),
                serviceQuota.getMemoryGb(),
                serviceQuota.getNetworkMbps(),
                serviceQuota.getStorageGb());
    }
    
    public ClusterResourceQuota getCurrentQuota() {
        return currentQuota.get();
    }
    
    // 配额分配策略接口
    public interface QuotaAllocationStrategy {
        ClusterResourceQuota allocate(ClusterResourceQuota totalQuota, 
                                    List<ServiceQuotaRequest> requests);
    }
    
    // 加权公平分配策略实现
    @Component
    public static class WeightedFairAllocationStrategy implements QuotaAllocationStrategy {
        
        @Override
        public ClusterResourceQuota allocate(ClusterResourceQuota totalQuota, 
                                          List<ServiceQuotaRequest> requests) {
            
            ClusterResourceQuota allocatedQuota = new ClusterResourceQuota();
            allocatedQuota.setTotalQuota(totalQuota);
            allocatedQuota.setAllocatedAt(System.currentTimeMillis());
            
            List<ServiceResourceQuota> serviceQuotas = new ArrayList<>();
            
            // 计算总权重
            double totalWeight = requests.stream()
                .mapToDouble(ServiceQuotaRequest::getRequirementFactor)
                .sum();
            
            if (totalWeight <= 0) {
                // 如果总权重为0，平均分配
                distributeEvenly(totalQuota, requests, serviceQuotas);
            } else {
                // 按权重分配
                distributeByWeight(totalQuota, requests, serviceQuotas, totalWeight);
            }
            
            allocatedQuota.setServiceQuotas(serviceQuotas);
            return allocatedQuota;
        }
        
        private void distributeEvenly(ClusterResourceQuota totalQuota, 
                                   List<ServiceQuotaRequest> requests,
                                   List<ServiceResourceQuota> serviceQuotas) {
            
            int serviceCount = requests.size();
            if (serviceCount == 0) return;
            
            int avgCpu = totalQuota.getTotalCpuCores() / serviceCount;
            int avgMemory = totalQuota.getTotalMemoryGb() / serviceCount;
            int avgNetwork = totalQuota.getTotalNetworkMbps() / serviceCount;
            int avgStorage = totalQuota.getTotalStorageGb() / serviceCount;
            
            for (ServiceQuotaRequest request : requests) {
                ServiceResourceQuota serviceQuota = new ServiceResourceQuota();
                serviceQuota.setServiceId(request.getServiceId());
                serviceQuota.setCpuCores(Math.max(1, avgCpu));
                serviceQuota.setMemoryGb(Math.max(1, avgMemory));
                serviceQuota.setNetworkMbps(Math.max(10, avgNetwork));
                serviceQuota.setStorageGb(Math.max(10, avgStorage));
                
                serviceQuotas.add(serviceQuota);
            }
        }
        
        private void distributeByWeight(ClusterResourceQuota totalQuota, 
                                     List<ServiceQuotaRequest> requests,
                                     List<ServiceResourceQuota> serviceQuotas,
                                     double totalWeight) {
            
            for (ServiceQuotaRequest request : requests) {
                double weightRatio = request.getRequirementFactor() / totalWeight;
                
                ServiceResourceQuota serviceQuota = new ServiceResourceQuota();
                serviceQuota.setServiceId(request.getServiceId());
                serviceQuota.setCpuCores(Math.max(1, (int) (totalQuota.getTotalCpuCores() * weightRatio)));
                serviceQuota.setMemoryGb(Math.max(1, (int) (totalQuota.getTotalMemoryGb() * weightRatio)));
                serviceQuota.setNetworkMbps(Math.max(10, (int) (totalQuota.getTotalNetworkMbps() * weightRatio)));
                serviceQuota.setStorageGb(Math.max(10, (int) (totalQuota.getTotalStorageGb() * weightRatio)));
                
                // 如果有建议配额，进行调整
                SuggestedQuotas suggested = request.getSuggestedQuotas();
                if (suggested != null) {
                    // 确保不低于建议的最小值
                    serviceQuota.setCpuCores(Math.max(serviceQuota.getCpuCores(), suggested.getCpuCores()));
                    serviceQuota.setMemoryGb(Math.max(serviceQuota.getMemoryGb(), suggested.getMemoryGb()));
                    serviceQuota.setNetworkMbps(Math.max(serviceQuota.getNetworkMbps(), suggested.getNetworkMbps()));
                    serviceQuota.setStorageGb(Math.max(serviceQuota.getStorageGb(), suggested.getStorageGb()));
                }
                
                serviceQuotas.add(serviceQuota);
            }
        }
    }
    
    // 服务配额请求
    public static class ServiceQuotaRequest {
        private String serviceId;
        private ServiceImportanceEvaluator.ServiceImportanceScore importanceScore;
        private SlaRequirementAnalyzer.SlaRequirements slaRequirements;
        private ResourceUsage currentUsage;
        private double requirementFactor;
        private SuggestedQuotas suggestedQuotas;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public ServiceImportanceEvaluator.ServiceImportanceScore getImportanceScore() { return importanceScore; }
        public void setImportanceScore(ServiceImportanceEvaluator.ServiceImportanceScore importanceScore) { this.importanceScore = importanceScore; }
        public SlaRequirementAnalyzer.SlaRequirements getSlaRequirements() { return slaRequirements; }
        public void setSlaRequirements(SlaRequirementAnalyzer.SlaRequirements slaRequirements) { this.slaRequirements = slaRequirements; }
        public ResourceUsage getCurrentUsage() { return currentUsage; }
        public void setCurrentUsage(ResourceUsage currentUsage) { this.currentUsage = currentUsage; }
        public double getRequirementFactor() { return requirementFactor; }
        public void setRequirementFactor(double requirementFactor) { this.requirementFactor = requirementFactor; }
        public SuggestedQuotas getSuggestedQuotas() { return suggestedQuotas; }
        public void setSuggestedQuotas(SuggestedQuotas suggestedQuotas) { this.suggestedQuotas = suggestedQuotas; }
    }
    
    // 建议配额
    public static class SuggestedQuotas {
        private int cpuCores;
        private int memoryGb;
        private int networkMbps;
        private int storageGb;
        
        // getter和setter方法
        public int getCpuCores() { return cpuCores; }
        public void setCpuCores(int cpuCores) { this.cpuCores = cpuCores; }
        public int getMemoryGb() { return memoryGb; }
        public void setMemoryGb(int memoryGb) { this.memoryGb = memoryGb; }
        public int getNetworkMbps() { return networkMbps; }
        public void setNetworkMbps(int networkMbps) { this.networkMbps = networkMbps; }
        public int getStorageGb() { return storageGb; }
        public void setStorageGb(int storageGb) { this.storageGb = storageGb; }
    }
}
```

## 配额调整与优化

### 动态配额调整

```java
// 动态配额调整器
@Component
public class DynamicQuotaAdjuster {
    private final IntelligentQuotaAllocator quotaAllocator;
    private final ResourceUsageMonitor usageMonitor;
    private final AlertNotificationService alertService;
    private final MetricsQueryService metricsService;
    private final ScheduledExecutorService adjustmentScheduler;
    private final Map<String, QuotaAdjustmentHistory> adjustmentHistory = new ConcurrentHashMap<>();
    
    public DynamicQuotaAdjuster(IntelligentQuotaAllocator quotaAllocator,
                              ResourceUsageMonitor usageMonitor,
                              AlertNotificationService alertService,
                              MetricsQueryService metricsService) {
        this.quotaAllocator = quotaAllocator;
        this.usageMonitor = usageMonitor;
        this.alertService = alertService;
        this.metricsService = metricsService;
        this.adjustmentScheduler = Executors.newScheduledThreadPool(1);
        
        // 启动定期配额调整任务
        adjustmentScheduler.scheduleAtFixedRate(this::adjustQuotas, 
            1, 1, TimeUnit.MINUTES);
    }
    
    private void adjustQuotas() {
        try {
            ClusterResourceQuota currentQuota = quotaAllocator.getCurrentQuota();
            if (currentQuota == null) {
                return;
            }
            
            // 检查是否需要调整配额
            List<QuotaAdjustment> adjustments = checkQuotaAdjustments(currentQuota);
            
            if (!adjustments.isEmpty()) {
                // 执行配额调整
                executeQuotaAdjustments(adjustments, currentQuota);
                
                // 发送调整通知
                notifyQuotaAdjustments(adjustments);
            }
        } catch (Exception e) {
            log.error("Failed to adjust quotas", e);
        }
    }
    
    private List<QuotaAdjustment> checkQuotaAdjustments(ClusterResourceQuota currentQuota) {
        List<QuotaAdjustment> adjustments = new ArrayList<>();
        
        for (ServiceResourceQuota serviceQuota : currentQuota.getServiceQuotas()) {
            try {
                QuotaAdjustment adjustment = checkServiceQuotaAdjustment(serviceQuota);
                if (adjustment != null && adjustment.isAdjustmentNeeded()) {
                    adjustments.add(adjustment);
                }
            } catch (Exception e) {
                log.warn("Failed to check quota adjustment for service: " + 
                        serviceQuota.getServiceId(), e);
            }
        }
        
        return adjustments;
    }
    
    private QuotaAdjustment checkServiceQuotaAdjustment(ServiceResourceQuota serviceQuota) {
        String serviceId = serviceQuota.getServiceId();
        
        // 获取当前资源使用情况
        ResourceUsage currentUsage = usageMonitor.getCurrentUsage(serviceId);
        if (currentUsage == null) {
            return null;
        }
        
        QuotaAdjustment adjustment = new QuotaAdjustment();
        adjustment.setServiceId(serviceId);
        adjustment.setCurrentQuota(serviceQuota);
        adjustment.setCurrentUsage(currentUsage);
        
        // 检查CPU使用情况
        checkCpuAdjustment(adjustment, currentUsage, serviceQuota);
        
        // 检查内存使用情况
        checkMemoryAdjustment(adjustment, currentUsage, serviceQuota);
        
        // 检查是否需要调整
        adjustment.setAdjustmentNeeded(
            adjustment.getCpuAdjustment() != 0 || 
            adjustment.getMemoryAdjustment() != 0 ||
            adjustment.getNetworkAdjustment() != 0 ||
            adjustment.getStorageAdjustment() != 0
        );
        
        return adjustment;
    }
    
    private void checkCpuAdjustment(QuotaAdjustment adjustment, ResourceUsage currentUsage, 
                                  ServiceResourceQuota serviceQuota) {
        double cpuUsage = currentUsage.getCpuUsage();
        int currentCpu = serviceQuota.getCpuCores();
        
        if (cpuUsage > 80) { // CPU使用率超过80%
            // 需要增加CPU配额
            int additionalCpu = Math.max(1, currentCpu / 4); // 增加25%
            adjustment.setCpuAdjustment(additionalCpu);
            adjustment.setAdjustmentReason("High CPU usage: " + cpuUsage + "%");
        } else if (cpuUsage < 20) { // CPU使用率低于20%
            // 可以减少CPU配额
            int reducedCpu = Math.max(1, currentCpu / 10); // 减少10%
            adjustment.setCpuAdjustment(-reducedCpu);
            adjustment.setAdjustmentReason("Low CPU usage: " + cpuUsage + "%");
        }
    }
    
    private void checkMemoryAdjustment(QuotaAdjustment adjustment, ResourceUsage currentUsage, 
                                     ServiceResourceQuota serviceQuota) {
        double memoryUsage = currentUsage.getMemoryUsage();
        int currentMemory = serviceQuota.getMemoryGb();
        
        if (memoryUsage > 85) { // 内存使用率超过85%
            // 需要增加内存配额
            int additionalMemory = Math.max(1, currentMemory / 3); // 增加33%
            adjustment.setMemoryAdjustment(additionalMemory);
            adjustment.setAdjustmentReason("High memory usage: " + memoryUsage + "%");
        } else if (memoryUsage < 25) { // 内存使用率低于25%
            // 可以减少内存配额
            int reducedMemory = Math.max(1, currentMemory / 10); // 减少10%
            adjustment.setMemoryAdjustment(-reducedMemory);
            adjustment.setAdjustmentReason("Low memory usage: " + memoryUsage + "%");
        }
    }
    
    private void executeQuotaAdjustments(List<QuotaAdjustment> adjustments, 
                                       ClusterResourceQuota currentQuota) {
        for (QuotaAdjustment adjustment : adjustments) {
            try {
                ServiceResourceQuota originalQuota = adjustment.getCurrentQuota();
                
                // 计算新的配额
                ServiceResourceQuota newQuota = new ServiceResourceQuota();
                newQuota.setServiceId(originalQuota.getServiceId());
                newQuota.setCpuCores(Math.max(1, originalQuota.getCpuCores() + adjustment.getCpuAdjustment()));
                newQuota.setMemoryGb(Math.max(1, originalQuota.getMemoryGb() + adjustment.getMemoryAdjustment()));
                newQuota.setNetworkMbps(Math.max(10, originalQuota.getNetworkMbps() + adjustment.getNetworkAdjustment()));
                newQuota.setStorageGb(Math.max(10, originalQuota.getStorageGb() + adjustment.getStorageAdjustment()));
                
                // 应用新的配额
                // 这里应该调用资源管理器来应用配额变更
                log.info("Adjusted quota for service {}: CPU {}->{}, Memory {}->{}GB",
                        newQuota.getServiceId(),
                        originalQuota.getCpuCores(), newQuota.getCpuCores(),
                        originalQuota.getMemoryGb(), newQuota.getMemoryGb());
                
                // 记录调整历史
                recordAdjustmentHistory(adjustment, newQuota);
                
            } catch (Exception e) {
                log.error("Failed to execute quota adjustment for service: " + 
                        adjustment.getServiceId(), e);
            }
        }
    }
    
    private void recordAdjustmentHistory(QuotaAdjustment adjustment, 
                                       ServiceResourceQuota newQuota) {
        QuotaAdjustmentHistory history = new QuotaAdjustmentHistory();
        history.setServiceId(adjustment.getServiceId());
        history.setTimestamp(System.currentTimeMillis());
        history.setReason(adjustment.getAdjustmentReason());
        history.setOldQuota(adjustment.getCurrentQuota());
        history.setNewQuota(newQuota);
        
        adjustmentHistory.put(adjustment.getServiceId(), history);
    }
    
    private void notifyQuotaAdjustments(List<QuotaAdjustment> adjustments) {
        for (QuotaAdjustment adjustment : adjustments) {
            try {
                AlertEvent alert = new AlertEvent();
                alert.setType("QUOTA_ADJUSTMENT");
                alert.setLevel("INFO");
                alert.setTitle("Quota Adjustment for Service: " + adjustment.getServiceId());
                alert.setMessage(adjustment.getAdjustmentReason());
                
                Map<String, Object> details = new HashMap<>();
                details.put("serviceId", adjustment.getServiceId());
                details.put("cpuAdjustment", adjustment.getCpuAdjustment());
                details.put("memoryAdjustment", adjustment.getMemoryAdjustment());
                details.put("reason", adjustment.getAdjustmentReason());
                alert.setDetails(details);
                
                alertService.sendAlert(alert);
            } catch (Exception e) {
                log.warn("Failed to send quota adjustment notification for service: " + 
                        adjustment.getServiceId(), e);
            }
        }
    }
    
    // 配额调整
    public static class QuotaAdjustment {
        private String serviceId;
        private ServiceResourceQuota currentQuota;
        private ResourceUsage currentUsage;
        private int cpuAdjustment;
        private int memoryAdjustment;
        private int networkAdjustment;
        private int storageAdjustment;
        private String adjustmentReason;
        private boolean adjustmentNeeded;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public ServiceResourceQuota getCurrentQuota() { return currentQuota; }
        public void setCurrentQuota(ServiceResourceQuota currentQuota) { this.currentQuota = currentQuota; }
        public ResourceUsage getCurrentUsage() { return currentUsage; }
        public void setCurrentUsage(ResourceUsage currentUsage) { this.currentUsage = currentUsage; }
        public int getCpuAdjustment() { return cpuAdjustment; }
        public void setCpuAdjustment(int cpuAdjustment) { this.cpuAdjustment = cpuAdjustment; }
        public int getMemoryAdjustment() { return memoryAdjustment; }
        public void setMemoryAdjustment(int memoryAdjustment) { this.memoryAdjustment = memoryAdjustment; }
        public int getNetworkAdjustment() { return networkAdjustment; }
        public void setNetworkAdjustment(int networkAdjustment) { this.networkAdjustment = networkAdjustment; }
        public int getStorageAdjustment() { return storageAdjustment; }
        public void setStorageAdjustment(int storageAdjustment) { this.storageAdjustment = storageAdjustment; }
        public String getAdjustmentReason() { return adjustmentReason; }
        public void setAdjustmentReason(String adjustmentReason) { this.adjustmentReason = adjustmentReason; }
        public boolean isAdjustmentNeeded() { return adjustmentNeeded; }
        public void setAdjustmentNeeded(boolean adjustmentNeeded) { this.adjustmentNeeded = adjustmentNeeded; }
    }
    
    // 配额调整历史
    public static class QuotaAdjustmentHistory {
        private String serviceId;
        private long timestamp;
        private String reason;
        private ServiceResourceQuota oldQuota;
        private ServiceResourceQuota newQuota;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public ServiceResourceQuota getOldQuota() { return oldQuota; }
        public void setOldQuota(ServiceResourceQuota oldQuota) { this.oldQuota = oldQuota; }
        public ServiceResourceQuota getNewQuota() { return newQuota; }
        public void setNewQuota(ServiceResourceQuota newQuota) { this.newQuota = newQuota; }
    }
}
```

## 配额监控与告警

### 配额使用监控

```java
// 配额使用监控器
@Component
public class QuotaUsageMonitor {
    private final MetricsQueryService metricsService;
    private final AlertNotificationService alertService;
    private final ClusterResourceManager resourceManager;
    private final ScheduledExecutorService monitoringScheduler;
    private final Map<String, QuotaUsageStats> usageStats = new ConcurrentHashMap<>();
    
    public QuotaUsageMonitor(MetricsQueryService metricsService,
                           AlertNotificationService alertService,
                           ClusterResourceManager resourceManager) {
        this.metricsService = metricsService;
        this.alertService = alertService;
        this.resourceManager = resourceManager;
        this.monitoringScheduler = Executors.newScheduledThreadPool(1);
        
        // 启动定期监控任务
        monitoringScheduler.scheduleAtFixedRate(this::monitorQuotaUsage, 
            0, 30, TimeUnit.SECONDS);
    }
    
    private void monitorQuotaUsage() {
        try {
            // 获取所有服务的配额使用情况
            List<ServiceQuotaUsage> quotaUsages = collectQuotaUsages();
            
            // 更新使用统计
            updateUsageStats(quotaUsages);
            
            // 检查配额使用告警
            checkQuotaUsageAlerts(quotaUsages);
            
            // 检查配额超分告警
            checkOvercommitmentAlerts();
        } catch (Exception e) {
            log.error("Failed to monitor quota usage", e);
        }
    }
    
    private List<ServiceQuotaUsage> collectQuotaUsages() {
        List<ServiceQuotaUsage> usages = new ArrayList<>();
        
        // 获取所有服务ID
        List<String> serviceIds = resourceManager.getAllServiceIds();
        
        for (String serviceId : serviceIds) {
            try {
                ServiceQuotaUsage usage = new ServiceQuotaUsage();
                usage.setServiceId(serviceId);
                usage.setTimestamp(System.currentTimeMillis());
                
                // 获取配额信息
                ServiceResourceQuota quota = resourceManager.getServiceQuota(serviceId);
                if (quota != null) {
                    usage.setQuota(quota);
                }
                
                // 获取实际使用情况
                ResourceUsage actualUsage = metricsService.getCurrentResourceUsage(serviceId);
                if (actualUsage != null) {
                    usage.setActualUsage(actualUsage);
                }
                
                // 计算使用率
                calculateUsageRates(usage);
                
                usages.add(usage);
            } catch (Exception e) {
                log.warn("Failed to collect quota usage for service: " + serviceId, e);
            }
        }
        
        return usages;
    }
    
    private void calculateUsageRates(ServiceQuotaUsage usage) {
        ServiceResourceQuota quota = usage.getQuota();
        ResourceUsage actual = usage.getActualUsage();
        
        if (quota == null || actual == null) {
            return;
        }
        
        // 计算各项资源使用率
        if (quota.getCpuCores() > 0) {
            usage.setCpuUsageRate(Math.min(1.0, actual.getCpuUsage() / quota.getCpuCores()));
        }
        
        if (quota.getMemoryGb() > 0) {
            usage.setMemoryUsageRate(Math.min(1.0, 
                actual.getMemoryUsage() / (quota.getMemoryGb() * 1024))); // 转换为MB
        }
        
        if (quota.getNetworkMbps() > 0) {
            usage.setNetworkUsageRate(Math.min(1.0, 
                actual.getNetworkUsage() / quota.getNetworkMbps()));
        }
        
        if (quota.getStorageGb() > 0) {
            usage.setStorageUsageRate(Math.min(1.0, 
                actual.getStorageUsage() / (quota.getStorageGb() * 1024))); // 转换为MB
        }
    }
    
    private void updateUsageStats(List<ServiceQuotaUsage> quotaUsages) {
        for (ServiceQuotaUsage usage : quotaUsages) {
            try {
                String serviceId = usage.getServiceId();
                QuotaUsageStats stats = usageStats.computeIfAbsent(serviceId, 
                    k -> new QuotaUsageStats());
                
                // 更新统计信息
                stats.addUsageRecord(usage);
            } catch (Exception e) {
                log.warn("Failed to update usage stats for service: " + usage.getServiceId(), e);
            }
        }
    }
    
    private void checkQuotaUsageAlerts(List<ServiceQuotaUsage> quotaUsages) {
        for (ServiceQuotaUsage usage : quotaUsages) {
            try {
                checkHighUsageAlert(usage);
                checkLowUsageAlert(usage);
            } catch (Exception e) {
                log.warn("Failed to check quota usage alerts for service: " + 
                        usage.getServiceId(), e);
            }
        }
    }
    
    private void checkHighUsageAlert(ServiceQuotaUsage usage) {
        // 检查高使用率告警
        if (usage.getCpuUsageRate() > 0.9) { // CPU使用率超过90%
            sendQuotaUsageAlert(usage, "HIGH_CPU_USAGE", 
                "CPU usage is high: " + String.format("%.2f%%", usage.getCpuUsageRate() * 100));
        }
        
        if (usage.getMemoryUsageRate() > 0.95) { // 内存使用率超过95%
            sendQuotaUsageAlert(usage, "HIGH_MEMORY_USAGE", 
                "Memory usage is high: " + String.format("%.2f%%", usage.getMemoryUsageRate() * 100));
        }
        
        if (usage.getNetworkUsageRate() > 0.85) { // 网络使用率超过85%
            sendQuotaUsageAlert(usage, "HIGH_NETWORK_USAGE", 
                "Network usage is high: " + String.format("%.2f%%", usage.getNetworkUsageRate() * 100));
        }
    }
    
    private void checkLowUsageAlert(ServiceQuotaUsage> usage) {
        // 检查低使用率告警（可能分配过多资源）
        if (usage.getCpuUsageRate() < 0.1 && 
            usage.getQuota().getCpuCores() > 4) { // CPU配额大于4核但使用率低于10%
            sendQuotaUsageAlert(usage, "LOW_CPU_USAGE", 
                "CPU allocation may be excessive: " + String.format("%.2f%%", usage.getCpuUsageRate() * 100));
        }
        
        if (usage.getMemoryUsageRate() < 0.15 && 
            usage.getQuota().getMemoryGb() > 8) { // 内存配额大于8GB但使用率低于15%
            sendQuotaUsageAlert(usage, "LOW_MEMORY_USAGE", 
                "Memory allocation may be excessive: " + String.format("%.2f%%", usage.getMemoryUsageRate() * 100));
        }
    }
    
    private void sendQuotaUsageAlert(ServiceQuotaUsage usage, String alertType, String message) {
        try {
            AlertEvent alert = new AlertEvent();
            alert.setType(alertType);
            alert.setLevel("WARNING");
            alert.setTitle("Quota Usage Alert for Service: " + usage.getServiceId());
            alert.setMessage(message);
            
            Map<String, Object> details = new HashMap<>();
            details.put("serviceId", usage.getServiceId());
            details.put("cpuUsageRate", usage.getCpuUsageRate());
            details.put("memoryUsageRate", usage.getMemoryUsageRate());
            details.put("networkUsageRate", usage.getNetworkUsageRate());
            details.put("storageUsageRate", usage.getStorageUsageRate());
            alert.setDetails(details);
            
            alertService.sendAlert(alert);
        } catch (Exception e) {
            log.warn("Failed to send quota usage alert for service: " + usage.getServiceId(), e);
        }
    }
    
    private void checkOvercommitmentAlerts() {
        try {
            // 检查集群资源是否超分
            ClusterResourceQuota totalQuota = resourceManager.getTotalResourceQuota();
            if (totalQuota == null) {
                return;
            }
            
            ResourceUsage totalUsage = metricsService.getTotalClusterUsage();
            if (totalUsage == null) {
                return;
            }
            
            // 计算集群资源使用率
            double clusterCpuUsage = totalUsage.getCpuUsage() / totalQuota.getTotalCpuCores();
            double clusterMemoryUsage = totalUsage.getMemoryUsage() / (totalQuota.getTotalMemoryGb() * 1024);
            
            if (clusterCpuUsage > 0.95) { // 集群CPU使用率超过95%
                sendClusterOvercommitmentAlert("HIGH_CLUSTER_CPU_USAGE", 
                    "Cluster CPU usage is critically high: " + String.format("%.2f%%", clusterCpuUsage * 100));
            }
            
            if (clusterMemoryUsage > 0.98) { // 集群内存使用率超过98%
                sendClusterOvercommitmentAlert("HIGH_CLUSTER_MEMORY_USAGE", 
                    "Cluster memory usage is critically high: " + String.format("%.2f%%", clusterMemoryUsage * 100));
            }
        } catch (Exception e) {
            log.error("Failed to check cluster overcommitment", e);
        }
    }
    
    private void sendClusterOvercommitmentAlert(String alertType, String message) {
        try {
            AlertEvent alert = new AlertEvent();
            alert.setType(alertType);
            alert.setLevel("CRITICAL");
            alert.setTitle("Cluster Resource Overcommitment Alert");
            alert.setMessage(message);
            
            alertService.sendAlert(alert);
        } catch (Exception e) {
            log.error("Failed to send cluster overcommitment alert", e);
        }
    }
    
    public QuotaUsageStats getUsageStats(String serviceId) {
        return usageStats.get(serviceId);
    }
    
    // 配额使用统计
    public static class QuotaUsageStats {
        private final Queue<ServiceQuotaUsage> usageHistory = new CircularFifoQueue<>(100);
        private double avgCpuUsageRate;
        private double avgMemoryUsageRate;
        private double avgNetworkUsageRate;
        private double peakCpuUsageRate;
        private double peakMemoryUsageRate;
        
        public synchronized void addUsageRecord(ServiceQuotaUsage usage) {
            usageHistory.offer(usage);
            
            // 重新计算统计数据
            recalculateStats();
        }
        
        private void recalculateStats() {
            if (usageHistory.isEmpty()) {
                return;
            }
            
            DoubleSummaryStatistics cpuStats = usageHistory.stream()
                .mapToDouble(ServiceQuotaUsage::getCpuUsageRate)
                .summaryStatistics();
                
            DoubleSummaryStatistics memoryStats = usageHistory.stream()
                .mapToDouble(ServiceQuotaUsage::getMemoryUsageRate)
                .summaryStatistics();
                
            DoubleSummaryStatistics networkStats = usageHistory.stream()
                .mapToDouble(ServiceQuotaUsage::getNetworkUsageRate)
                .summaryStatistics();
            
            this.avgCpuUsageRate = cpuStats.getAverage();
            this.avgMemoryUsageRate = memoryStats.getAverage();
            this.avgNetworkUsageRate = networkStats.getAverage();
            this.peakCpuUsageRate = cpuStats.getMax();
            this.peakMemoryUsageRate = memoryStats.getMax();
        }
        
        // getter方法
        public double getAvgCpuUsageRate() { return avgCpuUsageRate; }
        public double getAvgMemoryUsageRate() { return avgMemoryUsageRate; }
        public double getAvgNetworkUsageRate() { return avgNetworkUsageRate; }
        public double getPeakCpuUsageRate() { return peakCpuUsageRate; }
        public double getPeakMemoryUsageRate() { return peakMemoryUsageRate; }
        public Collection<ServiceQuotaUsage> getUsageHistory() { return new ArrayList<>(usageHistory); }
    }
    
    // 服务配额使用情况
    public static class ServiceQuotaUsage {
        private String serviceId;
        private long timestamp;
        private ServiceResourceQuota quota;
        private ResourceUsage actualUsage;
        private double cpuUsageRate;
        private double memoryUsageRate;
        private double networkUsageRate;
        private double storageUsageRate;
        
        // getter和setter方法
        public String getServiceId() { return serviceId; }
        public void setServiceId(String serviceId) { this.serviceId = serviceId; }
        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
        public ServiceResourceQuota getQuota() { return quota; }
        public void setQuota(ServiceResourceQuota quota) { this.quota = quota; }
        public ResourceUsage getActualUsage() { return actualUsage; }
        public void setActualUsage(ResourceUsage actualUsage) { this.actualUsage = actualUsage; }
        public double getCpuUsageRate() { return cpuUsageRate; }
        public void setCpuUsageRate(double cpuUsageRate) { this.cpuUsageRate = cpuUsageRate; }
        public double getMemoryUsageRate() { return memoryUsageRate; }
        public void setMemoryUsageRate(double memoryUsageRate) { this.memoryUsageRate = memoryUsageRate; }
        public double getNetworkUsageRate() { return networkUsageRate; }
        public void setNetworkUsageRate(double networkUsageRate) { this.networkUsageRate = networkUsageRate; }
        public double getStorageUsageRate() { return storageUsageRate; }
        public void setStorageUsageRate(double storageUsageRate) { this.storageUsageRate = storageUsageRate; }
    }
}
```

通过以上实现，我们构建了一个完整的智能配额分配系统，能够根据服务重要性、SLA要求动态分配集群总配额。该系统通过服务重要性评估、SLA要求分析、动态配额分配算法等核心组件，实现了资源的智能化分配和管理。同时，系统还提供了动态调整、监控告警等辅助功能，确保配额分配的合理性和有效性。在实际应用中，需要根据具体的业务场景和技术架构进行相应的调整和优化。