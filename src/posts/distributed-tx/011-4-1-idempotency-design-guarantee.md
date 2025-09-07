---
title: 幂等性设计与保证：构建可靠的分布式系统基石
date: 2025-09-01
categories: [DisTx]
tags: [dis-tx]
published: true
---

# 幂等性设计与保证：构建可靠的分布式系统基石

在分布式系统中，由于网络的不确定性、超时重试机制以及系统故障恢复等原因，同一个操作可能会被多次执行。如果没有适当的防护措施，这种重复执行可能会导致数据不一致、业务逻辑错误等问题。幂等性设计正是解决这一问题的关键技术，它确保同一个操作无论执行多少次，都会产生相同的结果。本章将深入探讨幂等性设计的必要性、实现方法以及在分布式事务中的应用。

## 幂等性操作的必要性

### 幂等性的定义

幂等性（Idempotence）是数学和计算机科学中的一个概念，指的是一个操作或函数可以被多次执行，但结果保持不变。在分布式系统中，幂等性意味着客户端发起的多次相同请求，服务端应该返回相同的结果，且不会对系统状态产生额外的影响。

### 为什么需要幂等性

在分布式系统中，以下场景可能导致重复请求：

1. **网络问题**：网络延迟或中断导致客户端未收到响应，从而重试请求
2. **超时重试**：客户端设置超时机制，在超时后自动重试请求
3. **用户重复操作**：用户误操作或 impatiently 重复点击按钮
4. **系统故障恢复**：系统故障后恢复时可能重复处理某些请求
5. **消息队列重试**：消息队列在处理失败时自动重试消息

### 幂等性的重要性

#### 数据一致性保障

没有幂等性保障的系统可能会出现以下问题：

```java
// 没有幂等性保障的转账操作
public void transfer(String fromAccount, String toAccount, BigDecimal amount) {
    // 1. 从源账户扣款
    accountService.debit(fromAccount, amount);
    
    // 2. 向目标账户入账
    accountService.credit(toAccount, amount);
    
    // 3. 记录转账日志
    transferLogService.record(fromAccount, toAccount, amount);
}

// 如果这个方法被重复调用，会出现以下问题：
// - 源账户被多次扣款
// - 目标账户被多次入账
// - 转账日志被重复记录
```

#### 用户体验优化

幂等性设计可以提升用户体验：

```java
// 有幂等性保障的支付操作
@PostMapping("/payment")
public ResponseEntity<PaymentResult> processPayment(@RequestBody PaymentRequest request) {
    // 检查支付是否已处理
    if (paymentService.isPaymentProcessed(request.getPaymentId())) {
        return ResponseEntity.ok(new PaymentResult(true, "支付已处理"));
    }
    
    // 处理支付
    PaymentResult result = paymentService.processPayment(request);
    return ResponseEntity.ok(result);
}
```

### 幂等性与事务的关系

幂等性与分布式事务密切相关，但它们解决的问题不同：

- **分布式事务**：保证多个操作的原子性，要么全部成功，要么全部失败
- **幂等性**：保证单个操作的可重复执行性，多次执行结果一致

在实际应用中，两者往往需要结合使用：

```java
@Service
public class OrderService {
    
    @GlobalTransactional
    @Idempotent(key = "#request.orderId")
    public Order createOrder(CreateOrderRequest request) {
        // 1. 检查订单是否已创建（幂等性检查）
        if (orderRepository.existsByOrderId(request.getOrderId())) {
            return orderRepository.findByOrderId(request.getOrderId());
        }
        
        // 2. 创建订单（事务性操作）
        Order order = new Order();
        order.setOrderId(request.getOrderId());
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setStatus(OrderStatus.CREATED);
        
        return orderRepository.save(order);
    }
}
```

## Token、唯一键、幂等表设计

### 基于Token的幂等性设计

Token机制是最常用的幂等性实现方式之一，通过为每个请求生成唯一的Token来标识请求。

#### Token生成策略

```java
@Component
public class TokenGenerator {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 生成幂等Token
     */
    public String generateToken(String businessType, String businessId) {
        String token = UUID.randomUUID().toString();
        String key = "idempotent:token:" + businessType + ":" + businessId;
        
        // 将Token存储到Redis，设置过期时间
        redisTemplate.opsForValue().set(key, token, 300, TimeUnit.SECONDS);
        
        return token;
    }
    
    /**
     * 验证Token有效性
     */
    public boolean validateToken(String businessType, String businessId, String token) {
        String key = "idempotent:token:" + businessType + ":" + businessId;
        String storedToken = (String) redisTemplate.opsForValue().get(key);
        
        if (storedToken == null) {
            return false; // Token不存在或已过期
        }
        
        if (!storedToken.equals(token)) {
            return false; // Token不匹配
        }
        
        // 删除已使用的Token
        redisTemplate.delete(key);
        return true;
    }
}
```

#### Token使用示例

```java
@RestController
public class PaymentController {
    
    @Autowired
    private TokenGenerator tokenGenerator;
    
    @Autowired
    private PaymentService paymentService;
    
    /**
     * 获取支付Token
     */
    @GetMapping("/payment/token")
    public ResponseEntity<String> getPaymentToken(@RequestParam String orderId) {
        String token = tokenGenerator.generateToken("payment", orderId);
        return ResponseEntity.ok(token);
    }
    
    /**
     * 处理支付请求
     */
    @PostMapping("/payment")
    public ResponseEntity<PaymentResult> processPayment(
            @RequestHeader("Idempotent-Token") String token,
            @RequestBody PaymentRequest request) {
        
        // 验证Token
        if (!tokenGenerator.validateToken("payment", request.getOrderId(), token)) {
            return ResponseEntity.status(400).body(new PaymentResult(false, "无效的Token"));
        }
        
        try {
            PaymentResult result = paymentService.processPayment(request);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(new PaymentResult(false, e.getMessage()));
        }
    }
}
```

### 基于唯一键的幂等性设计

利用数据库的唯一约束来实现幂等性是一种简单有效的方法。

#### 数据库表设计

```sql
-- 支付记录表，通过唯一约束实现幂等性
CREATE TABLE payment_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id VARCHAR(64) NOT NULL UNIQUE COMMENT '请求ID',
    order_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_order_id (order_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 业务代码实现

```java
@Service
public class PaymentService {
    
    @Autowired
    private PaymentRecordRepository paymentRecordRepository;
    
    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        try {
            // 1. 创建支付记录（利用唯一约束实现幂等性）
            PaymentRecord record = new PaymentRecord();
            record.setRequestId(request.getRequestId());
            record.setOrderId(request.getOrderId());
            record.setUserId(request.getUserId());
            record.setAmount(request.getAmount());
            record.setStatus(PaymentStatus.PENDING);
            
            paymentRecordRepository.save(record);
            
            // 2. 调用第三方支付接口
            ThirdPartyPaymentResult thirdPartyResult = thirdPartyPaymentService.pay(request);
            
            // 3. 更新支付状态
            record.setStatus(thirdPartyResult.isSuccess() ? 
                PaymentStatus.SUCCESS : PaymentStatus.FAILED);
            record.setThirdPartyId(thirdPartyResult.getTransactionId());
            paymentRecordRepository.save(record);
            
            return new PaymentResult(thirdPartyResult.isSuccess(), 
                                   thirdPartyResult.getMessage(), 
                                   record.getId());
                                   
        } catch (DataIntegrityViolationException e) {
            // 违反唯一约束，说明请求已处理
            PaymentRecord existingRecord = paymentRecordRepository
                .findByRequestId(request.getRequestId());
            
            return new PaymentResult(true, "支付已处理", existingRecord.getId());
        }
    }
}
```

### 幂等表设计

对于复杂的业务场景，可以设计专门的幂等表来管理幂等性。

#### 幂等表结构设计

```sql
-- 幂等记录表
CREATE TABLE idempotent_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    business_type VARCHAR(50) NOT NULL COMMENT '业务类型',
    business_id VARCHAR(100) NOT NULL COMMENT '业务标识',
    request_hash VARCHAR(64) NOT NULL COMMENT '请求内容哈希',
    request_content TEXT COMMENT '请求内容',
    response_content TEXT COMMENT '响应内容',
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
    expire_time TIMESTAMP NOT NULL COMMENT '过期时间',
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_business (business_type, business_id),
    INDEX idx_expire_time (expire_time),
    INDEX idx_created_time (created_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 幂等表使用实现

```java
@Service
public class IdempotentService {
    
    @Autowired
    private IdempotentRecordRepository idempotentRecordRepository;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    /**
     * 执行幂等操作
     */
    public <T, R> R executeIdempotent(String businessType, String businessId, 
                                     T request, Function<T, R> operation) {
        try {
            // 1. 检查是否已处理
            IdempotentRecord record = idempotentRecordRepository
                .findByBusinessTypeAndBusinessId(businessType, businessId);
            
            if (record != null && record.getExpireTime().after(new Date())) {
                // 已处理且未过期，直接返回结果
                return objectMapper.readValue(record.getResponseContent(), 
                                            (Class<R>) operation.getClass());
            }
            
            // 2. 执行业务操作
            R result = operation.apply(request);
            
            // 3. 记录处理结果
            if (record == null) {
                record = new IdempotentRecord();
                record.setBusinessType(businessType);
                record.setBusinessId(businessId);
            }
            
            record.setRequestHash(DigestUtils.md5Hex(objectMapper.writeValueAsString(request)));
            record.setRequestContent(objectMapper.writeValueAsString(request));
            record.setResponseContent(objectMapper.writeValueAsString(result));
            record.setStatus(IdempotentStatus.PROCESSED);
            record.setExpireTime(new Date(System.currentTimeMillis() + 30 * 60 * 1000)); // 30分钟过期
            
            idempotentRecordRepository.save(record);
            
            return result;
            
        } catch (DataIntegrityViolationException e) {
            // 并发处理，重新查询结果
            IdempotentRecord record = idempotentRecordRepository
                .findByBusinessTypeAndBusinessId(businessType, businessId);
            
            if (record != null) {
                try {
                    return objectMapper.readValue(record.getResponseContent(), 
                                                (Class<R>) operation.getClass());
                } catch (Exception ex) {
                    throw new IdempotentException("Failed to deserialize response", ex);
                }
            }
            
            throw new IdempotentException("Failed to process idempotent operation", e);
        } catch (Exception e) {
            throw new IdempotentException("Failed to process idempotent operation", e);
        }
    }
}
```

#### 幂等操作使用示例

```java
@Service
public class OrderService {
    
    @Autowired
    private IdempotentService idempotentService;
    
    public Order createOrder(CreateOrderRequest request) {
        return idempotentService.executeIdempotent(
            "order", 
            request.getOrderId(),
            request,
            this::doCreateOrder
        );
    }
    
    private Order doCreateOrder(CreateOrderRequest request) {
        // 实际的创建订单逻辑
        Order order = new Order();
        order.setOrderId(request.getOrderId());
        order.setUserId(request.getUserId());
        order.setProductId(request.getProductId());
        order.setQuantity(request.getQuantity());
        order.setStatus(OrderStatus.CREATED);
        
        return orderRepository.save(order);
    }
}
```

## 分布式锁与防重策略

### 分布式锁实现幂等性

分布式锁是实现幂等性的另一种重要手段，通过加锁来确保同一时间只有一个请求在处理。

#### 基于Redis的分布式锁

```java
@Component
public class DistributedLock {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 获取分布式锁
     */
    public boolean lock(String lockKey, String requestId, long expireTime) {
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                       "return redis.call('del', KEYS[1]) " +
                       "else return 0 end";
        
        Boolean result = redisTemplate.opsForValue()
            .setIfAbsent(lockKey, requestId, expireTime, TimeUnit.SECONDS);
        
        return result != null && result;
    }
    
    /**
     * 释放分布式锁
     */
    public boolean unlock(String lockKey, String requestId) {
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                       "return redis.call('del', KEYS[1]) " +
                       "else return 0 end";
        
        Long result = (Long) redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(lockKey),
            requestId
        );
        
        return result != null && result > 0;
    }
}
```

#### 分布式锁使用示例

```java
@Service
public class OrderService {
    
    @Autowired
    private DistributedLock distributedLock;
    
    public Order createOrder(CreateOrderRequest request) {
        String lockKey = "order:create:" + request.getOrderId();
        String requestId = UUID.randomUUID().toString();
        
        try {
            // 获取分布式锁
            if (!distributedLock.lock(lockKey, requestId, 30)) {
                throw new OrderProcessingException("订单正在处理中，请稍后重试");
            }
            
            // 检查订单是否已创建
            if (orderRepository.existsByOrderId(request.getOrderId())) {
                return orderRepository.findByOrderId(request.getOrderId());
            }
            
            // 创建订单
            Order order = new Order();
            order.setOrderId(request.getOrderId());
            order.setUserId(request.getUserId());
            order.setProductId(request.getProductId());
            order.setQuantity(request.getQuantity());
            order.setStatus(OrderStatus.CREATED);
            
            return orderRepository.save(order);
            
        } finally {
            // 释放分布式锁
            distributedLock.unlock(lockKey, requestId);
        }
    }
}
```

### 防重策略设计

除了分布式锁，还可以通过其他防重策略来实现幂等性。

#### 基于状态机的防重

```java
@Service
public class PaymentService {
    
    /**
     * 支付状态机
     */
    public enum PaymentState {
        PENDING,    // 待支付
        PROCESSING, // 处理中
        SUCCESS,    // 支付成功
        FAILED,     // 支付失败
        CANCELLED   // 已取消
    }
    
    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        // 1. 查询支付记录
        PaymentRecord record = paymentRecordRepository
            .findByPaymentId(request.getPaymentId());
        
        if (record == null) {
            // 创建新的支付记录
            record = new PaymentRecord();
            record.setPaymentId(request.getPaymentId());
            record.setOrderId(request.getOrderId());
            record.setAmount(request.getAmount());
            record.setState(PaymentState.PENDING);
            record = paymentRecordRepository.save(record);
        }
        
        // 2. 根据当前状态决定处理逻辑
        switch (record.getState()) {
            case SUCCESS:
                return new PaymentResult(true, "支付已成功", record.getPaymentId());
                
            case FAILED:
            case CANCELLED:
                // 重新发起支付
                return doProcessPayment(record, request);
                
            case PROCESSING:
                throw new PaymentProcessingException("支付正在处理中，请稍后查询结果");
                
            case PENDING:
                // 开始处理支付
                record.setState(PaymentState.PROCESSING);
                paymentRecordRepository.save(record);
                return doProcessPayment(record, request);
                
            default:
                throw new IllegalStateException("未知的支付状态: " + record.getState());
        }
    }
    
    private PaymentResult doProcessPayment(PaymentRecord record, PaymentRequest request) {
        try {
            // 调用第三方支付接口
            ThirdPartyPaymentResult result = thirdPartyPaymentService.pay(request);
            
            // 更新支付状态
            if (result.isSuccess()) {
                record.setState(PaymentState.SUCCESS);
                record.setThirdPartyId(result.getTransactionId());
            } else {
                record.setState(PaymentState.FAILED);
                record.setErrorMessage(result.getMessage());
            }
            
            paymentRecordRepository.save(record);
            
            return new PaymentResult(result.isSuccess(), result.getMessage(), record.getPaymentId());
            
        } catch (Exception e) {
            // 处理异常，将状态回退到PENDING，允许重试
            record.setState(PaymentState.PENDING);
            record.setErrorMessage(e.getMessage());
            paymentRecordRepository.save(record);
            
            throw new PaymentProcessingException("支付处理失败", e);
        }
    }
}
```

#### 基于时间窗口的防重

```java
@Component
public class TimeWindowDuplicateChecker {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 检查是否在时间窗口内重复
     */
    public boolean isDuplicate(String key, long timeWindowSeconds) {
        String redisKey = "duplicate_check:" + key;
        Long currentTime = System.currentTimeMillis();
        
        // 获取上次操作时间
        String lastTimeStr = (String) redisTemplate.opsForValue().get(redisKey);
        
        if (lastTimeStr != null) {
            Long lastTime = Long.parseLong(lastTimeStr);
            if (currentTime - lastTime < timeWindowSeconds * 1000) {
                // 在时间窗口内，认为是重复操作
                return true;
            }
        }
        
        // 更新操作时间
        redisTemplate.opsForValue().set(redisKey, String.valueOf(currentTime), 
                                       timeWindowSeconds, TimeUnit.SECONDS);
        
        return false;
    }
}

@Service
public class SmsService {
    
    @Autowired
    private TimeWindowDuplicateChecker duplicateChecker;
    
    public void sendSms(String phoneNumber, String message) {
        // 检查是否在60秒内重复发送
        if (duplicateChecker.isDuplicate("sms:" + phoneNumber, 60)) {
            throw new SmsSendException("短信发送过于频繁，请稍后再试");
        }
        
        // 发送短信
        smsSender.send(phoneNumber, message);
    }
}
```

## 幂等性实现的最佳实践

### 1. 统一幂等性框架

构建统一的幂等性框架可以简化开发工作：

```java
@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Idempotent {
    
    /**
     * 幂等键表达式
     */
    String key() default "";
    
    /**
     * 过期时间（秒）
     */
    int expireTime() default 300;
    
    /**
     * 是否抛出异常
     */
    boolean throwException() default true;
}

@Aspect
@Component
public class IdempotentAspect {
    
    @Autowired
    private IdempotentService idempotentService;
    
    @Around("@annotation(idempotent)")
    public Object handleIdempotent(ProceedingJoinPoint joinPoint, Idempotent idempotent) throws Throwable {
        // 解析幂等键
        String key = parseKey(idempotent.key(), joinPoint);
        
        // 执行幂等操作
        return idempotentService.executeIdempotent(
            key, 
            idempotent.expireTime(), 
            () -> {
                try {
                    return joinPoint.proceed();
                } catch (Throwable throwable) {
                    if (throwable instanceof RuntimeException) {
                        throw (RuntimeException) throwable;
                    } else {
                        throw new RuntimeException(throwable);
                    }
                }
            }
        );
    }
    
    private String parseKey(String keyExpression, ProceedingJoinPoint joinPoint) {
        // 解析SpEL表达式
        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();
        
        // 设置方法参数
        Object[] args = joinPoint.getArgs();
        String[] paramNames = getParameterNames(joinPoint);
        for (int i = 0; i < args.length; i++) {
            context.setVariable(paramNames[i], args[i]);
        }
        
        return parser.parseExpression(keyExpression).getValue(context, String.class);
    }
    
    private String[] getParameterNames(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        return signature.getParameterNames();
    }
}
```

### 2. 多层幂等性保障

在系统不同层次实现幂等性保障：

```java
@RestController
public class OrderController {
    
    @Autowired
    private OrderService orderService;
    
    /**
     * API层幂等性：基于Token
     */
    @PostMapping("/order")
    public ResponseEntity<Order> createOrder(
            @RequestHeader("Idempotent-Token") String token,
            @RequestBody CreateOrderRequest request) {
        
        // 验证Token
        if (!tokenService.validateToken("order", request.getOrderId(), token)) {
            return ResponseEntity.status(400).build();
        }
        
        Order order = orderService.createOrder(request);
        return ResponseEntity.ok(order);
    }
}

@Service
public class OrderService {
    
    /**
     * 服务层幂等性：基于数据库唯一约束
     */
    @Idempotent(key = "#request.orderId")
    public Order createOrder(CreateOrderRequest request) {
        try {
            Order order = new Order();
            order.setOrderId(request.getOrderId());
            order.setUserId(request.getUserId());
            order.setProductId(request.getProductId());
            order.setQuantity(request.getQuantity());
            order.setStatus(OrderStatus.CREATED);
            
            return orderRepository.save(order);
        } catch (DataIntegrityViolationException e) {
            // 违反唯一约束，返回已创建的订单
            return orderRepository.findByOrderId(request.getOrderId());
        }
    }
}
```

### 3. 监控与告警

建立完善的幂等性监控体系：

```java
@Component
public class IdempotentMonitor {
    
    private final MeterRegistry meterRegistry;
    
    public void recordIdempotentHit(String businessType) {
        Counter.builder("idempotent.hit")
            .tag("business_type", businessType)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordIdempotentMiss(String businessType) {
        Counter.builder("idempotent.miss")
            .tag("business_type", businessType)
            .register(meterRegistry)
            .increment();
    }
    
    @EventListener
    public void handleIdempotentViolation(IdempotentViolationEvent event) {
        alertService.sendAlert("Idempotent violation detected: " + event.getMessage());
    }
}
```

### 4. 测试用例设计

为幂等性设计完善的测试用例：

```java
@SpringBootTest
public class IdempotentTest {
    
    @Autowired
    private OrderService orderService;
    
    @Test
    public void testIdempotentCreateOrder() {
        // 准备测试数据
        CreateOrderRequest request = new CreateOrderRequest();
        request.setOrderId("TEST_ORDER_001");
        request.setUserId("USER_001");
        request.setProductId("PRODUCT_001");
        request.setQuantity(2);
        
        // 第一次调用
        Order firstOrder = orderService.createOrder(request);
        assertNotNull(firstOrder);
        assertEquals("TEST_ORDER_001", firstOrder.getOrderId());
        
        // 第二次调用（幂等性测试）
        Order secondOrder = orderService.createOrder(request);
        assertNotNull(secondOrder);
        assertEquals(firstOrder.getId(), secondOrder.getId());
        assertEquals(firstOrder.getOrderId(), secondOrder.getOrderId());
        
        // 验证只创建了一个订单
        List<Order> orders = orderRepository.findByOrderId("TEST_ORDER_001");
        assertEquals(1, orders.size());
    }
}
```

## 总结

幂等性设计是构建可靠的分布式系统的重要基石。通过合理的幂等性实现，我们可以有效防止重复操作导致的数据不一致问题，提升系统的稳定性和用户体验。

在实际应用中，我们需要：

1. **理解幂等性的必要性**：认识到在分布式环境中重复请求的普遍性
2. **选择合适的实现方式**：根据业务场景选择Token、唯一键或分布式锁等方式
3. **构建统一框架**：通过AOP等方式构建统一的幂等性框架
4. **实施多层保障**：在API层、服务层等多个层次实施幂等性保障
5. **完善监控告警**：建立完善的监控体系，及时发现和处理问题

幂等性设计虽然会增加一定的系统复杂度，但其带来的稳定性和可靠性收益是值得的。在分布式事务系统中，幂等性与事务机制相辅相成，共同保障了系统的数据一致性。

在后续章节中，我们将继续探讨分布式事务的监控与追踪、性能优化等重要话题，帮助你构建更加完善的分布式事务体系。