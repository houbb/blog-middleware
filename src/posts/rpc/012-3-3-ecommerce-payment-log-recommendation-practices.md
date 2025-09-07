---
title: 电商、支付、日志、推荐中的实践
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在现代互联网应用中，电商、支付、日志和推荐系统是四个核心业务领域，它们对系统的性能、可靠性、可扩展性都有着极高的要求。RPC（Remote Procedure Call）作为这些系统中服务间通信的重要技术，在实践中发挥着关键作用。本章将深入探讨 RPC 在这四个领域中的具体应用和最佳实践。

## 电商系统中的 RPC 实践

### 核心服务架构

电商系统通常包含多个核心服务，如用户服务、商品服务、订单服务、库存服务、购物车服务等。这些服务通过 RPC 进行通信：

```java
// 电商系统核心服务架构示例
@Configuration
public class EcommerceServiceConfiguration {
    // 用户服务
    @Bean
    @RpcService
    public UserService userService() {
        return new UserServiceImpl();
    }
    
    // 商品服务
    @Bean
    @RpcService
    public ProductService productService() {
        return new ProductServiceImpl();
    }
    
    // 订单服务
    @Bean
    @RpcService
    public OrderService orderService() {
        return new OrderServiceImpl();
    }
    
    // 库存服务
    @Bean
    @RpcService
    public InventoryService inventoryService() {
        return new InventoryServiceImpl();
    }
}

// 订单服务实现
@Service
@RpcService
public class OrderServiceImpl implements OrderService {
    @RpcReference
    private UserService userService;
    
    @RpcReference
    private ProductService productService;
    
    @RpcReference
    private InventoryService inventoryService;
    
    @RpcReference
    private PaymentService paymentService;
    
    @Override
    @Transactional
    public OrderResult createOrder(CreateOrderRequest request) {
        try {
            // 1. 验证用户
            User user = userService.getUserById(request.getUserId());
            if (user == null) {
                return OrderResult.failed("User not found");
            }
            
            // 2. 验证商品和库存
            Product product = productService.getProductById(request.getProductId());
            if (product == null) {
                return OrderResult.failed("Product not found");
            }
            
            InventoryCheckResult inventoryResult = 
                inventoryService.checkInventory(request.getProductId(), request.getQuantity());
            if (!inventoryResult.isAvailable()) {
                return OrderResult.failed("Insufficient inventory");
            }
            
            // 3. 创建订单
            Order order = buildOrder(request, user, product);
            order = orderRepository.save(order);
            
            // 4. 锁定库存
            inventoryService.lockInventory(request.getProductId(), request.getQuantity());
            
            // 5. 处理支付
            PaymentResult paymentResult = processPayment(order, request.getPaymentInfo());
            if (!paymentResult.isSuccess()) {
                // 支付失败，释放库存
                inventoryService.releaseInventory(request.getProductId(), request.getQuantity());
                return OrderResult.failed("Payment failed: " + paymentResult.getMessage());
            }
            
            // 6. 更新订单状态
            order.setStatus(OrderStatus.PAID);
            orderRepository.save(order);
            
            // 7. 扣减库存
            inventoryService.reduceInventory(request.getProductId(), request.getQuantity());
            
            return OrderResult.success(order.getId());
        } catch (Exception e) {
            log.error("Order creation failed", e);
            return OrderResult.failed("Order creation failed: " + e.getMessage());
        }
    }
    
    private Order buildOrder(CreateOrderRequest request, User user, Product product) {
        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setUnitPrice(product.getPrice());
        order.setTotalAmount(product.getPrice().multiply(BigDecimal.valueOf(request.getQuantity())));
        order.setStatus(OrderStatus.CREATED);
        order.setCreateTime(new Date());
        return order;
    }
    
    private PaymentResult processPayment(Order order, PaymentInfo paymentInfo) {
        PaymentRequest paymentRequest = PaymentRequest.builder()
            .orderId(order.getId())
            .amount(order.getTotalAmount())
            .paymentMethod(paymentInfo.getPaymentMethod())
            .cardInfo(paymentInfo.getCardInfo())
            .build();
        
        return paymentService.processPayment(paymentRequest);
    }
}
```

### 高并发场景优化

电商系统在促销活动期间面临高并发访问，需要通过多种手段优化 RPC 调用：

```java
// 高并发优化实践
@Service
@RpcService
public class OptimizedProductService implements ProductService {
    // 本地缓存
    private final Cache<String, Product> productCache = Caffeine.newBuilder()
        .maximumSize(10000)
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build();
    
    // 批量获取优化
    @Override
    public List<Product> getProductsByIds(List<String> productIds) {
        // 1. 先从缓存获取
        List<Product> cachedProducts = new ArrayList<>();
        List<String> missingIds = new ArrayList<>();
        
        for (String productId : productIds) {
            Product product = productCache.getIfPresent(productId);
            if (product != null) {
                cachedProducts.add(product);
            } else {
                missingIds.add(productId);
            }
        }
        
        // 2. 批量从数据库获取缺失的数据
        if (!missingIds.isEmpty()) {
            List<Product> dbProducts = productRepository.findByIds(missingIds);
            // 放入缓存
            for (Product product : dbProducts) {
                productCache.put(product.getId(), product);
            }
            cachedProducts.addAll(dbProducts);
        }
        
        return cachedProducts;
    }
    
    // 熔断器模式
    @CircuitBreaker(name = "productService", fallbackMethod = "getDefaultProduct")
    @Override
    public Product getProductById(String productId) {
        return productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException("Product not found: " + productId));
    }
    
    // 熔断降级方法
    public Product getDefaultProduct(String productId, Exception ex) {
        log.warn("Product service is unavailable, returning default product for: " + productId);
        return Product.builder()
            .id(productId)
            .name("Product Temporarily Unavailable")
            .price(BigDecimal.ZERO)
            .status(ProductStatus.UNAVAILABLE)
            .build();
    }
}
```

## 支付系统中的 RPC 实践

### 支付网关集成

支付系统需要与多个第三方支付网关集成，RPC 在其中起到关键作用：

```java
// 支付服务架构
@Service
@RpcService
public class PaymentServiceImpl implements PaymentService {
    @Autowired
    private List<PaymentGateway> paymentGateways;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private RiskControlService riskControlService;
    
    @Override
    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        try {
            // 1. 风险控制检查
            RiskAssessment riskAssessment = riskControlService.assessRisk(
                RiskAssessmentRequest.builder()
                    .userId(request.getUserId())
                    .amount(request.getAmount())
                    .paymentMethod(request.getPaymentMethod())
                    .build()
            );
            
            if (riskAssessment.getRiskLevel() == RiskLevel.HIGH) {
                return PaymentResult.builder()
                    .success(false)
                    .message("Transaction blocked due to high risk")
                    .build();
            }
            
            // 2. 选择合适的支付网关
            PaymentGateway gateway = selectPaymentGateway(request.getPaymentMethod());
            if (gateway == null) {
                return PaymentResult.builder()
                    .success(false)
                    .message("Unsupported payment method: " + request.getPaymentMethod())
                    .build();
            }
            
            // 3. 调用支付网关
            PaymentGatewayResult gatewayResult = gateway.processPayment(
                request.getAmount(),
                request.getOrderNo(),
                request.getCardInfo()
            );
            
            // 4. 记录支付结果
            PaymentRecord paymentRecord = buildPaymentRecord(request, gatewayResult);
            paymentRepository.save(paymentRecord);
            
            // 5. 发送支付通知
            sendPaymentNotification(request.getUserId(), paymentRecord);
            
            return PaymentResult.builder()
                .success(gatewayResult.isSuccess())
                .paymentId(gatewayResult.getPaymentId())
                .message(gatewayResult.getMessage())
                .build();
        } catch (Exception e) {
            log.error("Payment processing failed", e);
            return PaymentResult.builder()
                .success(false)
                .message("Payment processing failed: " + e.getMessage())
                .build();
        }
    }
    
    @Override
    public RefundResult refund(RefundRequest request) {
        try {
            // 1. 验证支付记录
            PaymentRecord paymentRecord = paymentRepository.findByPaymentId(request.getPaymentId());
            if (paymentRecord == null) {
                return RefundResult.builder()
                    .success(false)
                    .message("Payment record not found")
                    .build();
            }
            
            // 2. 选择对应的支付网关
            PaymentGateway gateway = getPaymentGatewayByRecord(paymentRecord);
            
            // 3. 调用支付网关退款
            RefundGatewayResult gatewayResult = gateway.refund(
                request.getPaymentId(),
                request.getAmount()
            );
            
            // 4. 更新退款状态
            if (gatewayResult.isSuccess()) {
                paymentRecord.setRefundStatus(RefundStatus.SUCCESS);
                paymentRecord.setRefundTime(new Date());
                paymentRepository.save(paymentRecord);
            }
            
            return RefundResult.builder()
                .success(gatewayResult.isSuccess())
                .refundId(gatewayResult.getRefundId())
                .message(gatewayResult.getMessage())
                .build();
        } catch (Exception e) {
            log.error("Refund processing failed", e);
            return RefundResult.builder()
                .success(false)
                .message("Refund processing failed: " + e.getMessage())
                .build();
        }
    }
    
    private PaymentGateway selectPaymentGateway(PaymentMethod paymentMethod) {
        return paymentGateways.stream()
            .filter(gateway -> gateway.supports(paymentMethod))
            .findFirst()
            .orElse(null);
    }
    
    private PaymentRecord buildPaymentRecord(PaymentRequest request, PaymentGatewayResult result) {
        PaymentRecord record = new PaymentRecord();
        record.setPaymentId(result.getPaymentId());
        record.setUserId(request.getUserId());
        record.setOrderNo(request.getOrderNo());
        record.setAmount(request.getAmount());
        record.setPaymentMethod(request.getPaymentMethod());
        record.setStatus(result.isSuccess() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
        record.setCreateTime(new Date());
        return record;
    }
    
    private void sendPaymentNotification(String userId, PaymentRecord paymentRecord) {
        // 异步发送支付通知
        notificationService.sendPaymentNotification(userId, paymentRecord);
    }
}
```

### 支付对账系统

支付对账系统需要与多个支付渠道进行数据核对：

```java
// 支付对账服务
@Service
@RpcService
public class PaymentReconciliationService {
    @RpcReference
    private PaymentService paymentService;
    
    @RpcReference
    private ThirdPartyPaymentService alipayService;
    
    @RpcReference
    private ThirdPartyPaymentService wechatPayService;
    
    public ReconciliationResult reconcilePayments(Date date) {
        try {
            // 1. 获取本地支付记录
            List<PaymentRecord> localPayments = paymentService.getPaymentsByDate(date);
            
            // 2. 获取支付宝支付记录
            List<ThirdPartyPaymentRecord> alipayPayments = alipayService.getPaymentsByDate(date);
            
            // 3. 获取微信支付记录
            List<ThirdPartyPaymentRecord> wechatPayments = wechatPayService.getPaymentsByDate(date);
            
            // 4. 进行对账
            ReconciliationResult result = performReconciliation(localPayments, alipayPayments, wechatPayments);
            
            // 5. 记录对账结果
            saveReconciliationResult(result);
            
            return result;
        } catch (Exception e) {
            log.error("Payment reconciliation failed", e);
            return ReconciliationResult.builder()
                .success(false)
                .message("Reconciliation failed: " + e.getMessage())
                .build();
        }
    }
    
    private ReconciliationResult performReconciliation(
            List<PaymentRecord> localPayments,
            List<ThirdPartyPaymentRecord> alipayPayments,
            List<ThirdPartyPaymentRecord> wechatPayments) {
        
        ReconciliationResult result = new ReconciliationResult();
        result.setReconciliationDate(new Date());
        
        // 对账逻辑实现
        // ...
        
        return result;
    }
}
```

## 日志系统中的 RPC 实践

### 分布式日志收集

在分布式系统中，日志收集是一个重要需求，RPC 在其中发挥关键作用：

```java
// 日志收集服务
@Service
@RpcService
public class LogCollectionService implements LogService {
    @Autowired
    private LogRepository logRepository;
    
    @Autowired
    private LogQueueProducer logQueueProducer;
    
    @Override
    public void collectLog(LogEntry logEntry) {
        // 异步处理日志收集
        CompletableFuture.runAsync(() -> {
            try {
                // 1. 添加元数据
                enrichLogEntry(logEntry);
                
                // 2. 保存到数据库
                logRepository.save(logEntry);
                
                // 3. 发送到消息队列用于实时分析
                logQueueProducer.sendLogEntry(logEntry);
                
                // 4. 发送到搜索引擎
                sendToSearchEngine(logEntry);
            } catch (Exception e) {
                log.error("Failed to collect log entry", e);
            }
        });
    }
    
    @Override
    public List<LogEntry> queryLogs(LogQueryRequest request) {
        // 构建查询条件
        LogQuery query = LogQueryBuilder.newBuilder()
            .serviceId(request.getServiceId())
            .level(request.getLevel())
            .startTime(request.getStartTime())
            .endTime(request.getEndTime())
            .keyword(request.getKeyword())
            .build();
        
        return logRepository.findByQuery(query, request.getPage(), request.getSize());
    }
    
    @Override
    public LogStatistics getLogStatistics(String serviceId, Date startTime, Date endTime) {
        LogStatistics statistics = new LogStatistics();
        
        // 统计各级别日志数量
        Map<LogLevel, Long> levelCounts = logRepository.countByLevel(serviceId, startTime, endTime);
        statistics.setLevelCounts(levelCounts);
        
        // 统计错误日志趋势
        List<DailyLogCount> dailyCounts = logRepository.getDailyCounts(serviceId, startTime, endTime);
        statistics.setDailyCounts(dailyCounts);
        
        // 统计响应时间分布
        Map<String, Long> responseTimeDistribution = 
            logRepository.getResponseTimeDistribution(serviceId, startTime, endTime);
        statistics.setResponseTimeDistribution(responseTimeDistribution);
        
        return statistics;
    }
    
    private void enrichLogEntry(LogEntry logEntry) {
        // 添加时间戳
        if (logEntry.getTimestamp() == 0) {
            logEntry.setTimestamp(System.currentTimeMillis());
        }
        
        // 添加唯一ID
        if (logEntry.getId() == null) {
            logEntry.setId(UUID.randomUUID().toString());
        }
        
        // 添加主机信息
        logEntry.setHost(getCurrentHost());
        
        // 添加线程信息
        logEntry.setThreadName(Thread.currentThread().getName());
    }
    
    private String getCurrentHost() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            return "unknown";
        }
    }
    
    private void sendToSearchEngine(LogEntry logEntry) {
        // 发送到 Elasticsearch 等搜索引擎
        // 实现略
    }
}
```

### 日志分析服务

日志分析服务负责对收集的日志进行实时分析：

```java
// 日志分析服务
@Service
@RpcService
public class LogAnalysisService {
    @RpcReference
    private LogService logService;
    
    @Autowired
    private AlertService alertService;
    
    @Autowired
    private MetricsService metricsService;
    
    public void analyzeLogsInRealTime() {
        // 实时日志分析逻辑
        // 通常通过消息队列接收日志条目
    }
    
    public AlertResult checkForAlerts(LogEntry logEntry) {
        // 检查是否需要触发告警
        if (logEntry.getLevel() == LogLevel.ERROR || logEntry.getLevel() == LogLevel.FATAL) {
            // 错误日志告警
            return checkErrorAlert(logEntry);
        } else if (logEntry.getMessage().contains("performance")) {
            // 性能相关告警
            return checkPerformanceAlert(logEntry);
        }
        
        return AlertResult.noAlert();
    }
    
    public MetricsResult collectMetrics(LogEntry logEntry) {
        MetricsResult result = new MetricsResult();
        
        // 收集各种指标
        if (logEntry.getLevel() == LogLevel.ERROR) {
            result.incrementErrorCount();
        }
        
        if (logEntry.getMessage().contains("response_time")) {
            // 提取响应时间指标
            long responseTime = extractResponseTime(logEntry.getMessage());
            result.addResponseTime(responseTime);
        }
        
        return result;
    }
    
    private AlertResult checkErrorAlert(LogEntry logEntry) {
        // 检查错误日志是否需要告警
        // 例如：同一服务在短时间内出现大量错误日志
        String serviceId = logEntry.getServiceId();
        Date recentTime = new Date(System.currentTimeMillis() - 5 * 60 * 1000); // 5分钟内
        
        long errorCount = logService.countLogs(LogQuery.builder()
            .serviceId(serviceId)
            .level(LogLevel.ERROR)
            .startTime(recentTime)
            .build());
        
        if (errorCount > 100) { // 超过100个错误日志
            return AlertResult.alert("High error rate detected in service: " + serviceId)
                .level(AlertLevel.CRITICAL)
                .details("Error count: " + errorCount + " in last 5 minutes");
        }
        
        return AlertResult.noAlert();
    }
    
    private long extractResponseTime(String message) {
        // 从日志消息中提取响应时间
        // 实现略
        return 0;
    }
}
```

## 推荐系统中的 RPC 实践

### 用户画像服务

推荐系统中的用户画像服务负责构建和维护用户画像：

```java
// 用户画像服务
@Service
@RpcService
public class UserProfileServiceImpl implements UserProfileService {
    @Autowired
    private UserProfileRepository userProfileRepository;
    
    @Autowired
    private UserBehaviorRepository userBehaviorRepository;
    
    @Autowired
    private UserTagRepository userTagRepository;
    
    @Override
    public UserProfile getUserProfile(String userId) {
        UserProfile profile = userProfileRepository.findByUserId(userId);
        if (profile == null) {
            // 创建默认用户画像
            profile = createDefaultUserProfile(userId);
        }
        return profile;
    }
    
    @Override
    @Transactional
    public void updateUserProfile(UserProfileUpdateRequest request) {
        UserProfile profile = userProfileRepository.findByUserId(request.getUserId());
        if (profile == null) {
            profile = new UserProfile();
            profile.setUserId(request.getUserId());
            profile.setCreateTime(new Date());
        }
        
        // 更新用户基本信息
        if (request.getBasicInfo() != null) {
            profile.setBasicInfo(request.getBasicInfo());
        }
        
        // 更新用户偏好
        if (request.getPreferences() != null) {
            profile.setPreferences(request.getPreferences());
        }
        
        // 更新用户标签
        if (request.getTags() != null) {
            updateUserTags(request.getUserId(), request.getTags());
        }
        
        profile.setUpdateTime(new Date());
        userProfileRepository.save(profile);
    }
    
    @Override
    public List<UserBehavior> getUserBehaviors(String userId, int limit) {
        return userBehaviorRepository.findLatestByUserId(userId, limit);
    }
    
    @Override
    public void recordUserBehavior(UserBehavior behavior) {
        // 异步记录用户行为
        CompletableFuture.runAsync(() -> {
            try {
                behavior.setId(UUID.randomUUID().toString());
                behavior.setTimestamp(System.currentTimeMillis());
                userBehaviorRepository.save(behavior);
                
                // 更新用户画像
                updateUserProfileBasedOnBehavior(behavior);
            } catch (Exception e) {
                log.error("Failed to record user behavior", e);
            }
        });
    }
    
    @Override
    public List<UserTag> getUserTags(String userId) {
        return userTagRepository.findByUserId(userId);
    }
    
    private UserProfile createDefaultUserProfile(String userId) {
        UserProfile profile = new UserProfile();
        profile.setUserId(userId);
        profile.setBasicInfo(new BasicInfo());
        profile.setPreferences(new UserPreferences());
        profile.setCreateTime(new Date());
        return userProfileRepository.save(profile);
    }
    
    private void updateUserTags(String userId, List<String> tags) {
        // 删除旧标签
        userTagRepository.deleteByUserId(userId);
        
        // 添加新标签
        List<UserTag> userTags = tags.stream()
            .map(tag -> UserTag.builder()
                .userId(userId)
                .tag(tag)
                .createTime(new Date())
                .build())
            .collect(Collectors.toList());
        
        userTagRepository.saveAll(userTags);
    }
    
    private void updateUserProfileBasedOnBehavior(UserBehavior behavior) {
        // 根据用户行为更新用户画像
        // 例如：更新兴趣标签、活跃度等
        // 实现略
    }
}
```

### 推荐算法服务

推荐算法服务负责执行各种推荐算法：

```java
// 推荐服务
@Service
@RpcService
public class RecommendationServiceImpl implements RecommendationService {
    @Autowired
    private CollaborativeFilteringAlgorithm collaborativeFilteringAlgorithm;
    
    @Autowired
    private ContentBasedAlgorithm contentBasedAlgorithm;
    
    @Autowired
    private DeepLearningAlgorithm deepLearningAlgorithm;
    
    @Autowired
    private RecommendationFeedbackRepository feedbackRepository;
    
    @Autowired
    private UserProfileService userProfileService;
    
    @Override
    public List<RecommendationItem> getRecommendations(RecommendationRequest request) {
        try {
            long startTime = System.currentTimeMillis();
            
            // 1. 根据请求选择合适的推荐算法
            RecommendationAlgorithm algorithm = selectAlgorithm(request.getAlgorithm());
            
            // 2. 获取用户画像
            UserProfile userProfile = userProfileService.getUserProfile(request.getUserId());
            
            // 3. 执行推荐算法
            List<RecommendationItem> recommendations = algorithm.recommend(userProfile, request.getParameters());
            
            // 4. 过滤已推荐过的商品
            filterAlreadyRecommendedItems(recommendations, request.getUserId());
            
            // 5. 添加推荐理由
            addRecommendationReasons(recommendations, algorithm.getAlgorithmName());
            
            // 6. 记录推荐日志
            recordRecommendationLog(request, recommendations, System.currentTimeMillis() - startTime);
            
            return recommendations;
        } catch (Exception e) {
            log.error("Recommendation generation failed", e);
            return Collections.emptyList();
        }
    }
    
    @Override
    public List<RecommendationItem> getRealTimeRecommendations(RealTimeRecommendationRequest request) {
        try {
            // 实时推荐通常使用轻量级算法
            RealTimeRecommendationAlgorithm algorithm = new RealTimeRecommendationAlgorithm();
            return algorithm.recommend(request.getUserId(), request.getContext());
        } catch (Exception e) {
            log.error("Real-time recommendation generation failed", e);
            return Collections.emptyList();
        }
    }
    
    @Override
    public void feedbackRecommendation(RecommendationFeedback feedback) {
        try {
            // 1. 保存推荐反馈
            feedbackRepository.save(feedback);
            
            // 2. 更新推荐模型
            updateRecommendationModel(feedback);
            
            // 3. 更新用户画像
            updateUserProfileBasedOnFeedback(feedback);
        } catch (Exception e) {
            log.error("Recommendation feedback processing failed", e);
        }
    }
    
    @Override
    public List<RecommendationAlgorithm> getAvailableAlgorithms() {
        List<RecommendationAlgorithm> algorithms = new ArrayList<>();
        algorithms.add(collaborativeFilteringAlgorithm);
        algorithms.add(contentBasedAlgorithm);
        algorithms.add(deepLearningAlgorithm);
        return algorithms;
    }
    
    private RecommendationAlgorithm selectAlgorithm(String algorithmName) {
        if (algorithmName == null || algorithmName.isEmpty()) {
            return collaborativeFilteringAlgorithm; // 默认使用协同过滤
        }
        
        switch (algorithmName.toLowerCase()) {
            case "collaborative":
                return collaborativeFilteringAlgorithm;
            case "content":
                return contentBasedAlgorithm;
            case "deep":
                return deepLearningAlgorithm;
            default:
                return collaborativeFilteringAlgorithm;
        }
    }
    
    private void filterAlreadyRecommendedItems(List<RecommendationItem> recommendations, String userId) {
        // 过滤已经推荐过的商品
        // 实现略
    }
    
    private void addRecommendationReasons(List<RecommendationItem> recommendations, String algorithmName) {
        // 为每个推荐项添加推荐理由
        for (RecommendationItem item : recommendations) {
            item.setReason("Recommended by " + algorithmName);
        }
    }
    
    private void recordRecommendationLog(RecommendationRequest request, 
                                      List<RecommendationItem> recommendations, 
                                      long processingTime) {
        RecommendationLog log = RecommendationLog.builder()
            .userId(request.getUserId())
            .algorithm(request.getAlgorithm())
            .itemCount(recommendations.size())
            .processingTime(processingTime)
            .timestamp(System.currentTimeMillis())
            .build();
        
        // 异步保存推荐日志
        CompletableFuture.runAsync(() -> {
            try {
                recommendationLogRepository.save(log);
            } catch (Exception e) {
                log.error("Failed to save recommendation log", e);
            }
        });
    }
    
    private void updateRecommendationModel(RecommendationFeedback feedback) {
        // 根据用户反馈更新推荐模型
        // 实现略
    }
    
    private void updateUserProfileBasedOnFeedback(RecommendationFeedback feedback) {
        // 根据反馈更新用户画像
        // 实现略
    }
}
```

## 最佳实践总结

### 1. 性能优化

```java
// 性能优化实践
@Service
@RpcService
public class OptimizedService {
    // 连接池管理
    private final RpcConnectionPool connectionPool = new RpcConnectionPool(50);
    
    // 本地缓存
    private final Cache<String, Object> localCache = Caffeine.newBuilder()
        .maximumSize(1000)
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build();
    
    // 批量操作
    public List<User> getUsersByIds(List<String> userIds) {
        // 批量获取优化
        return userRepository.findByIds(userIds);
    }
    
    // 异步处理
    public CompletableFuture<User> getUserAsync(String userId) {
        return CompletableFuture.supplyAsync(() -> getUserById(userId));
    }
}
```

### 2. 容错设计

```java
// 容错设计实践
@Service
@RpcService
public class FaultTolerantService {
    // 超时控制
    @Timeout(value = 5, unit = TimeUnit.SECONDS)
    public User getUserById(String userId) {
        return userRepository.findById(userId);
    }
    
    // 熔断器模式
    @CircuitBreaker(name = "userService", fallbackMethod = "getDefaultUser")
    public User getUserWithCircuitBreaker(String userId) {
        return userRepository.findById(userId);
    }
    
    // 降级方法
    public User getDefaultUser(String userId, Exception ex) {
        return User.builder()
            .id(userId)
            .name("Default User")
            .build();
    }
    
    // 重试机制
    @Retryable(value = {Exception.class}, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public PaymentResult processPayment(PaymentRequest request) {
        return paymentGateway.processPayment(request);
    }
}
```

### 3. 监控和追踪

```java
// 监控和追踪实践
@Service
@RpcService
public class MonitoredService {
    private final MeterRegistry meterRegistry;
    
    // 方法级监控
    @Timed(name = "user.service.get.user", description = "Get user by ID")
    public User getUserById(String userId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            User user = userRepository.findById(userId);
            sample.stop(Timer.builder("user.service.get.user.success").register(meterRegistry));
            return user;
        } catch (Exception e) {
            sample.stop(Timer.builder("user.service.get.user.error").register(meterRegistry));
            throw e;
        }
    }
    
    // 分布式追踪
    @NewSpan("get-user-by-id")
    public User getUserWithTracing(String userId) {
        Span span = tracer.currentSpan();
        span.tag("user.id", userId);
        
        try {
            return userRepository.findById(userId);
        } catch (Exception e) {
            span.tag("error", e.getMessage());
            throw e;
        }
    }
}
```

## 总结

RPC 在电商、支付、日志和推荐系统中都有着广泛而深入的应用。通过合理的架构设计、性能优化、容错机制和监控追踪，RPC 能够为这些核心业务系统提供稳定、高效的服务间通信能力。

在实际应用中，我们需要根据具体业务场景选择合适的 RPC 框架和实现方式，并遵循最佳实践来确保系统的可靠性、可扩展性和可维护性。

通过本章的学习，我们应该能够：
1. 理解 RPC 在电商、支付、日志和推荐系统中的具体应用
2. 掌握这些系统中 RPC 的实现方式和优化技巧
3. 了解相关领域的最佳实践和设计模式
4. 具备在实际项目中应用 RPC 技术的能力

在后续章节中，我们将深入探讨如何从零实现一个 RPC 框架，以及主流 RPC 框架的使用方法，进一步加深对 RPC 技术的理解。