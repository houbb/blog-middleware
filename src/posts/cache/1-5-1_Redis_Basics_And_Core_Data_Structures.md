---
title: Redis基础与核心数据结构：构建高性能应用的基石
date: 2025-08-30
categories: [Cache]
tags: [cache]
published: true
---

Redis（Remote Dictionary Server）作为一个开源的内存数据结构存储系统，以其高性能、丰富的数据结构和强大的功能特性，成为现代分布式系统中不可或缺的组件。它不仅可以用作数据库、缓存和消息中间件，还提供了事务、发布订阅、Lua脚本等高级功能。本节将深入探讨Redis的基础知识和核心数据结构，帮助读者掌握这一重要技术。

## Redis概述

Redis是一个基于内存的键值存储系统，由Salvatore Sanfilippo（antirez）于2009年开发。它支持多种数据结构，包括字符串（Strings）、哈希（Hashes）、列表（Lists）、集合（Sets）、有序集合（Sorted Sets）等，并提供了丰富的操作命令。

### Redis核心特性

1. **高性能**：基于内存存储，读写速度极快
2. **丰富的数据结构**：支持多种数据类型
3. **持久化**：支持RDB快照和AOF日志两种持久化方式
4. **高可用性**：支持主从复制、哨兵模式和集群模式
5. **原子性操作**：单个命令是原子性的
6. **发布订阅**：支持消息发布订阅模式
7. **Lua脚本**：支持Lua脚本执行复杂操作

## Redis核心数据结构详解

### 1. String（字符串）

String是Redis最基本的数据类型，可以存储文本、数字或二进制数据。一个String类型的键最大可以存储512MB的数据。

#### 基本操作

```java
// Redis String操作示例
@Service
public class RedisStringOperations {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 设置字符串
    public void setString(String key, String value) {
        redisTemplate.opsForValue().set(key, value);
    }
    
    // 获取字符串
    public String getString(String key) {
        return redisTemplate.opsForValue().get(key);
    }
    
    // 设置字符串并指定过期时间
    public void setStringWithExpire(String key, String value, int expireSeconds) {
        redisTemplate.opsForValue().set(key, value, expireSeconds, TimeUnit.SECONDS);
    }
    
    // 原子性递增
    public Long increment(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }
    
    // 原子性递减
    public Long decrement(String key, long delta) {
        return redisTemplate.opsForValue().decrement(key, delta);
    }
    
    // 追加字符串
    public Integer append(String key, String value) {
        return redisTemplate.opsForValue().append(key, value);
    }
    
    // 获取字符串长度
    public Long strlen(String key) {
        return redisTemplate.opsForValue().size(key);
    }
    
    // 设置多个键值对
    public void setMultiple(Map<String, String> keyValueMap) {
        redisTemplate.opsForValue().multiSet(keyValueMap);
    }
    
    // 获取多个键的值
    public List<String> getMultiple(List<String> keys) {
        return redisTemplate.opsForValue().multiGet(keys);
    }
}
```

#### 使用场景

```java
// String数据结构的常见使用场景
@Service
public class StringUseCases {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 1. 缓存简单数据
    public void cacheSimpleData() {
        redisTemplate.opsForValue().set("user:name:1001", "张三", 3600, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set("product:price:2001", "99.99", 1800, TimeUnit.SECONDS);
    }
    
    // 2. 计数器
    public Long getUserVisitCount(Long userId) {
        String key = "user:visit:count:" + userId;
        return redisTemplate.opsForValue().increment(key, 1);
    }
    
    // 3. 分布式锁
    public boolean acquireLock(String lockKey, String lockValue, int expireSeconds) {
        Boolean result = redisTemplate.opsForValue().setIfAbsent(lockKey, lockValue, 
                                                                expireSeconds, TimeUnit.SECONDS);
        return result != null && result;
    }
    
    // 4. 会话存储
    public void storeSession(String sessionId, String sessionData) {
        String key = "session:" + sessionId;
        redisTemplate.opsForValue().set(key, sessionData, 1800, TimeUnit.SECONDS);
    }
    
    // 5. 限流计数器
    public boolean isAllowed(String key, int maxRequests, int windowSeconds) {
        Long current = redisTemplate.opsForValue().increment(key, 1);
        if (current == 1) {
            redisTemplate.expire(key, windowSeconds, TimeUnit.SECONDS);
        }
        return current <= maxRequests;
    }
}
```

### 2. Hash（哈希）

Hash是一个键值对集合，适合存储对象。它允许对单个字段进行操作，而不需要获取整个对象。

#### 基本操作

```java
// Redis Hash操作示例
@Service
public class RedisHashOperations {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 设置哈希字段
    public void setHashField(String key, String field, Object value) {
        redisTemplate.opsForHash().put(key, field, value);
    }
    
    // 获取哈希字段
    public Object getHashField(String key, String field) {
        return redisTemplate.opsForHash().get(key, field);
    }
    
    // 设置多个哈希字段
    public void setMultipleHashFields(String key, Map<String, Object> fieldMap) {
        redisTemplate.opsForHash().putAll(key, fieldMap);
    }
    
    // 获取所有哈希字段
    public Map<Object, Object> getAllHashFields(String key) {
        return redisTemplate.opsForHash().entries(key);
    }
    
    // 删除哈希字段
    public Long deleteHashFields(String key, Object... fields) {
        return redisTemplate.opsForHash().delete(key, fields);
    }
    
    // 检查哈希字段是否存在
    public boolean hasHashField(String key, String field) {
        return redisTemplate.opsForHash().hasKey(key, field);
    }
    
    // 增加哈希字段数值
    public Long incrementHashField(String key, String field, long delta) {
        return redisTemplate.opsForHash().increment(key, field, delta);
    }
    
    // 获取哈希字段数量
    public Long getHashSize(String key) {
        return redisTemplate.opsForHash().size(key);
    }
    
    // 获取所有哈希字段名
    public Set<Object> getHashKeys(String key) {
        return redisTemplate.opsForHash().keys(key);
    }
    
    // 获取所有哈希字段值
    public List<Object> getHashValues(String key) {
        return redisTemplate.opsForHash().values(key);
    }
}
```

#### 使用场景

```java
// Hash数据结构的常见使用场景
@Service
public class HashUseCases {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 1. 存储用户信息
    public void storeUserInfo(Long userId, Map<String, Object> userInfo) {
        String key = "user:info:" + userId;
        redisTemplate.opsForHash().putAll(key, userInfo);
        redisTemplate.expire(key, 3600, TimeUnit.SECONDS);
    }
    
    // 2. 存储商品详情
    public void storeProductInfo(Long productId, Product product) {
        String key = "product:info:" + productId;
        Map<String, Object> productMap = new HashMap<>();
        productMap.put("name", product.getName());
        productMap.put("price", product.getPrice());
        productMap.put("description", product.getDescription());
        productMap.put("categoryId", product.getCategoryId());
        redisTemplate.opsForHash().putAll(key, productMap);
        redisTemplate.expire(key, 7200, TimeUnit.SECONDS);
    }
    
    // 3. 购物车存储
    public void addToCart(Long userId, Long productId, int quantity) {
        String key = "cart:" + userId;
        String field = "product:" + productId;
        redisTemplate.opsForHash().put(key, field, quantity);
        redisTemplate.expire(key, 86400, TimeUnit.SECONDS); // 24小时过期
    }
    
    // 4. 用户积分系统
    public Long addUserPoints(Long userId, Long points) {
        String key = "user:points:" + userId;
        return redisTemplate.opsForHash().increment(key, "total", points);
    }
    
    // 5. 配置信息存储
    public void storeSystemConfig(String configName, Map<String, String> config) {
        String key = "config:" + configName;
        redisTemplate.opsForHash().putAll(key, config);
    }
}
```

### 3. List（列表）

List是简单的字符串列表，按照插入顺序排序。它支持从两端插入和弹出元素，是一个双向链表。

#### 基本操作

```java
// Redis List操作示例
@Service
public class RedisListOperations {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 从左侧推入元素
    public Long leftPush(String key, String value) {
        return redisTemplate.opsForList().leftPush(key, value);
    }
    
    // 从右侧推入元素
    public Long rightPush(String key, String value) {
        return redisTemplate.opsForList().rightPush(key, value);
    }
    
    // 从左侧弹出元素
    public String leftPop(String key) {
        return redisTemplate.opsForList().leftPop(key);
    }
    
    // 从右侧弹出元素
    public String rightPop(String key) {
        return redisTemplate.opsForList().rightPop(key);
    }
    
    // 阻塞式从左侧弹出元素
    public String leftPopBlocking(String key, int timeoutSeconds) {
        return redisTemplate.opsForList().leftPop(key, timeoutSeconds, TimeUnit.SECONDS);
    }
    
    // 获取列表长度
    public Long getListSize(String key) {
        return redisTemplate.opsForList().size(key);
    }
    
    // 获取指定范围的元素
    public List<String> getRange(String key, int start, int end) {
        return redisTemplate.opsForList().range(key, start, end);
    }
    
    // 设置指定位置的元素
    public void setElement(String key, int index, String value) {
        redisTemplate.opsForList().set(key, index, value);
    }
    
    // 删除指定值的元素
    public Long removeElement(String key, int count, String value) {
        return redisTemplate.opsForList().remove(key, count, value);
    }
    
    // 获取指定位置的元素
    public String getElement(String key, int index) {
        return redisTemplate.opsForList().index(key, index);
    }
    
    // 修剪列表
    public void trimList(String key, int start, int end) {
        redisTemplate.opsForList().trim(key, start, end);
    }
}
```

#### 使用场景

```java
// List数据结构的常见使用场景
@Service
public class ListUseCases {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 1. 消息队列
    public void sendMessage(String queueName, String message) {
        redisTemplate.opsForList().leftPush("queue:" + queueName, message);
    }
    
    public String consumeMessage(String queueName) {
        return redisTemplate.opsForList().rightPop("queue:" + queueName);
    }
    
    public String consumeMessageBlocking(String queueName, int timeoutSeconds) {
        return redisTemplate.opsForList().rightPop("queue:" + queueName, timeoutSeconds, TimeUnit.SECONDS);
    }
    
    // 2. 最新消息列表
    public void addLatestMessage(Long userId, String message) {
        String key = "user:messages:" + userId;
        redisTemplate.opsForList().leftPush(key, message);
        // 只保留最新的100条消息
        redisTemplate.opsForList().trim(key, 0, 99);
    }
    
    // 3. 任务队列
    public void addTask(String taskType, String taskData) {
        redisTemplate.opsForList().leftPush("task:" + taskType, taskData);
    }
    
    public String getTask(String taskType) {
        return redisTemplate.opsForList().rightPop("task:" + taskType);
    }
    
    // 4. 访问历史记录
    public void addVisitHistory(Long userId, String url) {
        String key = "user:history:" + userId;
        redisTemplate.opsForList().leftPush(key, url);
        // 只保留最近的50条记录
        redisTemplate.opsForList().trim(key, 0, 49);
    }
    
    // 5. 社交Feed流
    public void addFeedItem(Long userId, String feedItem) {
        String key = "user:feed:" + userId;
        redisTemplate.opsForList().leftPush(key, feedItem);
        // 只保留最近的200条Feed
        redisTemplate.opsForList().trim(key, 0, 199);
    }
}
```

### 4. Set（集合）

Set是字符串类型的无序集合，不允许重复元素。它支持集合运算，如交集、并集、差集等。

#### 基本操作

```java
// Redis Set操作示例
@Service
public class RedisSetOperations {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 添加元素
    public Long addElements(String key, String... values) {
        return redisTemplate.opsForSet().add(key, values);
    }
    
    // 删除元素
    public Long removeElements(String key, Object... values) {
        return redisTemplate.opsForSet().remove(key, values);
    }
    
    // 检查元素是否存在
    public Boolean isMember(String key, String value) {
        return redisTemplate.opsForSet().isMember(key, value);
    }
    
    // 获取集合所有元素
    public Set<String> getAllMembers(String key) {
        return redisTemplate.opsForSet().members(key);
    }
    
    // 获取集合大小
    public Long getSetSize(String key) {
        return redisTemplate.opsForSet().size(key);
    }
    
    // 随机弹出元素
    public String popRandomElement(String key) {
        return redisTemplate.opsForSet().pop(key);
    }
    
    // 随机获取元素（不删除）
    public String getRandomElement(String key) {
        return redisTemplate.opsForSet().randomMember(key);
    }
    
    // 随机获取多个元素（不删除）
    public Set<String> getRandomElements(String key, int count) {
        return redisTemplate.opsForSet().randomMembers(key, count);
    }
    
    // 集合交集
    public Set<String> intersectSets(String key1, String key2) {
        return redisTemplate.opsForSet().intersect(key1, key2);
    }
    
    // 集合并集
    public Set<String> unionSets(String key1, String key2) {
        return redisTemplate.opsForSet().union(key1, key2);
    }
    
    // 集合差集
    public Set<String> differenceSets(String key1, String key2) {
        return redisTemplate.opsForSet().difference(key1, key2);
    }
    
    // 将交集结果存储到新集合
    public Long intersectAndStore(String destinationKey, String key1, String key2) {
        return redisTemplate.opsForSet().intersectAndStore(Arrays.asList(key1, key2), destinationKey);
    }
    
    // 将并集结果存储到新集合
    public Long unionAndStore(String destinationKey, String key1, String key2) {
        return redisTemplate.opsForSet().unionAndStore(Arrays.asList(key1, key2), destinationKey);
    }
    
    // 将差集结果存储到新集合
    public Long differenceAndStore(String destinationKey, String key1, String key2) {
        return redisTemplate.opsForSet().differenceAndStore(Arrays.asList(key1, key2), destinationKey);
    }
}
```

#### 使用场景

```java
// Set数据结构的常见使用场景
@Service
public class SetUseCases {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 1. 标签系统
    public void addTagsToItem(Long itemId, Set<String> tags) {
        String key = "item:tags:" + itemId;
        redisTemplate.opsForSet().add(key, tags.toArray(new String[0]));
    }
    
    public Set<String> getItemTags(Long itemId) {
        String key = "item:tags:" + itemId;
        return redisTemplate.opsForSet().members(key);
    }
    
    // 2. 好友关系
    public void addFriend(Long userId, Long friendId) {
        String key = "user:friends:" + userId;
        redisTemplate.opsForSet().add(key, friendId.toString());
    }
    
    public Set<String> getFriends(Long userId) {
        String key = "user:friends:" + userId;
        return redisTemplate.opsForSet().members(key);
    }
    
    // 3. 共同关注
    public Set<String> getCommonFollowers(Long userId1, Long userId2) {
        String key1 = "user:followers:" + userId1;
        String key2 = "user:followers:" + userId2;
        return redisTemplate.opsForSet().intersect(key1, key2);
    }
    
    // 4. 推荐系统
    public Set<String> getRecommendedItems(Long userId, Set<Long> friendIds) {
        // 获取用户自己的兴趣标签
        Set<String> userTags = redisTemplate.opsForSet().members("user:tags:" + userId);
        
        // 获取好友的兴趣标签
        Set<String> friendTags = new HashSet<>();
        for (Long friendId : friendIds) {
            Set<String> tags = redisTemplate.opsForSet().members("user:tags:" + friendId);
            friendTags.addAll(tags);
        }
        
        // 找出好友有但用户没有的标签
        return redisTemplate.opsForSet().difference(
            "temp:friend_tags:" + userId, 
            "temp:user_tags:" + userId
        );
    }
    
    // 5. IP黑白名单
    public void addToBlacklist(Set<String> ipAddresses) {
        redisTemplate.opsForSet().add("ip:blacklist", ipAddresses.toArray(new String[0]));
    }
    
    public boolean isBlacklisted(String ipAddress) {
        return redisTemplate.opsForSet().isMember("ip:blacklist", ipAddress);
    }
}
```

### 5. SortedSet（有序集合）

SortedSet是集合的一个升级版，每个元素都会关联一个分数，用于排序。元素按分数从小到大排序。

#### 基本操作

```java
// Redis SortedSet操作示例
@Service
public class RedisSortedSetOperations {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 添加元素
    public Boolean addElement(String key, String value, double score) {
        return redisTemplate.opsForZSet().add(key, value, score);
    }
    
    // 添加多个元素
    public Long addElements(String key, Set<ZSetOperations.TypedTuple<String>> tuples) {
        return redisTemplate.opsForZSet().add(key, tuples);
    }
    
    // 删除元素
    public Long removeElements(String key, Object... values) {
        return redisTemplate.opsForZSet().remove(key, values);
    }
    
    // 增加元素分数
    public Double incrementScore(String key, String value, double delta) {
        return redisTemplate.opsForZSet().incrementScore(key, value, delta);
    }
    
    // 获取元素排名（从0开始）
    public Long getRank(String key, String value) {
        return redisTemplate.opsForZSet().rank(key, value);
    }
    
    // 获取元素反向排名（从0开始）
    public Long getReverseRank(String key, String value) {
        return redisTemplate.opsForZSet().reverseRank(key, value);
    }
    
    // 获取元素分数
    public Double getScore(String key, String value) {
        return redisTemplate.opsForZSet().score(key, value);
    }
    
    // 获取指定范围的元素
    public Set<String> getRange(String key, int start, int end) {
        return redisTemplate.opsForZSet().range(key, start, end);
    }
    
    // 获取指定范围的元素（按分数）
    public Set<String> getRangeByScore(String key, double min, double max) {
        return redisTemplate.opsForZSet().rangeByScore(key, min, max);
    }
    
    // 获取指定范围的元素（带分数）
    public Set<ZSetOperations.TypedTuple<String>> getRangeWithScores(String key, int start, int end) {
        return redisTemplate.opsForZSet().rangeWithScores(key, start, end);
    }
    
    // 获取指定范围的元素（按分数，带分数）
    public Set<ZSetOperations.TypedTuple<String>> getRangeByScoreWithScores(String key, double min, double max) {
        return redisTemplate.opsForZSet().rangeByScoreWithScores(key, min, max);
    }
    
    // 获取反向指定范围的元素
    public Set<String> getReverseRange(String key, int start, int end) {
        return redisTemplate.opsForZSet().reverseRange(key, start, end);
    }
    
    // 获取集合大小
    public Long getSortedSetSize(String key) {
        return redisTemplate.opsForZSet().zCard(key);
    }
    
    // 获取指定分数范围的元素数量
    public Long getCountByScore(String key, double min, double max) {
        return redisTemplate.opsForZSet().count(key, min, max);
    }
    
    // 删除指定分数范围的元素
    public Long removeRangeByScore(String key, double min, double max) {
        return redisTemplate.opsForZSet().removeRangeByScore(key, min, max);
    }
}
```

#### 使用场景

```java
// SortedSet数据结构的常见使用场景
@Service
public class SortedSetUseCases {
    @Autowired
    private RedisTemplate<String, String> redisTemplate;
    
    // 1. 排行榜
    public void updatePlayerScore(Long playerId, double score) {
        String key = "leaderboard:game1";
        redisTemplate.opsForZSet().add(key, playerId.toString(), score);
    }
    
    public Set<String> getTopPlayers(int topN) {
        String key = "leaderboard:game1";
        return redisTemplate.opsForZSet().reverseRange(key, 0, topN - 1);
    }
    
    public Long getPlayerRank(Long playerId) {
        String key = "leaderboard:game1";
        Long rank = redisTemplate.opsForZSet().reverseRank(key, playerId.toString());
        return rank != null ? rank + 1 : null; // 排名从1开始
    }
    
    // 2. 时间轴
    public void addTimelineItem(Long userId, String itemId) {
        String key = "timeline:" + userId;
        long timestamp = System.currentTimeMillis();
        redisTemplate.opsForZSet().add(key, itemId, timestamp);
        // 只保留最近的1000条记录
        redisTemplate.opsForZSet().removeRange(key, 0, -1001);
    }
    
    public Set<String> getRecentItems(Long userId, int count) {
        String key = "timeline:" + userId;
        return redisTemplate.opsForZSet().reverseRange(key, 0, count - 1);
    }
    
    // 3. 延迟任务
    public void addDelayedTask(String taskId, long executeTime) {
        String key = "delayed:tasks";
        redisTemplate.opsForZSet().add(key, taskId, executeTime);
    }
    
    public Set<String> getReadyTasks() {
        String key = "delayed:tasks";
        long currentTime = System.currentTimeMillis();
        return redisTemplate.opsForZSet().rangeByScore(key, 0, currentTime);
    }
    
    public void removeExecutedTasks(Set<String> taskIds) {
        String key = "delayed:tasks";
        redisTemplate.opsForZSet().remove(key, taskIds.toArray());
    }
    
    // 4. 热门内容
    public void incrementContentViewCount(String contentId) {
        String key = "content:views";
        redisTemplate.opsForZSet().incrementScore(key, contentId, 1);
    }
    
    public Set<String> getHotContents(int count) {
        String key = "content:views";
        return redisTemplate.opsForZSet().reverseRange(key, 0, count - 1);
    }
    
    // 5. 积分商城
    public void updateProductScore(Long productId, double score) {
        String key = "products:score";
        redisTemplate.opsForZSet().add(key, productId.toString(), score);
    }
    
    public Set<String> getRecommendedProducts(double minScore, int count) {
        String key = "products:scoreproducts:score";
        return redisTemplate.opsForZSet().reverseRangeByScore(key, minScore, Double.MAX_VALUE, 0, count);
    }
}
```

## Redis高级特性

### 1. 事务支持

```java
// Redis事务示例
@Service
public class RedisTransactionExample {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    public void executeTransaction() {
        // 开启事务
        redisTemplate.setEnableTransactionSupport(true);
        redisTemplate.multi();
        
        try {
            // 执行多个操作
            redisTemplate.opsForValue().set("key1", "value1");
            redisTemplate.opsForValue().set("key2", "value2");
            redisTemplate.opsForValue().increment("counter", 1);
            
            // 提交事务
            List<Object> results = redisTemplate.exec();
            log.info("Transaction executed successfully: " + results);
        } catch (Exception e) {
            // 回滚事务
            redisTemplate.discard();
            log.error("Transaction failed", e);
        }
    }
}
```

### 2. Lua脚本

```java
// Redis Lua脚本示例
@Service
public class RedisLuaScriptExample {
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;
    
    // 使用Lua脚本实现原子性的计数器增加和过期设置
    public Long atomicIncrementWithExpire(String key, long increment, int expireSeconds) {
        String script = 
            "local result = redis.call('INCRBY', KEYS[1], ARGV[1]) " +
            "redis.call('EXPIRE', KEYS[1], ARGV[2]) " +
            "return result";
        
        DefaultRedisScript<Long> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(script);
        redisScript.setResultType(Long.class);
        
        List<String> keys = Collections.singletonList(key);
        List<String> args = Arrays.asList(String.valueOf(increment), 
                                         String.valueOf(expireSeconds));
        
        return redisTemplate.execute(redisScript, keys, args.toArray());
    }
}
```

### 3. 发布订阅

```java
// Redis发布订阅示例
@Component
public class RedisPubSubExample {
    
    // 消息发布者
    @Service
    public static class MessagePublisher {
        @Autowired
        private RedisTemplate<String, Object> redisTemplate;
        
        public void publishMessage(String channel, Object message) {
            redisTemplate.convertAndSend(channel, message);
        }
    }
    
    // 消息订阅者
    @Service
    public static class MessageSubscriber {
        
        @RedisListener(topics = "notification")
        public void handleNotification(String message) {
            log.info("Received notification: " + message);
            // 处理通知消息
        }
        
        @RedisListener(topics = "order_update")
        public void handleOrderUpdate(String message) {
            log.info("Received order update: " + message);
            // 处理订单更新消息
        }
    }
}
```

## 总结

Redis的核心数据结构为构建高性能应用提供了强大的基础。通过合理使用这些数据结构，我们可以：

1. **String**：适用于简单的键值存储、计数器、分布式锁等场景
2. **Hash**：适用于存储对象、用户信息、商品详情等结构化数据
3. **List**：适用于消息队列、最新消息列表、任务队列等场景
4. **Set**：适用于标签系统、好友关系、IP黑白名单等场景
5. **SortedSet**：适用于排行榜、时间轴、延迟任务等需要排序的场景

关键要点：

- 选择合适的数据结构可以显著提高性能和内存利用率
- 合理设置过期时间可以有效管理内存
- 利用Redis的原子性操作可以简化并发控制
- Lua脚本可以实现复杂的原子操作
- 发布订阅模式可以实现系统解耦

在下一节中，我们将深入探讨Redis的高级特性，包括持久化、发布订阅、Stream和模块扩展等。