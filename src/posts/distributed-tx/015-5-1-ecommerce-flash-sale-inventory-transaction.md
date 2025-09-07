---
title: 电商秒杀与库存事务案例：高并发场景下的分布式事务实践
date: 2025-09-01
categories: [DisTx]
tags: [dis-tx]
published: true
---

# 电商秒杀与库存事务案例：高并发场景下的分布式事务实践

在电商领域，秒杀活动是最具挑战性的场景之一。短时间内大量用户涌入，对系统的并发处理能力、数据一致性以及响应速度都提出了极高的要求。库存扣减作为秒杀场景的核心环节，其事务处理的正确性和性能直接影响着用户体验和业务收益。本章将深入分析电商秒杀场景的特点，探讨库存扣减事务设计的挑战，并通过实际案例展示如何在高并发环境下实现可靠的分布式事务处理。

## 库存扣减事务设计

### 秒杀场景的特点与挑战

电商秒杀活动具有以下显著特点：

1. **高并发性**：短时间内大量用户同时访问，请求量可能达到平时的数十倍甚至上百倍
2. **瞬时性**：活动时间通常较短，用户需要在限定时间内完成购买
3. **稀缺性**：商品数量有限，先到先得，容易引发抢购热潮
4. **一致性要求高**：库存数据必须准确，超卖或少卖都会造成业务损失

这些特点给库存扣减事务设计带来了巨大挑战：

```java
// 传统库存扣减方式存在的问题
public class TraditionalInventoryService {
    
    public boolean deductInventory(String productId, int quantity) {
        // 1. 查询库存
        int currentStock = inventoryRepository.findByProductId(productId).getStock();
        
        // 2. 检查库存是否充足
        if (currentStock < quantity) {
            return false; // 库存不足
        }
        
        // 3. 扣减库存
        int newStock = currentStock - quantity;
        inventoryRepository.updateStock(productId, newStock);
        
        return true;
    }
}
```

上述代码在高并发场景下存在严重的问题：
- **竞态条件**：多个线程可能同时读取到相同的库存值，导致超卖
- **性能瓶颈**：数据库锁竞争激烈，响应时间长
- **数据不一致**：在极端情况下可能出现库存数据不一致

### 库存扣减的原子性保证

为了保证库存扣减的原子性，我们需要采用更加可靠的实现方式。

#### 基于数据库乐观锁的实现

```java
@Entity
public class Inventory {
    
    @Id
    private String productId;
    
    private int stock;
    
    private int version; // 版本号，用于乐观锁
    
    // getters and setters
}

@Repository
public class OptimisticLockInventoryRepository {
    
    /**
     * 使用乐观锁扣减库存
     */
    public boolean deductInventory(String productId, int quantity) {
        int maxRetries = 3;
        int retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // 1. 查询当前库存信息
                Inventory inventory = entityManager.find(Inventory.class, productId);
                if (inventory == null) {
                    return false;
                }
                
                // 2. 检查库存是否充足
                if (inventory.getStock() < quantity) {
                    return false;
                }
                
                // 3. 扣减库存（带版本号检查）
                int newStock = inventory.getStock() - quantity;
                int newVersion = inventory.getVersion() + 1;
                
                String sql = "UPDATE inventory SET stock = ?, version = ? " +
                           "WHERE product_id = ? AND version = ?";
                
                int updatedRows = entityManager.createNativeQuery(sql)
                    .setParameter(1, newStock)
                    .setParameter(2, newVersion)
                    .setParameter(3, productId)
                    .setParameter(4, inventory.getVersion())
                    .executeUpdate();
                
                // 如果更新成功，说明版本号匹配，扣减成功
                if (updatedRows > 0) {
                    return true;
                }
                
                // 如果更新失败，说明有其他线程修改了数据，需要重试
                retryCount++;
                
            } catch (Exception e) {
                log.error("Failed to deduct inventory for product: " + productId, e);
                return false;
            }
        }
        
        // 重试次数用完，扣减失败
        return false;
    }
}
```

#### 基于Redis的库存扣减

```java
@Service
public class RedisInventoryService {
    
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    /**
     * 使用Redis原子操作扣减库存
     */
    public boolean deductInventory(String productId, int quantity) {
        String stockKey = "inventory:" + productId;
        
        // 使用Lua脚本保证原子性
        String luaScript = 
            "local current_stock = redis.call('GET', KEYS[1]) " +
            "if current_stock == false then " +
            "    return -1 " +  // 商品不存在
            "end " +
            "local stock = tonumber(current_stock) " +
            "if stock < tonumber(ARGV[1]) then " +
            "    return 0 " +   // 库存不足
            "end " +
            "local new_stock = stock - tonumber(ARGV[1]) " +
            "redis.call('SET', KEYS[1], new_stock) " +
            "return 1";         // 扣减成功
        
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText(luaScript);
        script.setResultType(Long.class);
        
        Long result = redisTemplate.execute(script, 
            Collections.singletonList(stockKey), 
            String.valueOf(quantity));
        
        switch (result.intValue()) {
            case 1:  // 扣减成功
                return true;
            case 0:  // 库存不足
                return false;
            case -1: // 商品不存在
                throw new ProductNotFoundException("Product not found: " + productId);
            default:
                throw new InventoryException("Unknown error occurred");
        }
    }
    
    /**
     * 预热库存到Redis
     */
    public void preloadInventory(String productId) {
        String stockKey = "inventory:" + productId;
        Inventory inventory = inventoryRepository.findByProductId(productId);
        if (inventory != null) {
            redisTemplate.opsForValue().set(stockKey, String.valueOf(inventory.getStock()));
        }
    }
}
```

### 分布式锁在库存扣减中的应用

在某些场景下，我们可能需要使用分布式锁来保证库存扣减的正确性。

```java
@Service
public class DistributedLockInventoryService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 使用分布式锁扣减库存
     */
    public boolean deductInventoryWithLock(String productId, int quantity) {
        String lockKey = "inventory_lock:" + productId;
        String requestId = UUID.randomUUID().toString();
        int lockExpireTime = 10; // 锁过期时间10秒
        
        try {
            // 获取分布式锁
            if (acquireLock(lockKey, requestId, lockExpireTime)) {
                try {
                    // 执行库存扣减逻辑
                    return doDeductInventory(productId, quantity);
                } finally {
                    // 释放锁
                    releaseLock(lockKey, requestId);
                }
            } else {
                // 获取锁失败，返回库存不足
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to deduct inventory with lock for product: " + productId, e);
            return false;
        }
    }
    
    private boolean acquireLock(String lockKey, String requestId, int expireTime) {
        Boolean result = redisTemplate.opsForValue()
            .setIfAbsent(lockKey, requestId, expireTime, TimeUnit.SECONDS);
        return result != null && result;
    }
    
    private boolean releaseLock(String lockKey, String requestId) {
        String script = 
            "if redis.call('get', KEYS[1]) == ARGV[1] then " +
            "    return redis.call('del', KEYS[1]) " +
            "else " +
            "    return 0 " +
            "end";
        
        Long result = (Long) redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            Collections.singletonList(lockKey),
            requestId
        );
        
        return result != null && result > 0;
    }
    
    private boolean doDeductInventory(String productId, int quantity) {
        // 实际的库存扣减逻辑
        Inventory inventory = inventoryRepository.findByProductId(productId);
        if (inventory == null || inventory.getStock() < quantity) {
            return false;
        }
        
        inventory.setStock(inventory.getStock() - quantity);
        inventoryRepository.save(inventory);
        return true;
    }
}
```

## 支付事务保障

### 支付流程的事务设计

在秒杀场景中，支付事务的正确性至关重要。一旦支付成功，就必须保证订单的创建和库存的扣减。

#### 基于本地消息表的支付事务

```java
@Service
public class PaymentWithMessageTableService {
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private OrderRepository orderRepository;
    
    @Autowired
    private InventoryService inventoryService;
    
    @Autowired
    private MessageQueueService messageQueueService;
    
    @Transactional
    public PaymentResult processPayment(PaymentRequest request) {
        try {
            // 1. 创建支付记录
            Payment payment = new Payment();
            payment.setPaymentId(request.getPaymentId());
            payment.setOrderId(request.getOrderId());
            payment.setUserId(request.getUserId());
            payment.setAmount(request.getAmount());
            payment.setStatus(PaymentStatus.PENDING);
            paymentRepository.save(payment);
            
            // 2. 扣减账户余额
            if (!accountService.deductBalance(request.getUserId(), request.getAmount())) {
                throw new InsufficientBalanceException("账户余额不足");
            }
            
            // 3. 存储消息到本地消息表
            Message message = new Message();
            message.setMessageId(UUID.randomUUID().toString());
            message.setTopic("payment_completed");
            message.setPayload(objectMapper.writeValueAsString(payment));
            message.setStatus(MessageStatus.PENDING);
            messageRepository.save(message);
            
            // 4. 提交本地事务
            // 事务提交后，支付记录和消息都已持久化
            
            // 5. 异步发送消息
            messageQueueService.sendMessage(message);
            
            return new PaymentResult(true, "支付成功", payment.getPaymentId());
            
        } catch (Exception e) {
            log.error("Payment processing failed", e);
            return new PaymentResult(false, "支付失败: " + e.getMessage(), null);
        }
    }
    
    /**
     * 处理支付完成消息
     */
    @Transactional
    public void handlePaymentCompleted(String paymentId) {
        Payment payment = paymentRepository.findByPaymentId(paymentId);
        if (payment == null) {
            throw new PaymentNotFoundException("支付记录不存在: " + paymentId);
        }
        
        if (payment.getStatus() == PaymentStatus.COMPLETED) {
            // 已处理，直接返回
            return;
        }
        
        try {
            // 1. 创建订单
            Order order = new Order();
            order.setOrderId(payment.getOrderId());
            order.setUserId(payment.getUserId());
            order.setPaymentId(paymentId);
            order.setAmount(payment.getAmount());
            order.setStatus(OrderStatus.CREATED);
            orderRepository.save(order);
            
            // 2. 扣减库存
            OrderItem orderItem = orderItemRepository.findByOrderId(payment.getOrderId());
            if (!inventoryService.deductInventory(orderItem.getProductId(), orderItem.getQuantity())) {
                throw new InsufficientInventoryException("库存不足");
            }
            
            // 3. 更新支付状态
            payment.setStatus(PaymentStatus.COMPLETED);
            paymentRepository.save(payment);
            
        } catch (Exception e) {
            // 如果处理失败，更新支付状态为失败
            payment.setStatus(PaymentStatus.FAILED);
            payment.setErrorMessage(e.getMessage());
            paymentRepository.save(payment);
            
            throw e;
        }
    }
}
```

#### 基于TCC模式的支付事务

```java
@LocalTCC
public interface PaymentTccService {
    
    @TwoPhaseBusinessAction(name = "payment", commitMethod = "confirm", rollbackMethod = "cancel")
    boolean preparePayment(
        @BusinessActionContextParameter(paramName = "paymentId") String paymentId,
        @BusinessActionContextParameter(paramName = "userId") String userId,
        @BusinessActionContextParameter(paramName = "amount") BigDecimal amount);
    
    boolean confirm(BusinessActionContext context);
    
    boolean cancel(BusinessActionContext context);
}

@Service
public class PaymentTccServiceImpl implements PaymentTccService {
    
    @Autowired
    private AccountService accountService;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Override
    public boolean preparePayment(String paymentId, String userId, BigDecimal amount) {
        try {
            // 1. 预留支付记录
            Payment payment = new Payment();
            payment.setPaymentId(paymentId);
            payment.setUserId(userId);
            payment.setAmount(amount);
            payment.setStatus(PaymentStatus.PREPARED);
            payment.setCreateTime(new Date());
            paymentRepository.save(payment);
            
            // 2. 尝试扣减账户余额（TCC的Try阶段）
            return accountService.tryDeductBalance(userId, amount);
            
        } catch (Exception e) {
            log.error("Failed to prepare payment: " + paymentId, e);
            return false;
        }
    }
    
    @Override
    public boolean confirm(BusinessActionContext context) {
        String paymentId = context.getActionContext("paymentId", String.class);
        
        try {
            // 1. 确认支付（TCC的Confirm阶段）
            Payment payment = paymentRepository.findByPaymentId(paymentId);
            if (payment == null) {
                throw new PaymentNotFoundException("支付记录不存在: " + paymentId);
            }
            
            payment.setStatus(PaymentStatus.CONFIRMED);
            payment.setConfirmTime(new Date());
            paymentRepository.save(payment);
            
            // 2. 确认账户余额扣减
            String userId = context.getActionContext("userId", String.class);
            BigDecimal amount = context.getActionContext("amount", BigDecimal.class);
            accountService.confirmDeductBalance(userId, amount);
            
            return true;
            
        } catch (Exception e) {
            log.error("Failed to confirm payment: " + paymentId, e);
            return false;
        }
    }
    
    @Override
    public boolean cancel(BusinessActionContext context) {
        String paymentId = context.getActionContext("paymentId", String.class);
        
        try {
            // 1. 取消支付（TCC的Cancel阶段）
            Payment payment = paymentRepository.findByPaymentId(paymentId);
            if (payment == null) {
                return true; // 支付记录不存在，无需取消
            }
            
            payment.setStatus(PaymentStatus.CANCELLED);
            payment.setCancelTime(new Date());
            paymentRepository.save(payment);
            
            // 2. 释放账户余额
            String userId = context.getActionContext("userId", String.class);
            BigDecimal amount = context.getActionContext("amount", BigDecimal.class);
            accountService.cancelDeductBalance(userId, amount);
            
            return true;
            
        } catch (Exception e) {
            log.error("Failed to cancel payment: " + paymentId, e);
            return false;
        }
    }
}
```

## 异常回滚与补偿逻辑

### 超时处理机制

在秒杀场景中，超时处理是保证系统稳定性的关键环节。

```java
@Component
public class TimeoutHandlingService {
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    @Autowired
    private OrderRepository orderRepository;
    
    @Autowired
    private InventoryService inventoryService;
    
    @Autowired
    private CompensationService compensationService;
    
    /**
     * 处理超时的支付事务
     */
    @Scheduled(fixedDelay = 30000) // 每30秒检查一次
    public void handleTimeoutPayments() {
        // 查找超时的支付记录（超过5分钟未完成的支付）
        List<Payment> timeoutPayments = paymentRepository
            .findTimeoutPayments(5 * 60 * 1000L);
        
        for (Payment payment : timeoutPayments) {
            try {
                // 根据支付状态进行不同的处理
                switch (payment.getStatus()) {
                    case PENDING:
                        // 超时未支付，取消支付
                        cancelPayment(payment);
                        break;
                    case PREPARED:
                        // TCC准备阶段超时，执行取消
                        compensationService.cancelPayment(payment.getPaymentId());
                        break;
                    case CONFIRMED:
                        // 已确认的支付，检查订单状态
                        checkOrderStatus(payment);
                        break;
                    default:
                        // 其他状态，记录日志
                        log.info("Payment {} in status {}, no action needed", 
                            payment.getPaymentId(), payment.getStatus());
                }
            } catch (Exception e) {
                log.error("Failed to handle timeout payment: " + payment.getPaymentId(), e);
            }
        }
    }
    
    private void cancelPayment(Payment payment) {
        payment.setStatus(PaymentStatus.CANCELLED);
        payment.setCancelTime(new Date());
        payment.setErrorMessage("支付超时");
        paymentRepository.save(payment);
        
        // 记录监控指标
        meterRegistry.counter("payment.timeout").increment();
    }
    
    private void checkOrderStatus(Payment payment) {
        Order order = orderRepository.findByPaymentId(payment.getPaymentId());
        if (order == null) {
            // 支付已确认但订单未创建，需要补偿
            compensationService.createOrderForPayment(payment);
        } else if (order.getStatus() == OrderStatus.CREATED) {
            // 订单已创建但可能未扣减库存，需要检查库存
            checkInventoryForOrder(order);
        }
    }
    
    private void checkInventoryForOrder(Order order) {
        List<OrderItem> items = orderItemRepository.findByOrderId(order.getOrderId());
        for (OrderItem item : items) {
            if (!inventoryService.isInventoryDeducted(item.getProductId(), item.getQuantity())) {
                // 库存未扣减，需要补偿
                compensationService.deductInventory(item.getProductId(), item.getQuantity());
            }
        }
    }
}
```

### 补偿事务设计

补偿事务是保证数据一致性的重要手段，在秒杀场景中尤为重要。

```java
@Service
public class CompensationService {
    
    @Autowired
    private AccountService accountService;
    
    @Autowired
    private InventoryService inventoryService;
    
    @Autowired
    private OrderRepository orderRepository;
    
    @Autowired
    private PaymentRepository paymentRepository;
    
    /**
     * 取消支付的补偿操作
     */
    public void cancelPayment(String paymentId) {
        Payment payment = paymentRepository.findByPaymentId(paymentId);
        if (payment == null) {
            return;
        }
        
        try {
            // 1. 释放账户余额
            accountService.refundBalance(payment.getUserId(), payment.getAmount());
            
            // 2. 更新支付状态
            payment.setStatus(PaymentStatus.CANCELLED);
            payment.setCancelTime(new Date());
            paymentRepository.save(payment);
            
            // 3. 如果订单已创建，取消订单
            Order order = orderRepository.findByPaymentId(paymentId);
            if (order != null) {
                order.setStatus(OrderStatus.CANCELLED);
                order.setCancelTime(new Date());
                orderRepository.save(order);
                
                // 4. 释放库存
                List<OrderItem> items = orderItemRepository.findByOrderId(order.getOrderId());
                for (OrderItem item : items) {
                    inventoryService.releaseInventory(item.getProductId(), item.getQuantity());
                }
            }
            
            log.info("Payment {} cancelled successfully", paymentId);
            
        } catch (Exception e) {
            log.error("Failed to cancel payment: " + paymentId, e);
            // 记录补偿失败，可能需要人工干预
            alertService.sendAlert("Payment compensation failed: " + paymentId);
        }
    }
    
    /**
     * 为支付创建订单的补偿操作
     */
    public void createOrderForPayment(Payment payment) {
        try {
            Order order = new Order();
            order.setOrderId("ORDER_" + payment.getPaymentId());
            order.setUserId(payment.getUserId());
            order.setPaymentId(payment.getPaymentId());
            order.setAmount(payment.getAmount());
            order.setStatus(OrderStatus.CREATED);
            order.setCreateTime(new Date());
            orderRepository.save(order);
            
            log.info("Order created for payment: {}", payment.getPaymentId());
            
        } catch (Exception e) {
            log.error("Failed to create order for payment: " + payment.getPaymentId(), e);
            alertService.sendAlert("Order creation compensation failed: " + payment.getPaymentId());
        }
    }
    
    /**
     * 扣减库存的补偿操作
     */
    public void deductInventory(String productId, int quantity) {
        try {
            if (inventoryService.deductInventory(productId, quantity)) {
                log.info("Inventory deducted successfully: {} x {}", productId, quantity);
            } else {
                log.warn("Failed to deduct inventory: {} x {}", productId, quantity);
                alertService.sendAlert("Inventory deduction compensation failed: " + productId);
            }
        } catch (Exception e) {
            log.error("Failed to deduct inventory: " + productId, e);
            alertService.sendAlert("Inventory deduction compensation failed: " + productId);
        }
    }
    
    /**
     * 释放库存的补偿操作
     */
    public void releaseInventory(String productId, int quantity) {
        try {
            inventoryService.addInventory(productId, quantity);
            log.info("Inventory released successfully: {} x {}", productId, quantity);
        } catch (Exception e) {
            log.error("Failed to release inventory: " + productId, e);
            alertService.sendAlert("Inventory release compensation failed: " + productId);
        }
    }
}
```

## 高并发优化策略

### 限流与降级

在秒杀场景中，合理的限流和降级策略是保护系统稳定性的关键。

```java
@Component
public class FlashSaleProtectionService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    /**
     * 基于令牌桶的限流
     */
    public boolean allowRequest(String productId, int maxRequestsPerSecond) {
        String key = "flash_sale_rate_limit:" + productId;
        String script = 
            "local current_tokens = redis.call('GET', KEYS[1]) " +
            "if current_tokens == false then " +
            "    redis.call('SET', KEYS[1], ARGV[1], 'EX', 1) " +
            "    return 1 " +
            "end " +
            "if tonumber(current_tokens) > 0 then " +
            "    redis.call('DECR', KEYS[1]) " +
            "    return 1 " +
            "else " +
            "    return 0 " +
            "end";
        
        DefaultRedisScript<Long> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(script);
        redisScript.setResultType(Long.class);
        
        Long result = redisTemplate.execute(redisScript, 
            Collections.singletonList(key), 
            String.valueOf(maxRequestsPerSecond));
        
        return result != null && result == 1;
    }
    
    /**
     * 基于用户ID的限流
     */
    public boolean allowUserRequest(String userId, String productId) {
        String key = "user_flash_sale_limit:" + userId + ":" + productId;
        Boolean result = redisTemplate.opsForValue().setIfAbsent(key, "1", 60, TimeUnit.SECONDS);
        return result != null && result;
    }
    
    /**
     * 系统降级处理
     */
    public FlashSaleResponse handleDegradedRequest(FlashSaleRequest request) {
        // 检查系统负载
        if (isSystemOverloaded()) {
            // 系统过载，返回降级响应
            return new FlashSaleResponse(false, "系统繁忙，请稍后重试", null);
        }
        
        // 检查商品库存
        if (!hasSufficientInventory(request.getProductId(), request.getQuantity())) {
            return new FlashSaleResponse(false, "商品库存不足", null);
        }
        
        // 正常处理请求
        return processFlashSaleRequest(request);
    }
    
    private boolean isSystemOverloaded() {
        // 检查系统负载指标
        double cpuUsage = systemMetrics.getCpuUsage();
        double memoryUsage = systemMetrics.getMemoryUsage();
        int activeThreads = systemMetrics.getActiveThreadCount();
        
        return cpuUsage > 0.8 || memoryUsage > 0.85 || activeThreads > 1000;
    }
    
    private boolean hasSufficientInventory(String productId, int quantity) {
        String stockKey = "inventory:" + productId;
        String stockStr = (String) redisTemplate.opsForValue().get(stockKey);
        if (stockStr == null) {
            return false;
        }
        
        int stock = Integer.parseInt(stockStr);
        return stock >= quantity;
    }
}
```

### 缓存预热与异步处理

```java
@Service
public class FlashSaleOptimizationService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    @Autowired
    private InventoryRepository inventoryRepository;
    
    @Autowired
    private ProductRepository productRepository;
    
    /**
     * 秒杀活动预热
     */
    public void preloadFlashSaleData(String productId) {
        // 1. 预热商品信息
        Product product = productRepository.findByProductId(productId);
        if (product != null) {
            String productKey = "product:" + productId;
            redisTemplate.opsForValue().set(productKey, product, 3600, TimeUnit.SECONDS);
        }
        
        // 2. 预热库存信息
        Inventory inventory = inventoryRepository.findByProductId(productId);
        if (inventory != null) {
            String stockKey = "inventory:" + productId;
            redisTemplate.opsForValue().set(stockKey, String.valueOf(inventory.getStock()), 
                                         3600, TimeUnit.SECONDS);
        }
        
        // 3. 初始化限流令牌
        String rateLimitKey = "flash_sale_rate_limit:" + productId;
        redisTemplate.opsForValue().set(rateLimitKey, "1000", 1, TimeUnit.SECONDS);
    }
    
    /**
     * 异步处理秒杀请求
     */
    @Async("flashSaleTaskExecutor")
    public CompletableFuture<FlashSaleResponse> processFlashSaleAsync(FlashSaleRequest request) {
        try {
            FlashSaleResponse response = processFlashSaleRequest(request);
            return CompletableFuture.completedFuture(response);
        } catch (Exception e) {
            log.error("Failed to process flash sale request asynchronously", e);
            return CompletableFuture.completedFuture(
                new FlashSaleResponse(false, "处理失败: " + e.getMessage(), null));
        }
    }
    
    private FlashSaleResponse processFlashSaleRequest(FlashSaleRequest request) {
        // 实际的秒杀处理逻辑
        // ...
        return new FlashSaleResponse(true, "秒杀成功", orderId);
    }
}
```

## 监控与告警

### 秒杀场景监控

```java
@Component
public class FlashSaleMetricsCollector {
    
    private final MeterRegistry meterRegistry;
    
    // 秒杀请求计数器
    private final Counter flashSaleRequests;
    
    // 秒杀成功计数器
    private final Counter flashSaleSuccess;
    
    // 秒杀失败计数器
    private final Counter flashSaleFailures;
    
    // 库存扣减计时器
    private final Timer inventoryDeductionTimer;
    
    // 支付处理计时器
    private final Timer paymentProcessingTimer;
    
    public FlashSaleMetricsCollector(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        this.flashSaleRequests = Counter.builder("flash_sale.requests")
            .description("秒杀请求总数")
            .register(meterRegistry);
            
        this.flashSaleSuccess = Counter.builder("flash_sale.success")
            .description("秒杀成功次数")
            .register(meterRegistry);
            
        this.flashSaleFailures = Counter.builder("flash_sale.failures")
            .description("秒杀失败次数")
            .register(meterRegistry);
            
        this.inventoryDeductionTimer = Timer.builder("flash_sale.inventory.deduction")
            .description("库存扣减耗时")
            .register(meterRegistry);
            
        this.paymentProcessingTimer = Timer.builder("flash_sale.payment.processing")
            .description("支付处理耗时")
            .register(meterRegistry);
    }
    
    public void recordFlashSaleRequest() {
        flashSaleRequests.increment();
    }
    
    public void recordFlashSaleSuccess() {
        flashSaleSuccess.increment();
    }
    
    public void recordFlashSaleFailure() {
        flashSaleFailures.increment();
    }
    
    public Timer.Sample startInventoryDeductionTimer() {
        return Timer.start(meterRegistry);
    }
    
    public void stopInventoryDeductionTimer(Timer.Sample sample) {
        sample.stop(inventoryDeductionTimer);
    }
    
    public Timer.Sample startPaymentProcessingTimer() {
        return Timer.start(meterRegistry);
    }
    
    public void stopPaymentProcessingTimer(Timer.Sample sample) {
        sample.stop(paymentProcessingTimer);
    }
}
```

### 告警规则配置

```yaml
# flash-sale-alerts.yml
groups:
  - name: flash-sale-alerts
    rules:
      # 秒杀失败率过高告警
      - alert: FlashSaleFailureRateHigh
        expr: rate(flash_sale_failures[5m]) / (rate(flash_sale_requests[5m]) + rate(flash_sale_failures[5m])) > 0.1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "秒杀失败率过高"
          description: "过去5分钟秒杀失败率超过10%: {{ $value }}"

      # 库存扣减延迟过高告警
      - alert: InventoryDeductionLatencyHigh
        expr: histogram_quantile(0.95, sum(rate(flash_sale_inventory_deduction_bucket[5m])) by (le)) > 100
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "库存扣减延迟过高"
          description: "95%的库存扣减操作耗时超过100ms: {{ $value }}ms"

      # 支付处理延迟过高告警
      - alert: PaymentProcessingLatencyHigh
        expr: histogram_quantile(0.95, sum(rate(flash_sale_payment_processing_bucket[5m])) by (le)) > 500
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "支付处理延迟过高"
          description: "95%的支付处理操作耗时超过500ms: {{ $value }}ms"

      # 系统负载过高告警
      - alert: SystemLoadHigh
        expr: system_load1 > 5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "系统负载过高"
          description: "系统1分钟负载超过5: {{ $value }}"
```

## 最佳实践总结

### 1. 技术选型建议

```java
public class FlashSaleTechnologySelection {
    
    public FlashSaleSolution selectSolution(BusinessRequirements requirements) {
        if (requirements.getExpectedQPS() > 10000) {
            // 高并发场景，推荐使用Redis + 异步处理
            return new HighConcurrencyFlashSaleSolution();
        } else if (requirements.getConsistencyRequirement() == ConsistencyLevel.STRONG) {
            // 强一致性要求，推荐使用TCC模式
            return new StrongConsistencyFlashSaleSolution();
        } else {
            // 一般场景，推荐使用本地消息表
            return new EventualConsistencyFlashSaleSolution();
        }
    }
}
```

### 2. 架构设计原则

```java
public class FlashSaleArchitecturePrinciples {
    
    /**
     * 读写分离原则
     */
    public void readWriteSeparation() {
        // 查询操作走从库
        // 写入操作走主库
    }
    
    /**
     * 缓存优先原则
     */
    public void cacheFirst() {
        // 优先从缓存读取数据
        // 缓存未命中再查询数据库
    }
    
    /**
     * 异步处理原则
     */
    public void asyncProcessing() {
        // 非核心操作异步处理
        // 快速响应用户请求
    }
    
    /**
     * 限流降级原则
     */
    public void rateLimitingAndDegradation() {
        // 设置合理的限流阈值
        // 系统过载时及时降级
    }
}
```

### 3. 测试验证方案

```java
@SpringBootTest
public class FlashSaleTest {
    
    @Autowired
    private FlashSaleService flashSaleService;
    
    @Test
    public void testHighConcurrencyFlashSale() throws InterruptedException {
        int threadCount = 1000;
        int requestsPerThread = 10;
        CountDownLatch latch = new CountDownLatch(threadCount);
        
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);
        
        long startTime = System.currentTimeMillis();
        
        // 模拟高并发请求
        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    for (int j = 0; j < requestsPerThread; j++) {
                        FlashSaleRequest request = createTestRequest();
                        FlashSaleResponse response = flashSaleService.processFlashSale(request);
                        if (response.isSuccess()) {
                            successCount.incrementAndGet();
                        } else {
                            failureCount.incrementAndGet();
                        }
                    }
                } finally {
                    latch.countDown();
                }
            });
        }
        
        // 等待所有请求完成
        latch.await();
        executor.shutdown();
        
        long endTime = System.currentTimeMillis();
        
        // 验证结果
        System.out.println("总请求数: " + (threadCount * requestsPerThread));
        System.out.println("成功数: " + successCount.get());
        System.out.println("失败数: " + failureCount.get());
        System.out.println("总耗时: " + (endTime - startTime) + "ms");
        System.out.println("平均响应时间: " + (endTime - startTime) / (threadCount * requestsPerThread) + "ms");
        
        // 验证库存扣减正确性
        verifyInventoryDeduction();
    }
}
```

## 总结

电商秒杀场景是分布式事务应用的典型场景，它对系统的并发处理能力、数据一致性和响应速度都提出了极高的要求。通过本章的分析和实践，我们可以总结出以下关键要点：

1. **库存扣减的原子性**：使用乐观锁、Redis原子操作或分布式锁保证库存扣减的原子性
2. **支付事务的可靠性**：采用本地消息表、TCC等模式保证支付事务的正确性
3. **异常处理与补偿**：建立完善的超时处理和补偿机制，确保数据一致性
4. **高并发优化**：通过限流、缓存预热、异步处理等手段提升系统性能
5. **监控与告警**：建立完善的监控体系，及时发现和处理问题

在实际项目中，我们需要根据具体的业务需求和技术条件，选择合适的解决方案，并持续优化和改进。通过合理的架构设计和实现，我们可以构建出高性能、高可用的电商秒杀系统，为用户提供良好的购物体验。