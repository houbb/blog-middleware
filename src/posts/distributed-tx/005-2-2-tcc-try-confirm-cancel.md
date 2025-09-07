---
title: TCC（Try-Confirm-Cancel）模式：构建高性能分布式事务的三步法
date: 2025-09-01
categories: [DisTx]
tags: [dis-tx]
published: true
---

# TCC（Try-Confirm-Cancel）模式：构建高性能分布式事务的三步法

在分布式系统中，事务处理是一个复杂而关键的问题。在前面的章节中，我们介绍了本地事务 + 消息队列模式，它通过最终一致性来解决分布式事务问题。本章将深入探讨另一种重要的分布式事务模式——TCC（Try-Confirm-Cancel）模式。

## TCC模式概述

### TCC的核心概念

TCC是Try-Confirm-Cancel的缩写，它是一种分布式事务的解决方案，通过定义业务活动中的三个操作来保证分布式事务的一致性：

1. **Try（尝试）**：预留业务资源，检查并锁定资源
2. **Confirm（确认）**：确认执行业务操作，实际执行业务
3. **Cancel（取消）**：取消执行业务操作，释放资源

### TCC与传统事务的区别

传统事务（如2PC）是在资源层面实现的，而TCC是在业务层面实现的。这意味着TCC需要业务代码来实现Try、Confirm和Cancel三个操作，而不是依赖数据库或中间件的事务支持。

## 三步操作解析

### Try阶段：资源预留

Try阶段是TCC模式的第一步，主要目的是检查业务活动是否可以执行，并预留所需的业务资源。

#### Try阶段的职责

1. **业务检查**：验证业务规则和约束条件
2. **资源预留**：锁定或预留所需的资源
3. **状态记录**：记录事务状态，为后续操作做准备

#### Try阶段的特点

- **幂等性**：Try操作需要支持重复调用
- **可逆性**：预留的资源必须能够被释放
- **轻量级**：Try操作应该尽可能轻量，避免长时间锁定资源

#### Try阶段实现示例

```java
public class AccountService {
    
    /**
     * Try阶段：尝试扣款
     * @param accountId 账户ID
     * @param amount 扣款金额
     * @return 是否可以扣款
     */
    public boolean tryDebit(String accountId, BigDecimal amount) {
        // 1. 检查账户是否存在
        Account account = accountRepository.findById(accountId);
        if (account == null) {
            return false;
        }
        
        // 2. 检查余额是否充足
        if (account.getBalance().compareTo(amount) < 0) {
            return false;
        }
        
        // 3. 预留资源：冻结金额
        account.setFrozenAmount(account.getFrozenAmount().add(amount));
        account.setBalance(account.getBalance().subtract(amount));
        
        // 4. 记录事务状态
        Transaction transaction = new Transaction();
        transaction.setAccountId(accountId);
        transaction.setAmount(amount);
        transaction.setStatus(TransactionStatus.TRYING);
        transactionRepository.save(transaction);
        
        accountRepository.update(account);
        return true;
    }
}
```

### Confirm阶段：确认执行

Confirm阶段是TCC模式的第二步，当所有参与者的Try操作都成功后，协调者会发起Confirm操作，正式执行业务逻辑。

#### Confirm阶段的职责

1. **正式执行**：执行实际的业务操作
2. **资源确认**：确认预留的资源
3. **状态更新**：更新事务状态为完成

#### Confirm阶段的特点

- **幂等性**：Confirm操作需要支持重复调用
- **快速执行**：Confirm操作应该快速完成，避免长时间占用资源
- **不可逆性**：Confirm操作一旦成功，不能回滚

#### Confirm阶段实现示例

```java
public class AccountService {
    
    /**
     * Confirm阶段：确认扣款
     * @param accountId 账户ID
     * @param amount 扣款金额
     */
    public void confirmDebit(String accountId, BigDecimal amount) {
        // 1. 获取事务记录
        Transaction transaction = transactionRepository
            .findByAccountIdAndAmountAndStatus(accountId, amount, TransactionStatus.TRYING);
        
        if (transaction == null) {
            // 幂等性处理：如果事务不存在或已处理，直接返回
            return;
        }
        
        // 2. 确认资源：减少冻结金额
        Account account = accountRepository.findById(accountId);
        account.setFrozenAmount(account.getFrozenAmount().subtract(amount));
        
        // 3. 更新事务状态
        transaction.setStatus(TransactionStatus.CONFIRMED);
        transaction.setConfirmTime(new Date());
        
        accountRepository.update(account);
        transactionRepository.update(transaction);
    }
}
```

### Cancel阶段：取消回滚

Cancel阶段是TCC模式的第三步，当任何一个参与者的Try操作失败时，协调者会发起Cancel操作，回滚已执行的Try操作。

#### Cancel阶段的职责

1. **资源释放**：释放预留的资源
2. **状态回滚**：回滚事务状态
3. **补偿操作**：执行必要的补偿逻辑

#### Cancel阶段的特点

- **幂等性**：Cancel操作需要支持重复调用
- **完整性**：必须完全释放Try阶段预留的所有资源
- **安全性**：确保回滚操作不会产生副作用

#### Cancel阶段实现示例

```java
public class AccountService {
    
    /**
     * Cancel阶段：取消扣款
     * @param accountId 账户ID
     * @param amount 扣款金额
     */
    public void cancelDebit(String accountId, BigDecimal amount) {
        // 1. 获取事务记录
        Transaction transaction = transactionRepository
            .findByAccountIdAndAmountAndStatus(accountId, amount, TransactionStatus.TRYING);
        
        if (transaction == null) {
            // 幂等性处理：如果事务不存在或已处理，直接返回
            return;
        }
        
        // 2. 释放资源：解冻金额
        Account account = accountRepository.findById(accountId);
        account.setFrozenAmount(account.getFrozenAmount().subtract(amount));
        account.setBalance(account.getBalance().add(amount));
        
        // 3. 更新事务状态
        transaction.setStatus(TransactionStatus.CANCELLED);
        transaction.setCancelTime(new Date());
        
        accountRepository.update(account);
        transactionRepository.update(transaction);
    }
}
```

## 幂等性与补偿逻辑

### 幂等性设计的重要性

在分布式系统中，由于网络问题、超时重试等原因，同一个操作可能会被多次调用。因此，TCC模式中的Try、Confirm和Cancel操作都必须具备幂等性。

#### 幂等性实现策略

1. **状态检查**：在执行操作前检查当前状态
2. **唯一标识**：使用全局唯一标识符来识别操作
3. **数据库约束**：利用数据库的唯一约束防止重复操作

#### 幂等性实现示例

```java
public class OrderService {
    
    /**
     * 幂等性创建订单
     * @param requestId 请求ID（全局唯一）
     * @param order 订单信息
     */
    public Order createOrder(String requestId, Order order) {
        // 1. 检查请求是否已处理
        if (orderRepository.existsByRequestId(requestId)) {
            // 如果已处理，直接返回已创建的订单
            return orderRepository.findByRequestId(requestId);
        }
        
        // 2. 创建订单
        order.setRequestId(requestId);
        order.setStatus(OrderStatus.CREATED);
        return orderRepository.save(order);
    }
}
```

### 补偿逻辑设计

补偿逻辑是TCC模式中非常重要的一部分，它确保在事务失败时能够正确回滚已执行的操作。

#### 补偿逻辑设计原则

1. **完全补偿**：补偿操作必须完全撤销Try阶段的操作
2. **幂等性**：补偿操作需要支持重复调用
3. **一致性**：补偿操作必须保证数据一致性

#### 补偿逻辑实现示例

```java
public class InventoryService {
    
    /**
     * Try阶段：尝试扣减库存
     */
    public boolean tryDeduct(String productId, int quantity) {
        Product product = productRepository.findById(productId);
        if (product == null || product.getStock() < quantity) {
            return false;
        }
        
        // 预留库存
        product.setReservedStock(product.getReservedStock() + quantity);
        product.setStock(product.getStock() - quantity);
        
        // 记录预留记录
        Reservation reservation = new Reservation();
        reservation.setProductId(productId);
        reservation.setQuantity(quantity);
        reservation.setStatus(ReservationStatus.RESERVED);
        reservationRepository.save(reservation);
        
        productRepository.update(product);
        return true;
    }
    
    /**
     * Cancel阶段：释放预留库存
     */
    public void cancelDeduct(String productId, int quantity) {
        Reservation reservation = reservationRepository
            .findByProductIdAndQuantityAndStatus(productId, quantity, ReservationStatus.RESERVED);
        
        if (reservation == null) {
            return;
        }
        
        // 释放库存
        Product product = productRepository.findById(productId);
        product.setReservedStock(product.getReservedStock() - quantity);
        product.setStock(product.getStock() + quantity);
        
        // 更新预留记录状态
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setCancelTime(new Date());
        
        productRepository.update(product);
        reservationRepository.update(reservation);
    }
}
```

## 实现注意事项与陷阱

### 常见实现陷阱

#### 1. 忘记实现幂等性

这是TCC模式中最常见的错误。由于网络问题或超时重试，同一个操作可能会被多次调用，如果没有实现幂等性，会导致数据不一致。

**解决方案**：为每个操作实现幂等性检查，使用唯一标识符来识别重复操作。

#### 2. 资源预留时间过长

Try阶段会长时间锁定资源，如果预留时间过长，会影响系统性能。

**解决方案**：尽量缩短Try阶段的执行时间，设置合理的超时机制。

#### 3. Cancel操作不完整

Cancel操作必须完全释放Try阶段预留的所有资源，否则会导致资源泄漏。

**解决方案**：仔细设计Cancel逻辑，确保所有预留资源都能被正确释放。

#### 4. 业务逻辑与TCC耦合过紧

TCC操作与业务逻辑耦合过紧，导致代码难以维护和扩展。

**解决方案**：合理抽象TCC操作，将业务逻辑与事务逻辑分离。

### 最佳实践

#### 1. 合理设计Try操作

Try操作应该只做必要的检查和资源预留，避免执行复杂的业务逻辑。

```java
// 不推荐的做法
public boolean tryTransfer(String fromAccount, String toAccount, BigDecimal amount) {
    // 复杂的业务逻辑
    validateAccounts(fromAccount, toAccount);
    checkTransferLimits(amount);
    // ... 更多业务逻辑
    reserveFunds(fromAccount, amount);
    return true;
}

// 推荐的做法
public boolean tryReserveFunds(String accountId, BigDecimal amount) {
    // 只做必要的检查和资源预留
    Account account = accountRepository.findById(accountId);
    if (account.getBalance().compareTo(amount) >= 0) {
        account.setReservedAmount(account.getReservedAmount().add(amount));
        accountRepository.update(account);
        return true;
    }
    return false;
}
```

#### 2. 实现完善的异常处理

在TCC模式中，异常处理非常重要，需要考虑各种异常情况。

```java
public class TccTransactionManager {
    
    public void executeTccTransaction(List<TccParticipant> participants) {
        try {
            // 1. 执行所有参与者的Try操作
            for (TccParticipant participant : participants) {
                if (!participant.tryOperation()) {
                    // 如果任何一个Try操作失败，执行Cancel操作
                    cancelAll(participants);
                    throw new TransactionException("Try operation failed");
                }
            }
            
            // 2. 执行所有参与者的Confirm操作
            for (TccParticipant participant : participants) {
                participant.confirmOperation();
            }
        } catch (Exception e) {
            // 3. 异常处理：执行Cancel操作
            cancelAll(participants);
            throw new TransactionException("Transaction failed", e);
        }
    }
    
    private void cancelAll(List<TccParticipant> participants) {
        // 逆序执行Cancel操作
        for (int i = participants.size() - 1; i >= 0; i--) {
            try {
                participants.get(i).cancelOperation();
            } catch (Exception e) {
                // 记录日志，但不中断其他Cancel操作
                log.error("Cancel operation failed", e);
            }
        }
    }
}
```

#### 3. 实现监控和告警

TCC模式的执行过程需要完善的监控和告警机制。

```java
@Component
public class TccTransactionMonitor {
    
    private final MeterRegistry meterRegistry;
    
    public void recordTrySuccess(String serviceName) {
        Counter.builder("tcc.try.success")
            .tag("service", serviceName)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordTryFailure(String serviceName) {
        Counter.builder("tcc.try.failure")
            .tag("service", serviceName)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordConfirmSuccess(String serviceName) {
        Counter.builder("tcc.confirm.success")
            .tag("service", serviceName)
            .register(meterRegistry)
            .increment();
    }
    
    public void recordCancelSuccess(String serviceName) {
        Counter.builder("tcc.cancel.success")
            .tag("service", serviceName)
            .register(meterRegistry)
            .increment();
    }
}
```

## TCC模式的应用场景

### 金融支付场景

在金融支付系统中，TCC模式可以很好地处理跨账户转账等复杂业务场景。

```java
@Service
public class TransferService {
    
    @Autowired
    private AccountService accountService;
    
    public void transfer(String fromAccount, String toAccount, BigDecimal amount) {
        // 1. 尝试从源账户扣款
        boolean debitReserved = accountService.tryDebit(fromAccount, amount);
        if (!debitReserved) {
            throw new InsufficientFundsException("Insufficient funds in source account");
        }
        
        // 2. 尝试向目标账户入账
        boolean creditReserved = accountService.tryCredit(toAccount, amount);
        if (!creditReserved) {
            // 如果入账失败，取消扣款操作
            accountService.cancelDebit(fromAccount, amount);
            throw new TransferException("Failed to reserve credit");
        }
        
        // 3. 确认扣款
        accountService.confirmDebit(fromAccount, amount);
        
        // 4. 确认入账
        accountService.confirmCredit(toAccount, amount);
    }
}
```

### 电商订单场景

在电商系统中，下单操作通常涉及库存扣减、订单创建、支付处理等多个步骤。

```java
@Service
public class OrderService {
    
    @Autowired
    private InventoryService inventoryService;
    
    @Autowired
    private PaymentService paymentService;
    
    public Order createOrder(OrderRequest request) {
        // 1. 尝试扣减库存
        boolean inventoryReserved = inventoryService.tryReserve(request.getProductId(), request.getQuantity());
        if (!inventoryReserved) {
            throw new InsufficientInventoryException("Insufficient inventory");
        }
        
        // 2. 尝试创建订单
        Order order = orderRepository.createOrder(request);
        
        // 3. 尝试处理支付
        boolean paymentReserved = paymentService.tryProcess(order.getPaymentInfo());
        if (!paymentReserved) {
            // 如果支付失败，取消库存预留和订单创建
            inventoryService.cancelReserve(request.getProductId(), request.getQuantity());
            orderRepository.cancelOrder(order.getId());
            throw new PaymentException("Payment processing failed");
        }
        
        // 4. 确认所有操作
        inventoryService.confirmReserve(request.getProductId(), request.getQuantity());
        orderRepository.confirmOrder(order.getId());
        paymentService.confirmProcess(order.getPaymentInfo());
        
        return order;
    }
}
```

## TCC与其他模式的对比

### TCC vs 2PC

| 特性 | TCC | 2PC |
|------|-----|-----|
| 实现层面 | 业务层面 | 资源层面 |
| 一致性 | 最终一致性 | 强一致性 |
| 性能 | 高 | 低 |
| 复杂度 | 高 | 中等 |
| 适用场景 | 复杂业务场景 | 简单事务场景 |

### TCC vs Saga

| 特性 | TCC | Saga |
|------|-----|-----|
| 阶段数 | 3个阶段 | 多个阶段 |
| 补偿方式 | Cancel操作 | 补偿事务 |
| 实现复杂度 | 高 | 中等 |
| 性能 | 高 | 中等 |

### TCC vs 本地消息表

| 特性 | TCC | 本地消息表 |
|------|-----|-----------|
| 一致性 | 最终一致性 | 最终一致性 |
| 实现复杂度 | 高 | 低 |
| 业务侵入性 | 高 | 低 |
| 适用场景 | 复杂业务场景 | 通用场景 |

## 总结

TCC模式是一种强大的分布式事务解决方案，特别适用于复杂的业务场景。通过Try、Confirm、Cancel三个阶段的操作，TCC模式能够在保证数据一致性的同时，提供较高的性能和可用性。

然而，TCC模式的实现复杂度较高，需要开发者仔细设计Try、Confirm、Cancel三个操作，并处理各种异常情况。在实际应用中，需要根据具体的业务场景来决定是否采用TCC模式。

在后续章节中，我们将继续探讨其他分布式事务模式，如Saga模式，并深入分析主流的分布式事务框架，帮助你在实际项目中正确选择和应用这些模式。