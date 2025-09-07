---
title: "供应商管理: 多供应商配置、负载均衡、自动故障切换"
date: 2025-09-06
categories: [GouTong]
tags: [GouTong]
published: true
---
在构建统一通知通道平台的过程中，供应商管理是确保平台高可用性、成本优化和风险分散的关键环节。通过有效的多供应商配置、负载均衡和自动故障切换机制，我们可以构建一个稳定、可靠且具有成本效益的通知服务平台。本文将深入探讨供应商管理的设计原理和实现策略。

## 供应商管理的重要性

供应商管理作为统一通知平台的核心管理功能，其重要性体现在以下几个方面：

### 高可用性保障

有效的供应商管理确保平台的高可用性：
- **故障冗余**：通过多供应商实现故障冗余
- **自动切换**：支持供应商故障时的自动切换
- **负载分散**：将负载分散到多个供应商
- **服务质量**：保障整体服务质量的稳定性

### 成本优化

供应商管理有助于实现成本优化：
- **价格竞争**：通过多供应商实现价格竞争
- **按需选择**：根据成本选择最优供应商
- **资源利用**：最大化资源利用效率
- **预算控制**：有效控制通知服务预算

### 风险分散

供应商管理有效分散业务风险：
- **依赖降低**：降低对单一供应商的依赖
- **合同管理**：规范供应商合同和SLA管理
- **合规保障**：确保供应商符合相关法规
- **业务连续**：保障业务的连续性运行

## 多供应商配置管理

多供应商配置管理是实现供应商管理的基础：

### 供应商信息管理

#### 供应商档案设计

```java
// 示例：供应商档案设计
@Entity
@Table(name = "supplier_profiles")
public class SupplierProfile {
    @Id
    private String supplierId;
    
    private String supplierName;
    private String supplierType; // SMS, EMAIL, PUSH, VOICE, IM
    private String providerType; // 具体供应商类型 (e.g., Twilio, SendGrid)
    private String description;
    private String website;
    private String contactInfo;
    private String apiEndpoint;
    private String status; // ACTIVE, INACTIVE, MAINTENANCE
    private boolean isPrimary; // 是否为主要供应商
    private int priority; // 优先级，数字越小优先级越高
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 认证信息（加密存储）
    @Embedded
    private SupplierCredentials credentials;
    
    // SLA配置
    @Embedded
    private ServiceLevelAgreement sla;
    
    // 成本配置
    @Embedded
    private CostConfiguration costConfig;
    
    // 技术能力
    @ElementCollection
    private Set<String> supportedFeatures;
    
    // 地理覆盖
    @ElementCollection
    private Set<String> coverageAreas;
    
    // 构造函数、getter和setter方法...
}

// 供应商认证信息
@Embeddable
public class SupplierCredentials {
    private String apiKey;
    private String apiSecret;
    private String accessToken;
    private String senderId;
    private Map<String, String> customCredentials;
    
    // getter和setter方法...
}

// 服务等级协议
@Embeddable
public class ServiceLevelAgreement {
    private double availability; // 可用性百分比
    private int responseTime; // 响应时间（毫秒）
    private double successRate; // 成功率百分比
    private String supportLevel; // 支持等级
    private String penaltyClause; // 违约条款
    
    // getter和setter方法...
}

// 成本配置
@Embeddable
public class CostConfiguration {
    private BigDecimal basePrice; // 基础价格
    private BigDecimal perMessagePrice; // 每条消息价格
    private String currency; // 货币类型
    private String billingCycle; // 计费周期
    private Map<String, BigDecimal> tieredPricing; // 分层定价
    private BigDecimal freeQuota; // 免费额度
    
    // getter和setter方法...
}
```

关键设计要点：
- **完整信息**：包含供应商的完整信息档案
- **安全存储**：认证信息的安全加密存储
- **SLA管理**：服务等级协议的详细配置
- **成本控制**：成本和定价信息的管理

#### 供应商配置管理

```java
// 示例：供应商配置管理服务
@Service
public class SupplierConfigurationService {
    
    @Autowired
    private SupplierProfileRepository supplierProfileRepository;
    
    @Autowired
    private ConfigurationService configurationService;
    
    // 创建供应商配置
    public SupplierProfile createSupplierProfile(SupplierProfile profile) {
        validateSupplierProfile(profile);
        
        // 加密敏感信息
        encryptCredentials(profile.getCredentials());
        
        profile.setSupplierId(UUID.randomUUID().toString());
        profile.setCreatedAt(LocalDateTime.now());
        profile.setUpdatedAt(LocalDateTime.now());
        
        SupplierProfile savedProfile = supplierProfileRepository.save(profile);
        
        // 更新配置缓存
        configurationService.updateSupplierConfig(profile);
        
        log.info("供应商配置创建成功: supplierId={}", profile.getSupplierId());
        return savedProfile;
    }
    
    // 更新供应商配置
    public SupplierProfile updateSupplierProfile(String supplierId, SupplierProfile profile) {
        SupplierProfile existingProfile = supplierProfileRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("供应商未找到: " + supplierId));
        
        // 更新字段
        existingProfile.setSupplierName(profile.getSupplierName());
        existingProfile.setDescription(profile.getDescription());
        existingProfile.setStatus(profile.getStatus());
        existingProfile.setPriority(profile.getPriority());
        existingProfile.setIsPrimary(profile.isPrimary());
        existingProfile.setUpdatedAt(LocalDateTime.now());
        
        // 更新认证信息（如果提供）
        if (profile.getCredentials() != null) {
            encryptCredentials(profile.getCredentials());
            existingProfile.setCredentials(profile.getCredentials());
        }
        
        // 更新SLA和成本配置
        if (profile.getSla() != null) {
            existingProfile.setSla(profile.getSla());
        }
        if (profile.getCostConfig() != null) {
            existingProfile.setCostConfig(profile.getCostConfig());
        }
        
        SupplierProfile updatedProfile = supplierProfileRepository.save(existingProfile);
        
        // 更新配置缓存
        configurationService.updateSupplierConfig(updatedProfile);
        
        log.info("供应商配置更新成功: supplierId={}", supplierId);
        return updatedProfile;
    }
    
    // 获取供应商配置
    public SupplierProfile getSupplierProfile(String supplierId) {
        return supplierProfileRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("供应商未找到: " + supplierId));
    }
    
    // 获取所有启用的供应商
    public List<SupplierProfile> getActiveSuppliers() {
        return supplierProfileRepository.findByStatus("ACTIVE");
    }
    
    // 根据类型获取供应商
    public List<SupplierProfile> getSuppliersByType(String supplierType) {
        return supplierProfileRepository.findBySupplierTypeAndStatus(supplierType, "ACTIVE");
    }
    
    // 验证供应商配置
    private void validateSupplierProfile(SupplierProfile profile) {
        if (StringUtils.isEmpty(profile.getSupplierName())) {
            throw new ValidationException("供应商名称不能为空");
        }
        
        if (StringUtils.isEmpty(profile.getSupplierType())) {
            throw new ValidationException("供应商类型不能为空");
        }
        
        if (profile.getCredentials() == null) {
            throw new ValidationException("认证信息不能为空");
        }
        
        // 验证API端点格式
        if (!isValidUrl(profile.getApiEndpoint())) {
            throw new ValidationException("API端点格式不正确");
        }
    }
    
    private void encryptCredentials(SupplierCredentials credentials) {
        // 加密API密钥和密钥
        if (credentials.getApiKey() != null) {
            credentials.setApiKey(encrypt(credentials.getApiKey()));
        }
        if (credentials.getApiSecret() != null) {
            credentials.setApiSecret(encrypt(credentials.getApiSecret()));
        }
        if (credentials.getAccessToken() != null) {
            credentials.setAccessToken(encrypt(credentials.getAccessToken()));
        }
    }
}
```

关键管理要点：
- **配置创建**：支持供应商配置的创建和初始化
- **配置更新**：支持供应商配置的动态更新
- **安全处理**：敏感信息的安全加密处理
- **验证机制**：完善的配置验证机制

### 供应商分组管理

#### 业务分组策略

```java
// 示例：供应商分组管理
@Entity
@Table(name = "supplier_groups")
public class SupplierGroup {
    @Id
    private String groupId;
    
    private String groupName;
    private String description;
    private String businessType; // 业务类型 (VERIFICATION, MARKETING, NOTIFICATION)
    private String channelType;  // 通道类型 (SMS, EMAIL, PUSH)
    private GroupStrategy strategy; // 分组策略
    private boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 供应商成员
    @ElementCollection
    private List<SupplierMember> members;
    
    // 构造函数、getter和setter方法...
}

// 供应商成员
@Embeddable
public class SupplierMember {
    private String supplierId;
    private int weight; // 权重
    private boolean enabled; // 是否启用
    private LocalDateTime addedAt; // 添加时间
    
    // getter和setter方法...
}

// 分组策略
@Embeddable
public class GroupStrategy {
    private LoadBalancingStrategy loadBalancing; // 负载均衡策略
    private FailoverStrategy failover; // 故障切换策略
    private CostOptimizationStrategy costOptimization; // 成本优化策略
    private QualityStrategy quality; // 质量优先策略
    
    // getter和setter方法...
}

// 负载均衡策略枚举
public enum LoadBalancingStrategy {
    ROUND_ROBIN,      // 轮询
    WEIGHTED_ROUND_ROBIN, // 加权轮询
    LEAST_CONNECTIONS, // 最少连接
    RANDOM,           // 随机
    COST_BASED        // 基于成本
}

// 故障切换策略枚举
public enum FailoverStrategy {
    IMMEDIATE,        // 立即切换
    DELAYED,          // 延迟切换
    THRESHOLD_BASED,  // 基于阈值切换
    MANUAL            // 手动切换
}
```

关键分组要点：
- **业务导向**：按业务类型和通道类型分组
- **策略配置**：支持多种分组策略配置
- **权重管理**：支持供应商权重配置
- **动态调整**：支持分组配置的动态调整

#### 分组策略实现

```java
// 示例：供应商分组策略实现
@Service
public class SupplierGroupService {
    
    @Autowired
    private SupplierGroupRepository supplierGroupRepository;
    
    @Autowired
    private SupplierProfileRepository supplierProfileRepository;
    
    @Autowired
    private SupplierHealthService supplierHealthService;
    
    // 根据业务类型和通道类型获取供应商分组
    public SupplierGroup getSupplierGroup(String businessType, String channelType) {
        return supplierGroupRepository.findByBusinessTypeAndChannelType(businessType, channelType);
    }
    
    // 获取可用供应商列表
    public List<SupplierProfile> getAvailableSuppliers(String businessType, String channelType) {
        SupplierGroup group = getSupplierGroup(businessType, channelType);
        if (group == null || !group.isEnabled()) {
            return Collections.emptyList();
        }
        
        List<SupplierProfile> availableSuppliers = new ArrayList<>();
        for (SupplierMember member : group.getMembers()) {
            if (member.isEnabled()) {
                SupplierProfile supplier = supplierProfileRepository.findById(member.getSupplierId()).orElse(null);
                if (supplier != null && "ACTIVE".equals(supplier.getStatus())) {
                    // 检查供应商健康状态
                    if (supplierHealthService.isSupplierHealthy(member.getSupplierId())) {
                        availableSuppliers.add(supplier);
                    }
                }
            }
        }
        
        // 根据策略排序
        return sortSuppliersByStrategy(availableSuppliers, group.getStrategy());
    }
    
    // 根据策略对供应商排序
    private List<SupplierProfile> sortSuppliersByStrategy(
        List<SupplierProfile> suppliers, GroupStrategy strategy) {
        
        switch (strategy.getLoadBalancing()) {
            case ROUND_ROBIN:
                return sortRoundRobin(suppliers);
            case WEIGHTED_ROUND_ROBIN:
                return sortWeightedRoundRobin(suppliers);
            case LEAST_CONNECTIONS:
                return sortLeastConnections(suppliers);
            case COST_BASED:
                return sortCostBased(suppliers);
            case RANDOM:
            default:
                return sortRandom(suppliers);
        }
    }
    
    // 加权轮询排序
    private List<SupplierProfile> sortWeightedRoundRobin(List<SupplierProfile> suppliers) {
        return suppliers.stream()
            .sorted((s1, s2) -> {
                // 获取权重信息
                int weight1 = getSupplierWeight(s1.getSupplierId());
                int weight2 = getSupplierWeight(s2.getSupplierId());
                return Integer.compare(weight2, weight1); // 权重高的排在前面
            })
            .collect(Collectors.toList());
    }
    
    // 成本优化排序
    private List<SupplierProfile> sortCostBased(List<SupplierProfile> suppliers) {
        return suppliers.stream()
            .sorted((s1, s2) -> {
                BigDecimal cost1 = calculateSupplierCost(s1);
                BigDecimal cost2 = calculateSupplierCost(s2);
                return cost1.compareTo(cost2); // 成本低的排在前面
            })
            .collect(Collectors.toList());
    }
    
    // 获取供应商权重
    private int getSupplierWeight(String supplierId) {
        // 从配置或数据库中获取供应商权重
        return configurationService.getSupplierWeight(supplierId);
    }
    
    // 计算供应商成本
    private BigDecimal calculateSupplierCost(SupplierProfile supplier) {
        CostConfiguration costConfig = supplier.getCostConfig();
        if (costConfig != null && costConfig.getPerMessagePrice() != null) {
            return costConfig.getPerMessagePrice();
        }
        return BigDecimal.ZERO;
    }
}
```

关键策略要点：
- **动态排序**：根据策略动态排序供应商
- **健康检查**：结合健康状态筛选供应商
- **权重计算**：支持加权轮询算法
- **成本优化**：支持基于成本的排序

## 负载均衡机制

负载均衡是实现供应商资源合理分配的关键机制：

### 负载均衡算法

#### 轮询算法

```java
// 示例：轮询负载均衡算法
@Component
public class RoundRobinLoadBalancer {
    
    private final Map<String, AtomicInteger> currentIndexMap = new ConcurrentHashMap<>();
    
    public SupplierProfile selectSupplier(List<SupplierProfile> suppliers, String key) {
        if (suppliers == null || suppliers.isEmpty()) {
            return null;
        }
        
        if (suppliers.size() == 1) {
            return suppliers.get(0);
        }
        
        AtomicInteger currentIndex = currentIndexMap.computeIfAbsent(key, k -> new AtomicInteger(0));
        int index = Math.abs(currentIndex.getAndIncrement()) % suppliers.size();
        return suppliers.get(index);
    }
}
```

关键实现要点：
- **简单高效**：算法简单且执行效率高
- **均匀分配**：请求均匀分配到各供应商
- **无状态**：算法本身无状态，易于实现

#### 加权轮询算法

```java
// 示例：加权轮询负载均衡算法
@Component
public class WeightedRoundRobinLoadBalancer {
    
    private final Map<String, Long> lastSelectTimeMap = new ConcurrentHashMap<>();
    
    public SupplierProfile selectSupplier(List<SupplierProfile> suppliers, String key) {
        if (suppliers == null || suppliers.isEmpty()) {
            return null;
        }
        
        if (suppliers.size() == 1) {
            return suppliers.get(0);
        }
        
        // 计算总权重
        int totalWeight = suppliers.stream()
            .mapToInt(this::getSupplierWeight)
            .sum();
            
        if (totalWeight <= 0) {
            // 如果总权重为0，使用普通轮询
            return new RoundRobinLoadBalancer().selectSupplier(suppliers, key);
        }
        
        // 使用加权轮询算法
        long currentTime = System.currentTimeMillis();
        long lastSelectTime = lastSelectTimeMap.getOrDefault(key, 0L);
        
        // 计算当前应该选择的权重位置
        int currentWeight = (int) ((currentTime - lastSelectTime) % totalWeight);
        lastSelectTimeMap.put(key, currentTime);
        
        int current = 0;
        for (SupplierProfile supplier : suppliers) {
            current += getSupplierWeight(supplier.getSupplierId());
            if (current > currentWeight) {
                return supplier;
            }
        }
        
        // 如果没有找到，返回第一个供应商
        return suppliers.get(0);
    }
    
    private int getSupplierWeight(String supplierId) {
        // 从配置中获取供应商权重
        return configurationService.getSupplierWeight(supplierId);
    }
}
```

关键实现要点：
- **权重考虑**：根据供应商权重分配请求
- **动态调整**：支持权重的动态调整
- **公平分配**：确保权重高的供应商获得更多请求

#### 最少连接算法

```java
// 示例：最少连接负载均衡算法
@Component
public class LeastConnectionsLoadBalancer {
    
    private final Map<String, AtomicInteger> connectionCountMap = new ConcurrentHashMap<>();
    
    public SupplierProfile selectSupplier(List<SupplierProfile> suppliers, String key) {
        if (suppliers == null || suppliers.isEmpty()) {
            return null;
        }
        
        if (suppliers.size() == 1) {
            return suppliers.get(0);
        }
        
        return suppliers.stream()
            .min(Comparator.comparingInt(this::getConnectionCount))
            .orElse(suppliers.get(0));
    }
    
    public void incrementConnection(String supplierId) {
        connectionCountMap.computeIfAbsent(supplierId, k -> new AtomicInteger(0))
            .incrementAndGet();
    }
    
    public void decrementConnection(String supplierId) {
        AtomicInteger count = connectionCountMap.get(supplierId);
        if (count != null) {
            count.decrementAndGet();
        }
    }
    
    private int getConnectionCount(SupplierProfile supplier) {
        AtomicInteger count = connectionCountMap.get(supplier.getSupplierId());
        return count != null ? count.get() : 0;
    }
}
```

关键实现要点：
- **连接跟踪**：实时跟踪各供应商的连接数
- **动态选择**：选择连接数最少的供应商
- **计数管理**：管理连接数的增减

### 负载均衡策略管理

```java
// 示例：负载均衡策略管理
@Service
public class LoadBalancingStrategyManager {
    
    @Autowired
    private RoundRobinLoadBalancer roundRobinLoadBalancer;
    
    @Autowired
    private WeightedRoundRobinLoadBalancer weightedRoundRobinLoadBalancer;
    
    @Autowired
    private LeastConnectionsLoadBalancer leastConnectionsLoadBalancer;
    
    // 根据策略选择供应商
    public SupplierProfile selectSupplier(List<SupplierProfile> suppliers, 
                                        String businessType, 
                                        String channelType,
                                        String key) {
        if (suppliers == null || suppliers.isEmpty()) {
            return null;
        }
        
        // 获取分组策略
        SupplierGroup group = supplierGroupService.getSupplierGroup(businessType, channelType);
        if (group == null) {
            // 使用默认策略
            return roundRobinLoadBalancer.selectSupplier(suppliers, key);
        }
        
        LoadBalancingStrategy strategy = group.getStrategy().getLoadBalancing();
        switch (strategy) {
            case ROUND_ROBIN:
                return roundRobinLoadBalancer.selectSupplier(suppliers, key);
            case WEIGHTED_ROUND_ROBIN:
                return weightedRoundRobinLoadBalancer.selectSupplier(suppliers, key);
            case LEAST_CONNECTIONS:
                return leastConnectionsLoadBalancer.selectSupplier(suppliers, key);
            case COST_BASED:
                return selectCostBasedSupplier(suppliers, key);
            case RANDOM:
            default:
                return selectRandomSupplier(suppliers, key);
        }
    }
    
    // 基于成本的选择
    private SupplierProfile selectCostBasedSupplier(List<SupplierProfile> suppliers, String key) {
        return suppliers.stream()
            .min(Comparator.comparing(this::calculateSupplierCost))
            .orElse(suppliers.get(0));
    }
    
    // 随机选择
    private SupplierProfile selectRandomSupplier(List<SupplierProfile> suppliers, String key) {
        Random random = new Random();
        int index = random.nextInt(suppliers.size());
        return suppliers.get(index);
    }
    
    // 计算供应商成本
    private BigDecimal calculateSupplierCost(SupplierProfile supplier) {
        CostConfiguration costConfig = supplier.getCostConfig();
        if (costConfig != null && costConfig.getPerMessagePrice() != null) {
            return costConfig.getPerMessagePrice();
        }
        return BigDecimal.ZERO;
    }
}
```

关键管理要点：
- **策略选择**：根据配置选择合适的负载均衡策略
- **算法封装**：封装各种负载均衡算法
- **动态调整**：支持策略的动态调整
- **性能优化**：优化算法执行性能

## 自动故障切换机制

自动故障切换是保障服务连续性的关键机制：

### 健康检查机制

#### 主动健康检查

```java
// 示例：主动健康检查实现
@Component
public class ActiveHealthChecker {
    
    @Autowired
    private SupplierAdapterManager supplierAdapterManager;
    
    @Autowired
    private SupplierHealthRepository supplierHealthRepository;
    
    @Scheduled(fixedRate = 30000) // 每30秒执行一次
    public void performHealthChecks() {
        List<SupplierProfile> activeSuppliers = supplierConfigurationService.getActiveSuppliers();
        
        for (SupplierProfile supplier : activeSuppliers) {
            try {
                boolean isHealthy = checkSupplierHealth(supplier);
                updateSupplierHealthStatus(supplier.getSupplierId(), isHealthy);
                
                if (!isHealthy) {
                    log.warn("供应商健康检查失败: supplierId={}", supplier.getSupplierId());
                    // 触发告警
                    triggerHealthAlert(supplier);
                }
            } catch (Exception e) {
                log.error("供应商健康检查异常: supplierId={}", supplier.getSupplierId(), e);
                updateSupplierHealthStatus(supplier.getSupplierId(), false);
            }
        }
    }
    
    private boolean checkSupplierHealth(SupplierProfile supplier) {
        try {
            // 获取供应商适配器
            NotificationChannel channel = supplierAdapterManager.getChannel(supplier.getSupplierId());
            if (channel == null) {
                return false;
            }
            
            // 执行健康检查
            HealthCheckResult result = channel.healthCheck();
            return result.isHealthy();
        } catch (Exception e) {
            log.error("供应商健康检查失败: supplierId={}", supplier.getSupplierId(), e);
            return false;
        }
    }
    
    private void updateSupplierHealthStatus(String supplierId, boolean isHealthy) {
        SupplierHealth health = supplierHealthRepository.findBySupplierId(supplierId);
        if (health == null) {
            health = new SupplierHealth();
            health.setSupplierId(supplierId);
        }
        
        health.setHealthy(isHealthy);
        health.setLastCheckTime(LocalDateTime.now());
        health.setCheckCount(health.getCheckCount() + 1);
        
        if (!isHealthy) {
            health.setFailureCount(health.getFailureCount() + 1);
        } else {
            health.setSuccessiveFailureCount(0);
        }
        
        supplierHealthRepository.save(health);
    }
    
    private void triggerHealthAlert(SupplierProfile supplier) {
        Alert alert = Alert.builder()
            .type(AlertType.SUPPLIER_HEALTH)
            .level(AlertLevel.WARNING)
            .title("供应商健康检查失败")
            .content(String.format("供应商 %s 健康检查失败", supplier.getSupplierName()))
            .timestamp(System.currentTimeMillis())
            .relatedData(Map.of("supplierId", supplier.getSupplierId()))
            .build();
            
        alertService.sendAlert(alert);
    }
}
```

关键检查要点：
- **定期检查**：定期执行健康检查任务
- **多维度检查**：从多个维度检查供应商健康
- **状态更新**：及时更新供应商健康状态
- **告警机制**：发现问题及时告警

#### 被动健康检查

```java
// 示例：被动健康检查实现
@Component
public class PassiveHealthChecker {
    
    @Autowired
    private SupplierHealthRepository supplierHealthRepository;
    
    // 记录发送结果，用于健康评估
    public void recordSendResult(String supplierId, SendResult result) {
        SupplierHealth health = supplierHealthRepository.findBySupplierId(supplierId);
        if (health == null) {
            health = new SupplierHealth();
            health.setSupplierId(supplierId);
        }
        
        health.setTotalRequests(health.getTotalRequests() + 1);
        health.setLastRequestTime(LocalDateTime.now());
        
        if (result.getStatus() == SendStatus.SUCCESS) {
            health.setSuccessfulRequests(health.getSuccessfulRequests() + 1);
            health.setSuccessiveFailureCount(0);
        } else {
            health.setFailedRequests(health.getFailedRequests() + 1);
            health.setSuccessiveFailureCount(health.getSuccessiveFailureCount() + 1);
            
            // 记录失败原因
            recordFailureReason(supplierId, result.getErrorCode(), result.getErrorMessage());
        }
        
        // 计算成功率
        if (health.getTotalRequests() > 0) {
            double successRate = (double) health.getSuccessfulRequests() / health.getTotalRequests();
            health.setSuccessRate(successRate);
        }
        
        supplierHealthRepository.save(health);
        
        // 检查是否需要触发故障切换
        checkAndTriggerFailover(supplierId, health);
    }
    
    private void checkAndTriggerFailover(String supplierId, SupplierHealth health) {
        // 检查连续失败次数
        if (health.getSuccessiveFailureCount() >= getFailureThreshold(supplierId)) {
            log.warn("供应商连续失败次数超过阈值，触发故障切换: supplierId={}, failures={}", 
                    supplierId, health.getSuccessiveFailureCount());
            
            // 触发故障切换
            failoverService.triggerFailover(supplierId);
        }
        
        // 检查成功率
        if (health.getSuccessRate() < getMinSuccessRate(supplierId)) {
            log.warn("供应商成功率低于阈值，触发故障切换: supplierId={}, successRate={}", 
                    supplierId, health.getSuccessRate());
            
            // 触发故障切换
            failoverService.triggerFailover(supplierId);
        }
    }
    
    private int getFailureThreshold(String supplierId) {
        // 从配置中获取失败阈值
        return configurationService.getFailureThreshold(supplierId);
    }
    
    private double getMinSuccessRate(String supplierId) {
        // 从配置中获取最小成功率阈值
        return configurationService.getMinSuccessRate(supplierId);
    }
    
    private void recordFailureReason(String supplierId, String errorCode, String errorMessage) {
        FailureRecord record = new FailureRecord();
        record.setSupplierId(supplierId);
        record.setErrorCode(errorCode);
        record.setErrorMessage(errorMessage);
        record.setTimestamp(LocalDateTime.now());
        
        failureRecordRepository.save(record);
    }
}
```

关键实现要点：
- **实时监控**：实时监控发送结果
- **统计分析**：统计成功率和失败率
- **阈值判断**：基于阈值判断是否需要切换
- **自动触发**：自动触发故障切换机制

### 故障切换策略

#### 立即切换策略

```java
// 示例：立即切换策略实现
@Component
public class ImmediateFailoverStrategy implements FailoverStrategy {
    
    @Autowired
    private SupplierGroupService supplierGroupService;
    
    @Autowired
    private LoadBalancingStrategyManager loadBalancingStrategyManager;
    
    @Override
    public SupplierProfile selectFailoverSupplier(String failedSupplierId, 
                                                String businessType, 
                                                String channelType) {
        // 获取同组的其他供应商
        List<SupplierProfile> availableSuppliers = 
            supplierGroupService.getAvailableSuppliers(businessType, channelType);
            
        // 移除失败的供应商
        availableSuppliers = availableSuppliers.stream()
            .filter(supplier -> !supplier.getSupplierId().equals(failedSupplierId))
            .collect(Collectors.toList());
            
        if (availableSuppliers.isEmpty()) {
            return null;
        }
        
        // 使用负载均衡策略选择备用供应商
        return loadBalancingStrategyManager.selectSupplier(
            availableSuppliers, businessType, channelType, "failover");
    }
}
```

关键策略要点：
- **快速响应**：检测到故障立即切换
- **负载均衡**：使用负载均衡策略选择备用供应商
- **无延迟**：切换过程无延迟

#### 延迟切换策略

```java
// 示例：延迟切换策略实现
@Component
public class DelayedFailoverStrategy implements FailoverStrategy {
    
    private final Map<String, Long> failoverDelayMap = new ConcurrentHashMap<>();
    
    @Override
    public SupplierProfile selectFailoverSupplier(String failedSupplierId, 
                                                String businessType, 
                                                String channelType) {
        Long failoverTime = failoverDelayMap.get(failedSupplierId);
        long currentTime = System.currentTimeMillis();
        
        // 检查是否已过延迟时间
        if (failoverTime != null && currentTime < failoverTime) {
            // 未到切换时间，继续使用原供应商
            SupplierProfile failedSupplier = supplierConfigurationService.getSupplierProfile(failedSupplierId);
            if (failedSupplier != null && isSupplierTemporarilyAvailable(failedSupplierId)) {
                return failedSupplier;
            }
        }
        
        // 到达切换时间或原供应商不可用，选择备用供应商
        return selectBackupSupplier(failedSupplierId, businessType, channelType);
    }
    
    public void scheduleFailover(String supplierId, long delayMs) {
        long failoverTime = System.currentTimeMillis() + delayMs;
        failoverDelayMap.put(supplierId, failoverTime);
        
        log.info("供应商故障切换已调度: supplierId={}, failoverTime={}", supplierId, new Date(failoverTime));
    }
    
    private boolean isSupplierTemporarilyAvailable(String supplierId) {
        // 检查供应商是否临时可用（可能正在恢复中）
        SupplierHealth health = supplierHealthRepository.findBySupplierId(supplierId);
        return health != null && health.isTemporarilyAvailable();
    }
    
    private SupplierProfile selectBackupSupplier(String failedSupplierId, 
                                               String businessType, 
                                               String channelType) {
        // 实现备用供应商选择逻辑
        List<SupplierProfile> availableSuppliers = 
            supplierGroupService.getAvailableSuppliers(businessType, channelType);
            
        availableSuppliers = availableSuppliers.stream()
            .filter(supplier -> !supplier.getSupplierId().equals(failedSupplierId))
            .collect(Collectors.toList());
            
        if (availableSuppliers.isEmpty()) {
            return null;
        }
        
        return loadBalancingStrategyManager.selectSupplier(
            availableSuppliers, businessType, channelType, "failover");
    }
}
```

关键策略要点：
- **延迟执行**：设置延迟切换时间
- **临时恢复**：支持供应商临时恢复
- **平滑切换**：避免频繁切换

#### 基于阈值的切换策略

```java
// 示例：基于阈值的切换策略实现
@Component
public class ThresholdBasedFailoverStrategy implements FailoverStrategy {
    
    @Override
    public SupplierProfile selectFailoverSupplier(String failedSupplierId, 
                                                String businessType, 
                                                String channelType) {
        SupplierHealth health = supplierHealthRepository.findBySupplierId(failedSupplierId);
        if (health == null) {
            return selectBackupSupplier(failedSupplierId, businessType, channelType);
        }
        
        // 检查各种阈值
        if (shouldFailoverBasedOnThresholds(health)) {
            return selectBackupSupplier(failedSupplierId, businessType, channelType);
        }
        
        // 不满足切换条件，继续使用原供应商
        return supplierConfigurationService.getSupplierProfile(failedSupplierId);
    }
    
    private boolean shouldFailoverBasedOnThresholds(SupplierHealth health) {
        // 连续失败次数阈值
        int consecutiveFailures = health.getSuccessiveFailureCount();
        int failureThreshold = configurationService.getFailureThreshold(health.getSupplierId());
        if (consecutiveFailures >= failureThreshold) {
            return true;
        }
        
        // 成功率阈值
        double successRate = health.getSuccessRate();
        double minSuccessRate = configurationService.getMinSuccessRate(health.getSupplierId());
        if (successRate < minSuccessRate) {
            return true;
        }
        
        // 响应时间阈值
        long avgResponseTime = health.getAverageResponseTime();
        long maxResponseTime = configurationService.getMaxResponseTime(health.getSupplierId());
        if (avgResponseTime > maxResponseTime) {
            return true;
        }
        
        // 错误率阈值
        double errorRate = health.getErrorRate();
        double maxErrorRate = configurationService.getMaxErrorRate(health.getSupplierId());
        if (errorRate > maxErrorRate) {
            return true;
        }
        
        return false;
    }
}
```

关键策略要点：
- **多维度判断**：基于多个维度判断是否切换
- **灵活配置**：支持阈值的灵活配置
- **智能决策**：根据实际情况智能决策

## 供应商管理最佳实践

在实施供应商管理时，应遵循以下最佳实践：

### 配置管理

#### 动态配置

关键管理要点：
- **配置中心**：使用配置中心管理供应商配置
- **动态更新**：支持配置的动态更新和生效
- **版本控制**：配置变更的版本管理和回滚
- **灰度发布**：支持配置的灰度发布

#### 安全存储

关键安全要点：
- **加密存储**：敏感信息的加密存储
- **访问控制**：严格的配置访问权限控制
- **审计日志**：完整的配置变更审计日志
- **备份恢复**：配置的备份和恢复机制

### 监控告警

#### 实时监控

关键监控指标：
- **健康状态**：供应商的实时健康状态
- **性能指标**：响应时间、成功率等性能指标
- **成本统计**：各供应商的成本使用统计
- **容量监控**：供应商的容量使用情况

#### 智能告警

关键告警策略：
- **多级告警**：支持不同级别的告警
- **阈值设置**：合理的告警阈值配置
- **通知方式**：多种告警通知方式
- **自动处理**：部分告警的自动处理机制

### 故障处理

#### 快速恢复

关键恢复策略：
- **故障诊断**：快速诊断故障原因
- **自动恢复**：支持故障的自动恢复
- **手动干预**：必要的手动干预手段
- **恢复验证**：故障恢复后的验证机制

#### 经验总结

关键总结要点：
- **故障复盘**：定期进行故障复盘分析
- **改进措施**：根据故障经验制定改进措施
- **知识库建设**：建立故障处理知识库
- **培训教育**：相关人员的培训和教育

## 结语

供应商管理是统一通知通道平台实现高可用性、成本优化和风险分散的关键环节。通过有效的多供应商配置、负载均衡和自动故障切换机制，我们可以构建一个稳定、可靠且具有成本效益的通知服务平台。

在实际应用中，我们需要根据业务特点和技术环境，合理设计和实现供应商管理机制。供应商管理不仅仅是技术实现，更是平台运营和风险管理的重要组成部分。

通过持续的优化和完善，我们的供应商管理机制将能够更好地支撑统一通知平台的发展，为企业数字化转型提供强有力的技术支撑。优秀的供应商管理体现了我们对平台稳定性和业务连续性的责任感，也是技术团队专业能力的重要体现。

统一通知平台的成功不仅取决于功能的完整性，更取决于供应商管理等核心机制的优秀实现。通过坚持最佳实践和持续优化，我们可以构建出真正优秀的统一通知平台，为用户提供卓越的服务体验。