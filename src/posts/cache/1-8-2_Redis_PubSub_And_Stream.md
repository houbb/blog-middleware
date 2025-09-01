---
title: Redis发布订阅与Stream：构建高效消息传递系统
date: 2025-08-30
categories: [Cache]
tags: [cache]
published: true
---

Redis不仅是一个高性能的键值存储系统，还提供了强大的消息传递功能。通过发布订阅（Pub/Sub）模式和Stream数据结构，Redis可以作为轻量级的消息中间件使用，满足各种消息传递场景的需求。本章将深入探讨这两种消息传递机制的原理、使用方法以及适用场景。

## Redis发布订阅模式

发布订阅是一种消息通信模式，发送者（发布者）发送消息，接收者（订阅者）接收消息，两者之间不需要直接建立联系。Redis的发布订阅模式基于频道（Channel）实现，发布者向频道发送消息，订阅者订阅频道接收消息。

### 发布订阅的基本使用

```bash
# 订阅频道
SUBSCRIBE channel1 channel2

# 发布消息到频道
PUBLISH channel1 "Hello World"

# 查看活跃频道
PUBSUB CHANNELS

# 查看频道订阅者数量
PUBSUB NUMSUB channel1
```

### 发布订阅的实现原理

Redis发布订阅的实现基于以下数据结构：
1. **频道订阅关系**：记录每个频道有哪些客户端订阅
2. **模式订阅关系**：记录每个客户端订阅了哪些模式
3. **客户端订阅信息**：记录每个客户端订阅了哪些频道和模式

当有消息发布到频道时，Redis会查找该频道的所有订阅者，并将消息发送给它们。

### 发布订阅的优缺点

**优点：**
1. 实现简单，易于理解和使用
2. 支持模式匹配订阅
3. 支持实时消息传递

**缺点：**
1. 消息不持久化，如果订阅者不在线会丢失消息
2. 没有确认机制，无法保证消息被正确处理
3. 不支持消费者组，无法实现负载均衡

### 发布订阅实现示例

```java
// Redis发布订阅实现
@Component
public class RedisPubSubExample {
    
    // 消息发布者
    @Service
    public static class MessagePublisher {
        @Autowired
        private RedisTemplate<String, Object> redisTemplate;
        
        public void publishMessage(String channel, Object message) {
            redisTemplate.convertAndSend(channel, message);
            log.info("Published message to channel {}: {}", channel, message);
        }
        
        // 发布系统通知
        public void publishSystemNotification(String notification) {
            publishMessage("system:notification", notification);
        }
        
        // 发布用户消息
        public void publishUserMessage(Long userId, String message) {
            publishMessage("user:" + userId + ":messages", message);
        }
    }
    
    // 消息订阅者
    @Service
    public static class MessageSubscriber {
        
        // 订阅系统通知
        @RedisListener(topics = "system:notification")
        public void handleSystemNotification(String message) {
            log.info("Received system notification: " + message);
            // 处理系统通知
        }
        
        // 订阅用户消息
        @RedisListener(topics = "user:*:messages")
        public void handleUserMessage(String message) {
            log.info("Received user message: " + message);
            // 处理用户消息
        }
        
        // 订阅订单更新
        @RedisListener(topics = "order:update")
        public void handleOrderUpdate(OrderUpdateMessage message) {
            log.info("Received order update: " + message);
            // 处理订单更新
        }
    }
    
    // 手动订阅实现
    @Service
    public static class ManualSubscriber {
        @Autowired
        private RedisTemplate<String, Object> redisTemplate;
        
        public void subscribeToChannels(List<String> channels) {
            RedisConnection connection = redisTemplate.getConnectionFactory().getConnection();
            connection.subscribe(new MessageListener() {
                @Override
                public void onMessage(Message message, byte[] pattern) {
                    String channel = new String(message.getChannel());
                    String body = new String(message.getBody());
                    log.info("Received message from channel {}: {}", channel, body);
                    // 处理消息
                }
            }, channels.stream().map(String::getBytes).toArray(byte[][]::new));
        }
    }
}
```

## Redis Stream数据结构

Redis Stream是Redis 5.0引入的新数据结构，专门用于处理消息队列场景。它提供了比发布订阅更强大的功能，如消息持久化、消费者组、消息确认等。

### Stream的基本操作

```bash
# 向Stream添加消息
XADD mystream * field1 value1 field2 value2

# 从Stream读取消息
XREAD COUNT 2 STREAMS mystream 0

# 创建消费者组
XGROUP CREATE mystream mygroup 0

# 从消费者组读取消息
XREADGROUP GROUP mygroup consumer1 COUNT 1 STREAMS mystream >
```

### Stream的核心特性

1. **消息持久化**：Stream中的消息会持久化到磁盘，不会因为Redis重启而丢失
2. **消费者组**：支持消费者组概念，实现负载均衡和消息确认机制
3. **消息确认**：消费者处理完消息后需要确认，未确认的消息可以被其他消费者处理
4. **消息ID**：每条消息都有唯一的ID，支持按ID范围读取
5. **自动删除**：支持设置最大长度，自动删除旧消息

### Stream操作示例

```java
// Redis Stream操作示例
@Service
public class RedisStreamExample {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 向Stream添加消息
    public String addMessageToStream(String streamKey, Map<String, Object> message) {
        return redisTemplate.opsForStream().add(streamKey, message);
    }
    
    // 从Stream读取消息
    public List<MapRecord<String, Object, Object>> readMessages(String streamKey, 
                                                               String consumerGroup, 
                                                               String consumerName) {
        // 从消费者组读取消息
        return redisTemplate.opsForStream().read(Consumer.from(consumerGroup, consumerName),
                                               StreamOffset.create(streamKey, ReadOffset.lastConsumed()));
    }
    
    // 创建消费者组
    public void createConsumerGroup(String streamKey, String groupName) {
        try {
            redisTemplate.opsForStream().createGroup(streamKey, groupName);
        } catch (Exception e) {
            // 消费者组可能已存在
            log.warn("Consumer group may already exist: " + e.getMessage());
        }
    }
    
    // 确认消息处理完成
    public void acknowledgeMessage(String streamKey, String groupName, String messageId) {
        redisTemplate.opsForStream().acknowledge(streamKey, groupName, messageId);
    }
    
    // 删除已处理的消息
    public Long deleteProcessedMessages(String streamKey, String... messageIds) {
        return redisTemplate.opsForStream().delete(streamKey, messageIds);
    }
    
    // 获取Stream信息
    public StreamInfo.XInfoStream getStreamInfo(String streamKey) {
        return redisTemplate.opsForStream().info(streamKey);
    }
    
    // 实际使用示例
    public void processOrderEvents() {
        String streamKey = "order:events";
        String consumerGroup = "order-processing-group";
        String consumerName = "processor-1";
        
        // 创建消费者组
        createConsumerGroup(streamKey, consumerGroup);
        
        // 读取消息
        List<MapRecord<String, Object, Object>> messages = readMessages(streamKey, consumerGroup, consumerName);
        
        for (MapRecord<String, Object, Object> message : messages) {
            try {
                // 处理消息
                processOrderEvent(message);
                
                // 确认消息处理完成
                acknowledgeMessage(streamKey, consumerGroup, message.getId());
            } catch (Exception e) {
                log.error("Failed to process message: " + message.getId(), e);
                // 可以选择不确认消息，让其他消费者处理
            }
        }
    }
    
    private void processOrderEvent(MapRecord<String, Object, Object> message) {
        // 处理订单事件的业务逻辑
        log.info("Processing order event: " + message.getValue());
    }
}
```

## 发布订阅与Stream的对比

| 特性 | 发布订阅 | Stream |
|------|----------|--------|
| 消息持久化 | 不支持 | 支持 |
| 消息确认 | 不支持 | 支持 |
| 消费者组 | 不支持 | 支持 |
| 消息回溯 | 不支持 | 支持 |
| 消息ID | 不支持 | 支持 |
| 负载均衡 | 不支持 | 支持 |

### 适用场景选择

**选择发布订阅的场景：**
1. 实时通知场景，如系统通知、状态更新
2. 简单的消息广播，不需要持久化
3. 对消息丢失不敏感的场景

**选择Stream的场景：**
1. 需要消息持久化的场景
2. 需要消费者组和负载均衡的场景
3. 需要消息确认机制的场景
4. 需要消息回溯的场景

## 实际应用案例

### 1. 订单处理系统

```java
// 使用Stream实现订单处理系统
@Service
public class OrderProcessingSystem {
    private static final String ORDER_STREAM = "orders";
    private static final String ORDER_GROUP = "order-processors";
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 订单创建服务
    public void createOrder(Order order) {
        Map<String, Object> message = new HashMap<>();
        message.put("orderId", order.getId());
        message.put("customerId", order.getCustomerId());
        message.put("amount", order.getAmount());
        message.put("items", order.getItems());
        
        // 将订单添加到Stream
        String messageId = redisTemplate.opsForStream().add(ORDER_STREAM, message);
        log.info("Order {} created with message ID: {}", order.getId(), messageId);
    }
    
    // 订单处理服务
    @Scheduled(fixedDelay = 1000)
    public void processOrders() {
        String consumerName = "processor-" + Thread.currentThread().getName();
        
        try {
            // 从消费者组读取订单消息
            List<MapRecord<String, Object, Object>> messages = 
                redisTemplate.opsForStream().read(
                    Consumer.from(ORDER_GROUP, consumerName),
                    StreamOffset.create(ORDER_STREAM, ReadOffset.lastConsumed())
                );
            
            for (MapRecord<String, Object, Object> message : messages) {
                try {
                    // 处理订单
                    processOrderMessage(message);
                    
                    // 确认消息处理完成
                    redisTemplate.opsForStream().acknowledge(ORDER_STREAM, ORDER_GROUP, message.getId());
                } catch (Exception e) {
                    log.error("Failed to process order message: " + message.getId(), e);
                }
            }
        } catch (Exception e) {
            log.error("Failed to read order messages", e);
        }
    }
    
    private void processOrderMessage(MapRecord<String, Object, Object> message) {
        Map<String, Object> orderData = message.getValue();
        String orderId = (String) orderData.get("orderId");
        String customerId = (String) orderData.get("customerId");
        Double amount = (Double) orderData.get("amount");
        
        log.info("Processing order {} for customer {} with amount {}", orderId, customerId, amount);
        
        // 实际的订单处理逻辑
        // ...
    }
}
```

### 2. 系统监控通知

```java
// 使用发布订阅实现系统监控通知
@Service
public class SystemMonitoringService {
    
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 发布系统告警
    public void publishAlert(String alertType, String message) {
        Map<String, Object> alert = new HashMap<>();
        alert.put("type", alertType);
        alert.put("message", message);
        alert.put("timestamp", System.currentTimeMillis());
        
        redisTemplate.convertAndSend("system:alerts", alert);
        log.info("Published alert: {} - {}", alertType, message);
    }
    
    // 订阅系统告警
    @RedisListener(topics = "system:alerts")
    public void handleSystemAlert(Map<String, Object> alert) {
        String alertType = (String) alert.get("type");
        String message = (String) alert.get("message");
        Long timestamp = (Long) alert.get("timestamp");
        
        log.warn("Received system alert: {} - {} at {}", alertType, message, new Date(timestamp));
        
        // 根据告警类型进行处理
        switch (alertType) {
            case "CPU_HIGH":
                handleHighCpuAlert(message);
                break;
            case "MEMORY_LOW":
                handleLowMemoryAlert(message);
                break;
            case "DISK_FULL":
                handleDiskFullAlert(message);
                break;
            default:
                log.warn("Unknown alert type: {}", alertType);
        }
    }
    
    private void handleHighCpuAlert(String message) {
        // 处理CPU高使用率告警
        log.info("Handling high CPU alert: {}", message);
    }
    
    private void handleLowMemoryAlert(String message) {
        // 处理内存不足告警
        log.info("Handling low memory alert: {}", message);
    }
    
    private void handleDiskFullAlert(String message) {
        // 处理磁盘满告警
        log.info("Handling disk full alert: {}", message);
    }
}
```

## 总结

Redis的消息传递功能为构建轻量级消息系统提供了便利：

1. **发布订阅**适合简单的实时通知场景，实现简单但功能有限
2. **Stream**提供了更强大的消息队列功能，支持持久化、消费者组、消息确认等特性

在实际应用中，应根据具体需求选择合适的消息传递机制：
- 对于简单的实时通知，可以选择发布订阅
- 对于需要消息持久化和可靠处理的场景，应选择Stream

通过合理使用Redis的消息传递功能，我们可以构建出高效、可靠的消息处理系统，为业务提供更好的支持。