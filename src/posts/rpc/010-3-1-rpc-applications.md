---
title: RPC 的应用场景
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在现代软件架构中，RPC（Remote Procedure Call）作为一种重要的分布式通信技术，已经广泛应用于各种场景。理解 RPC 的应用场景不仅有助于我们更好地选择和使用 RPC 技术，还能帮助我们在系统设计时做出更合理的架构决策。本章将深入探讨 RPC 在不同场景下的应用，分析其适用性和优势。

## 分布式系统中的位置

### 微服务架构的核心组件

在微服务架构中，RPC 扮演着至关重要的角色。微服务将大型单体应用拆分为多个小型、独立的服务，这些服务需要通过网络进行通信。RPC 作为服务间通信的主要方式，具有以下优势：

1. **透明性**：隐藏了网络通信的复杂性，使远程调用看起来像本地调用
2. **性能**：相比 REST API，RPC 通常具有更好的性能表现
3. **类型安全**：通过接口定义提供强类型支持
4. **服务治理**：现代 RPC 框架提供了丰富的服务治理功能

```java
// 微服务架构中的 RPC 调用示例
@Service
public class OrderService {
    // 注入用户服务的 RPC 客户端
    @RpcReference
    private UserService userService;
    
    // 注入库存服务的 RPC 客户端
    @RpcReference
    private InventoryService inventoryService;
    
    // 注入支付服务的 RPC 客户端
    @RpcReference
    private PaymentService paymentService;
    
    public Order createOrder(CreateOrderRequest request) {
        // 验证用户
        User user = userService.getUserById(request.getUserId());
        if (user == null) {
            throw new BusinessException("User not found");
        }
        
        // 检查库存
        boolean hasStock = inventoryService.checkStock(request.getProductId(), request.getQuantity());
        if (!hasStock) {
            throw new BusinessException("Insufficient stock");
        }
        
        // 创建订单
        Order order = new Order();
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setStatus(OrderStatus.CREATED);
        // 保存订单...
        
        // 扣减库存
        inventoryService.reduceStock(request.getProductId(), request.getQuantity());
        
        // 处理支付
        PaymentResult paymentResult = paymentService.processPayment(
            PaymentRequest.builder()
                .orderId(order.getId())
                .amount(order.getAmount())
                .paymentMethod(request.getPaymentMethod())
                .build()
        );
        
        // 更新订单状态
        if (paymentResult.isSuccess()) {
            order.setStatus(OrderStatus.PAID);
        } else {
            order.setStatus(OrderStatus.PAYMENT_FAILED);
        }
        
        return order;
    }
}
```

### 服务网格中的通信协议

随着 Service Mesh 技术的发展，RPC 在服务网格中也发挥着重要作用。Sidecar 代理通常拦截服务间的 RPC 调用，实现流量管理、安全控制、可观测性等功能：

```yaml
# Istio 中的 RPC 流量管理示例
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: user-service
spec:
  hosts:
  - user-service
  http:
  - route:
    - destination:
        host: user-service
        subset: v1
      weight: 90
    - destination:
        host: user-service
        subset: v2
      weight: 10
```

## 电商系统中的应用

### 商品服务

在电商系统中，商品服务负责管理商品信息、价格、库存等核心数据：

```java
// 商品服务接口
public interface ProductService {
    Product getProductById(String productId);
    List<Product> getProductsByCategory(String category);
    List<Product> searchProducts(String keyword);
    void updateProductStock(String productId, int quantity);
    void updateProductPrice(String productId, BigDecimal newPrice);
}

// 商品服务实现
@Service
@RpcService
public class ProductServiceImpl implements ProductService {
    @Autowired
    private ProductRepository productRepository;
    
    @Override
    public Product getProductById(String productId) {
        return productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException("Product not found: " + productId));
    }
    
    @Override
    public List<Product> getProductsByCategory(String category) {
        return productRepository.findByCategory(category);
    }
    
    @Override
    public List<Product> searchProducts(String keyword) {
        return productRepository.findByNameContaining(keyword);
    }
    
    @Override
    @Transactional
    public void updateProductStock(String productId, int quantity) {
        Product product = getProductById(productId);
        product.setStock(product.getStock() + quantity);
        productRepository.save(product);
    }
    
    @Override
    @Transactional
    public void updateProductPrice(String productId, BigDecimal newPrice) {
        Product product = getProductById(productId);
        product.setPrice(newPrice);
        productRepository.save(product);
    }
}
```

### 订单服务

订单服务负责处理订单创建、状态管理、订单查询等业务逻辑：

```java
// 订单服务接口
public interface OrderService {
    Order createOrder(CreateOrderRequest request);
    Order getOrderById(String orderId);
    List<Order> getOrdersByUserId(String userId);
    void updateOrderStatus(String orderId, OrderStatus status);
    List<Order> getOrdersByStatus(OrderStatus status);
}

// 订单服务实现
@Service
@RpcService
public class OrderServiceImpl implements OrderService {
    @Autowired
    private OrderRepository orderRepository;
    
    @Autowired
    private SequenceGenerator sequenceGenerator;
    
    @Override
    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        // 生成订单号
        String orderNo = sequenceGenerator.generateOrderNo();
        
        // 创建订单
        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setAmount(request.getAmount());
        order.setStatus(OrderStatus.CREATED);
        order.setCreateTime(new Date());
        
        return orderRepository.save(order);
    }
    
    @Override
    public Order getOrderById(String orderId) {
        return orderRepository.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException("Order not found: " + orderId));
    }
    
    @Override
    public List<Order> getOrdersByUserId(String userId) {
        return orderRepository.findByUserId(userId);
    }
    
    @Override
    @Transactional
    public void updateOrderStatus(String orderId, OrderStatus status) {
        Order order = getOrderById(orderId);
        order.setStatus(status);
        order.setUpdateTime(new Date());
        orderRepository.save(order);
    }
    
    @Override
    public List<Order> getOrdersByStatus(OrderStatus status) {
        return orderRepository.findByStatus(status);
    }
}
```

### 支付服务

支付服务负责处理各种支付方式的支付请求：

```java
// 支付服务接口
public interface PaymentService {
    PaymentResult processPayment(PaymentRequest request);
    PaymentResult refund(RefundRequest request);
    PaymentStatus queryPaymentStatus(String paymentId);
    List<PaymentRecord> getPaymentRecords(String orderId);
}

// 支付服务实现
@Service
@RpcService
public class PaymentServiceImpl implements PaymentService {
    @Autowired
    private PaymentGateway paymentGateway;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Override
    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        try {
            // 调用支付网关
            PaymentGatewayResult gatewayResult = paymentGateway.processPayment(
                request.getPaymentMethod(),
                request.getAmount(),
                request.getOrderNo()
            );
            
            // 保存支付记录
            PaymentRecord record = new PaymentRecord();
            record.setOrderNo(request.getOrderNo());
            record.setAmount(request.getAmount());
            record.setPaymentMethod(request.getPaymentMethod());
            record.setPaymentId(gatewayResult.getPaymentId());
            record.setStatus(gatewayResult.isSuccess() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED);
            record.setCreateTime(new Date());
            paymentRepository.save(record);
            
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
    @Transactional
    public PaymentResult refund(RefundRequest request) {
        // 实现退款逻辑
        // ...
        return PaymentResult.builder().success(true).build();
    }
    
    @Override
    public PaymentStatus queryPaymentStatus(String paymentId) {
        PaymentRecord record = paymentRepository.findByPaymentId(paymentId);
        return record != null ? record.getStatus() : PaymentStatus.NOT_FOUND;
    }
    
    @Override
    public List<PaymentRecord> getPaymentRecords(String orderId) {
        return paymentRepository.findByOrderNo(orderId);
    }
}
```

## 金融系统中的应用

### 交易服务

在金融系统中，交易服务负责处理各种金融交易，对性能和可靠性要求极高：

```java
// 交易服务接口
public interface TradeService {
    TradeResult executeTrade(TradeRequest request);
    TradeStatus queryTradeStatus(String tradeId);
    List<TradeRecord> getTradeHistory(String accountId, Date startTime, Date endTime);
    BigDecimal getAccountBalance(String accountId);
}

// 交易服务实现
@Service
@RpcService
public class TradeServiceImpl implements TradeService {
    @Autowired
    private TradeRepository tradeRepository;
    
    @Autowired
    private AccountService accountService;
    
    @Override
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public TradeResult executeTrade(TradeRequest request) {
        try {
            // 验证账户余额
            BigDecimal accountBalance = accountService.getAccountBalance(request.getAccountId());
            if (accountBalance.compareTo(request.getAmount()) < 0) {
                return TradeResult.builder()
                    .success(false)
                    .message("Insufficient balance")
                    .build();
            }
            
            // 执行交易
            TradeRecord tradeRecord = new TradeRecord();
            tradeRecord.setTradeId(UUID.randomUUID().toString());
            tradeRecord.setAccountId(request.getAccountId());
            tradeRecord.setAmount(request.getAmount());
            tradeRecord.setTradeType(request.getTradeType());
            tradeRecord.setStatus(TradeStatus.PROCESSING);
            tradeRecord.setCreateTime(new Date());
            
            tradeRepository.save(tradeRecord);
            
            // 更新账户余额
            accountService.updateAccountBalance(request.getAccountId(), request.getAmount().negate());
            
            // 更新交易状态
            tradeRecord.setStatus(TradeStatus.SUCCESS);
            tradeRecord.setUpdateTime(new Date());
            tradeRepository.save(tradeRecord);
            
            return TradeResult.builder()
                .success(true)
                .tradeId(tradeRecord.getTradeId())
                .message("Trade executed successfully")
                .build();
        } catch (Exception e) {
            log.error("Trade execution failed", e);
            return TradeResult.builder()
                .success(false)
                .message("Trade execution failed: " + e.getMessage())
                .build();
        }
    }
    
    @Override
    public TradeStatus queryTradeStatus(String tradeId) {
        TradeRecord record = tradeRepository.findByTradeId(tradeId);
        return record != null ? record.getStatus() : TradeStatus.NOT_FOUND;
    }
    
    @Override
    public List<TradeRecord> getTradeHistory(String accountId, Date startTime, Date endTime) {
        return tradeRepository.findByAccountIdAndCreateTimeBetween(accountId, startTime, endTime);
    }
    
    @Override
    public BigDecimal getAccountBalance(String accountId) {
        // 调用账户服务获取余额
        return accountService.getAccountBalance(accountId);
    }
}
```

### 风控服务

风控服务负责实时监控和评估交易风险：

```java
// 风控服务接口
public interface RiskControlService {
    RiskAssessment assessRisk(TradeRequest request);
    boolean isHighRiskTransaction(TradeRequest request);
    void reportSuspiciousActivity(SuspiciousActivity activity);
    List<RiskRule> getActiveRiskRules();
}

// 风控服务实现
@Service
@RpcService
public class RiskControlServiceImpl implements RiskControlService {
    @Autowired
    private RiskRuleRepository riskRuleRepository;
    
    @Autowired
    private SuspiciousActivityRepository suspiciousActivityRepository;
    
    @Override
    public RiskAssessment assessRisk(TradeRequest request) {
        RiskAssessment assessment = new RiskAssessment();
        assessment.setTradeId(request.getTradeId());
        assessment.setAccountId(request.getAccountId());
        
        // 获取活跃的风险规则
        List<RiskRule> activeRules = getActiveRiskRules();
        
        int riskScore = 0;
        List<String> triggeredRules = new ArrayList<>();
        
        for (RiskRule rule : activeRules) {
            if (rule.matches(request)) {
                riskScore += rule.getRiskScore();
                triggeredRules.add(rule.getRuleName());
            }
        }
        
        assessment.setRiskScore(riskScore);
        assessment.setTriggeredRules(triggeredRules);
        assessment.setRiskLevel(determineRiskLevel(riskScore));
        
        return assessment;
    }
    
    @Override
    public boolean isHighRiskTransaction(TradeRequest request) {
        RiskAssessment assessment = assessRisk(request);
        return assessment.getRiskLevel() == RiskLevel.HIGH;
    }
    
    @Override
    public void reportSuspiciousActivity(SuspiciousActivity activity) {
        suspiciousActivityRepository.save(activity);
        // 发送告警通知
        sendAlertNotification(activity);
    }
    
    @Override
    public List<RiskRule> getActiveRiskRules() {
        return riskRuleRepository.findByStatus(RuleStatus.ACTIVE);
    }
    
    private RiskLevel determineRiskLevel(int riskScore) {
        if (riskScore >= 80) {
            return RiskLevel.HIGH;
        } else if (riskScore >= 50) {
            return RiskLevel.MEDIUM;
        } else {
            return RiskLevel.LOW;
        }
    }
    
    private void sendAlertNotification(SuspiciousActivity activity) {
        // 实现告警通知逻辑
        // 可以通过邮件、短信、即时通讯等方式发送告警
    }
}
```

## 日志系统中的应用

### 日志收集服务

在分布式系统中，日志收集服务负责收集、处理和存储各个服务的日志：

```java
// 日志服务接口
public interface LogService {
    void collectLog(LogEntry logEntry);
    List<LogEntry> queryLogs(LogQueryRequest request);
    LogStatistics getLogStatistics(String serviceId, Date startTime, Date endTime);
    void archiveLogs(Date beforeDate);
}

// 日志服务实现
@Service
@RpcService
public class LogServiceImpl implements LogService {
    @Autowired
    private LogRepository logRepository;
    
    @Autowired
    private LogArchiveService logArchiveService;
    
    @Override
    public void collectLog(LogEntry logEntry) {
        // 异步处理日志收集，避免阻塞业务线程
        CompletableFuture.runAsync(() -> {
            try {
                // 添加时间戳和唯一ID
                logEntry.setTimestamp(System.currentTimeMillis());
                logEntry.setId(UUID.randomUUID().toString());
                
                // 保存到数据库
                logRepository.save(logEntry);
                
                // 发送到消息队列用于实时分析
                sendToMessageQueue(logEntry);
            } catch (Exception e) {
                log.error("Failed to collect log", e);
            }
        });
    }
    
    @Override
    public List<LogEntry> queryLogs(LogQueryRequest request) {
        // 构建查询条件
        LogQuery query = LogQuery.builder()
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
        
        return statistics;
    }
    
    @Override
    @Transactional
    public void archiveLogs(Date beforeDate) {
        // 归档历史日志
        logArchiveService.archiveLogs(beforeDate);
        
        // 删除已归档的日志
        logRepository.deleteByTimestampBefore(beforeDate.getTime());
    }
    
    private void sendToMessageQueue(LogEntry logEntry) {
        // 实现发送到消息队列的逻辑
        // 例如使用 Kafka、RabbitMQ 等
    }
}
```

## 推荐系统中的应用

### 用户画像服务

推荐系统中的用户画像服务负责构建和维护用户画像：

```java
// 用户画像服务接口
public interface UserProfileService {
    UserProfile getUserProfile(String userId);
    void updateUserProfile(UserProfileUpdateRequest request);
    List<UserBehavior> getUserBehaviors(String userId, int limit);
    void recordUserBehavior(UserBehavior behavior);
    List<UserTag> getUserTags(String userId);
}

// 用户画像服务实现
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
    
    private void updateUserProfileBasedOnBehavior(UserBehavior behavior) {
        // 根据用户行为更新用户画像
        // 例如：更新兴趣标签、活跃度等
    }
}
```

### 推荐算法服务

推荐算法服务负责执行各种推荐算法：

```java
// 推荐服务接口
public interface RecommendationService {
    List<RecommendationItem> getRecommendations(RecommendationRequest request);
    List<RecommendationItem> getRealTimeRecommendations(RealTimeRecommendationRequest request);
    void feedbackRecommendation(RecommendationFeedback feedback);
    List<RecommendationAlgorithm> getAvailableAlgorithms();
}

// 推荐服务实现
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
    
    @Override
    public List<RecommendationItem> getRecommendations(RecommendationRequest request) {
        // 根据请求选择合适的推荐算法
        RecommendationAlgorithm algorithm = selectAlgorithm(request.getAlgorithm());
        
        // 获取用户画像
        UserProfile userProfile = getUserProfile(request.getUserId());
        
        // 执行推荐算法
        List<RecommendationItem> recommendations = algorithm.recommend(userProfile, request.getParameters());
        
        // 过滤已推荐过的商品
        filterAlreadyRecommendedItems(recommendations, request.getUserId());
        
        // 添加推荐理由
        addRecommendationReasons(recommendations, algorithm.getAlgorithmName());
        
        return recommendations;
    }
    
    @Override
    public List<RecommendationItem> getRealTimeRecommendations(RealTimeRecommendationRequest request) {
        // 实时推荐通常使用轻量级算法
        RealTimeRecommendationAlgorithm algorithm = new RealTimeRecommendationAlgorithm();
        return algorithm.recommend(request.getUserId(), request.getContext());
    }
    
    @Override
    public void feedbackRecommendation(RecommendationFeedback feedback) {
        // 保存推荐反馈
        feedbackRepository.save(feedback);
        
        // 更新推荐模型
        updateRecommendationModel(feedback);
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
        switch (algorithmName.toLowerCase()) {
            case "collaborative":
                return collaborativeFilteringAlgorithm;
            case "content":
                return contentBasedAlgorithm;
            case "deep":
                return deepLearningAlgorithm;
            default:
                return collaborativeFilteringAlgorithm; // 默认使用协同过滤
        }
    }
    
    private UserProfile getUserProfile(String userId) {
        // 调用用户画像服务获取用户画像
        // 这里简化处理
        return new UserProfile();
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
    
    private void updateRecommendationModel(RecommendationFeedback feedback) {
        // 根据用户反馈更新推荐模型
        // 实现略
    }
}
```

## 什么时候适合用 RPC

### 适用场景

RPC 特别适合以下场景：

1. **微服务架构**：服务间需要高性能、低延迟的通信
2. **内部系统通信**：同构技术栈的系统间通信
3. **高并发场景**：对性能要求极高的系统
4. **强类型接口**：需要明确定义接口规范的场景
5. **复杂业务逻辑**：需要传递复杂对象的场景

### 不适用场景

以下场景可能不适合使用 RPC：

1. **对外 API**：需要跨平台兼容性的对外服务
2. **简单查询**：简单的数据查询场景
3. **异步处理**：不需要立即响应的异步处理场景
4. **大数据传输**：需要传输大量数据的场景
5. **防火墙限制**：网络环境复杂，难以穿透防火墙的场景

## 与 MQ 和 REST 的对比

### RPC vs MQ

| 特性 | RPC | MQ |
|------|-----|-----|
| 通信模式 | 同步/异步 | 异步 |
| 实时性 | 高 | 低到中 |
| 可靠性 | 高 | 高 |
| 复杂性 | 中等 | 高 |
| 适用场景 | 实时服务调用 | 异步消息处理 |

### RPC vs REST

| 特性 | RPC | REST |
|------|-----|------|
| 协议 | 多种 | HTTP |
| 数据格式 | 多种 | 主要是 JSON/XML |
| 性能 | 高 | 中等 |
| 易用性 | 中等 | 高 |
| 兼容性 | 中等 | 高 |
| 适用场景 | 内部服务通信 | 对外 API |

## 最佳实践

### 1. 接口设计原则

```java
// 良好的 RPC 接口设计
public interface UserService {
    // 方法命名清晰明确
    User getUserById(String userId);
    
    // 参数封装，避免参数过多
    List<User> searchUsers(UserSearchRequest request);
    
    // 返回结果统一
    ServiceResult<User> createUser(CreateUserRequest request);
    
    // 异常处理明确
    void updateUser(UpdateUserRequest request) throws UserNotFoundException, ValidationException;
}
```

### 2. 版本管理

```java
// 接口版本管理
public interface UserServiceV1 {
    User getUserById(String userId);
}

public interface UserServiceV2 {
    UserDetail getUserDetailById(String userId);
    List<User> searchUsers(UserSearchRequest request);
}
```

### 3. 性能优化

```java
// 批量操作提高性能
public interface UserService {
    // 批量获取用户信息
    List<User> getUsersByIds(List<String> userIds);
    
    // 批量更新用户状态
    ServiceResult<Void> batchUpdateUserStatus(List<UserStatusUpdateRequest> requests);
}
```

## 总结

RPC 作为一种重要的分布式通信技术，在现代软件架构中发挥着关键作用。从微服务架构到金融系统，从电商系统到推荐系统，RPC 都有着广泛的应用场景。

理解 RPC 的应用场景有助于我们在系统设计时做出更合理的架构决策。在选择 RPC 技术时，我们需要综合考虑性能要求、开发效率、维护成本、团队技能等多个因素。

通过本章的学习，我们应该能够：
1. 理解 RPC 在不同场景下的应用
2. 掌握电商、金融、日志、推荐等系统中 RPC 的使用方式
3. 了解 RPC 与其他通信方式的对比和选择原则
4. 掌握 RPC 应用的最佳实践

在后续章节中，我们将深入探讨如何从零实现一个 RPC 框架，以及主流 RPC 框架的使用方法，进一步加深对 RPC 技术的理解。