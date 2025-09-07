---
title: "附录B: Redis Lua脚本示例"
date: 2025-09-07
categories: [DistributedFlowControl]
tags: [DistributedFlowControl]
published: true
---
Redis Lua脚本在分布式限流系统中扮演着至关重要的角色，它能够保证限流操作的原子性，避免竞态条件，提高系统性能。本附录将提供一系列实用的Redis Lua脚本示例，涵盖固定窗口计数器、滑动窗口计数器、令牌桶算法、漏桶算法等常见的限流算法实现，以及一些高级特性和最佳实践。

## Lua脚本基础

### Lua脚本执行原理

Redis Lua脚本的执行具有以下特点：

1. **原子性**：脚本在Redis中以原子方式执行，不会被其他命令中断
2. **高性能**：脚本在服务器端执行，减少网络往返次数
3. **灵活性**：支持复杂的逻辑处理和条件判断
4. **安全性**：脚本在沙箱环境中运行，保证安全性

### 基本语法示例

```lua
-- Redis Lua脚本基本语法示例
-- 获取键值
local current = redis.call('GET', KEYS[1])

-- 设置键值
redis.call('SET', KEYS[1], ARGV[1])

-- 原子自增
local newValue = redis.call('INCR', KEYS[1])

-- 条件判断
if current == false then
    -- 处理键不存在的情况
end

-- 返回结果
return {current, newValue}
```

## 固定窗口计数器

### 基础实现

```lua
-- 固定窗口计数器实现
local function fixed_window_counter()
    -- 参数说明:
    -- KEYS[1]: 计数器键名
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(秒)
    -- ARGV[3]: 请求权重(默认为1)
    
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local weight = tonumber(ARGV[3]) or 1
    
    -- 获取当前计数
    local current = redis.call('GET', key)
    if current == false then
        current = 0
    end
    
    -- 检查是否超过限制
    if tonumber(current) + weight > limit then
        -- 超过限制，拒绝请求
        return {0, current, limit}
    else
        -- 未超过限制，增加计数
        local new_value = redis.call('INCRBY', key, weight)
        -- 设置过期时间
        redis.call('EXPIRE', key, window)
        return {1, new_value, limit}
    end
end

-- 调用函数
return fixed_window_counter()
```

### 增强版实现

```lua
-- 增强版固定窗口计数器
local function enhanced_fixed_window_counter()
    -- 参数说明:
    -- KEYS[1]: 计数器键名
    -- KEYS[2]: 重置时间键名
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(秒)
    -- ARGV[3]: 请求权重(默认为1)
    -- ARGV[4]: 当前时间戳(毫秒)
    
    local counter_key = KEYS[1]
    local reset_key = KEYS[2]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local weight = tonumber(ARGV[3]) or 1
    local current_time = tonumber(ARGV[4])
    
    -- 获取上次重置时间
    local last_reset = redis.call('GET', reset_key)
    if last_reset == false then
        last_reset = 0
    end
    
    -- 检查是否需要重置计数器
    if current_time - tonumber(last_reset) >= window * 1000 then
        -- 重置计数器
        redis.call('SET', counter_key, 0)
        redis.call('SET', reset_key, current_time)
    end
    
    -- 获取当前计数
    local current = redis.call('GET', counter_key)
    if current == false then
        current = 0
    end
    
    -- 检查是否超过限制
    if tonumber(current) + weight > limit then
        -- 超过限制，拒绝请求
        local reset_time = tonumber(last_reset) + window * 1000
        local wait_time = math.ceil((reset_time - current_time) / 1000)
        return {0, current, limit, math.max(0, wait_time)}
    else
        -- 未超过限制，增加计数
        local new_value = redis.call('INCRBY', counter_key, weight)
        local reset_time = tonumber(last_reset) + window * 1000
        local remaining_time = math.ceil((reset_time - current_time) / 1000)
        return {1, new_value, limit, math.max(0, remaining_time)}
    end
end

-- 调用函数
return enhanced_fixed_window_counter()
```

## 滑动窗口计数器

### 基于ZSET的实现

```lua
-- 基于ZSET的滑动窗口计数器
local function sliding_window_counter()
    -- 参数说明:
    -- KEYS[1]: ZSET键名
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(毫秒)
    -- ARGV[3]: 当前时间戳(毫秒)
    -- ARGV[4]: 请求权重(默认为1)
    -- ARGV[5]: 请求标识(用于去重)
    
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local current_time = tonumber(ARGV[3])
    local weight = tonumber(ARGV[4]) or 1
    local request_id = ARGV[5]
    
    -- 计算窗口起始时间
    local window_start = current_time - window
    
    -- 移除窗口外的旧记录
    redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
    
    -- 检查是否已存在相同的请求标识
    if request_id and request_id ~= "" then
        local existing = redis.call('ZSCORE', key, request_id)
        if existing ~= false then
            -- 请求已存在，不重复计数
            local current_count = redis.call('ZCARD', key)
            return {1, current_count, limit, window_start}
        end
    end
    
    -- 获取当前窗口内的请求数量
    local current_count = redis.call('ZCARD', key)
    
    -- 检查是否超过限制
    if current_count + weight > limit then
        -- 超过限制，拒绝请求
        return {0, current_count, limit, window_start}
    else
        -- 未超过限制，添加新请求
        local score = current_time
        local member = request_id or tostring(current_time) .. ":" .. math.random(1000000)
        redis.call('ZADD', key, score, member)
        -- 设置过期时间
        redis.call('PEXPIRE', key, window)
        return {1, current_count + weight, limit, window_start}
    end
end

-- 调用函数
return sliding_window_counter()
```

### 优化版滑动窗口

```lua
-- 优化版滑动窗口计数器
local function optimized_sliding_window()
    -- 参数说明:
    -- KEYS[1]: ZSET键名
    -- KEYS[2]: 计数器键名(用于缓存)
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(毫秒)
    -- ARGV[3]: 当前时间戳(毫秒)
    -- ARGV[4]: 请求权重(默认为1)
    
    local zset_key = KEYS[1]
    local counter_key = KEYS[2]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local current_time = tonumber(ARGV[3])
    local weight = tonumber(ARGV[4]) or 1
    
    -- 计算窗口起始时间
    local window_start = current_time - window
    
    -- 尝试从缓存获取计数
    local cached_count = redis.call('GET', counter_key)
    local current_count
    
    if cached_count ~= false then
        -- 使用缓存的计数
        current_count = tonumber(cached_count)
    else
        -- 重新计算并缓存
        redis.call('ZREMRANGEBYSCORE', zset_key, 0, window_start)
        current_count = redis.call('ZCARD', zset_key)
        redis.call('SET', counter_key, current_count, 'PX', 1000) -- 缓存1秒
    end
    
    -- 检查是否超过限制
    if current_count + weight > limit then
        -- 超过限制，拒绝请求
        return {0, current_count, limit}
    else
        -- 未超过限制，添加新请求
        redis.call('ZADD', zset_key, current_time, tostring(current_time) .. ":" .. math.random(1000000))
        redis.call('ZREMRANGEBYSCORE', zset_key, 0, window_start)
        redis.call('INCR', counter_key)
        redis.call('PEXPIRE', zset_key, window)
        redis.call('PEXPIRE', counter_key, 1000)
        return {1, current_count + weight, limit}
    end
end

-- 调用函数
return optimized_sliding_window()
```

## 令牌桶算法

### 基础令牌桶实现

```lua
-- 基础令牌桶算法实现
local function token_bucket()
    -- 参数说明:
    -- KEYS[1]: 令牌数量键名
    -- KEYS[2]: 最后填充时间键名
    -- ARGV[1]: 桶容量
    -- ARGV[2]: 令牌生成速率(每秒)
    -- ARGV[3]: 当前时间戳(毫秒)
    -- ARGV[4]: 请求消耗令牌数(默认为1)
    
    local tokens_key = KEYS[1]
    local timestamp_key = KEYS[2]
    local capacity = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local current_time = tonumber(ARGV[3])
    local requested_tokens = tonumber(ARGV[4]) or 1
    
    -- 获取当前令牌数和最后填充时间
    local current_tokens = redis.call('GET', tokens_key)
    local last_refill = redis.call('GET', timestamp_key)
    
    -- 初始化
    if current_tokens == false then
        current_tokens = capacity
    else
        current_tokens = tonumber(current_tokens)
    end
    
    if last_refill == false then
        last_refill = current_time
    else
        last_refill = tonumber(last_refill)
    end
    
    -- 计算需要添加的令牌数
    local time_passed = current_time - last_refill
    if time_passed > 0 then
        local new_tokens = (time_passed / 1000) * rate
        current_tokens = math.min(capacity, current_tokens + new_tokens)
        last_refill = current_time
    end
    
    -- 检查是否有足够的令牌
    if current_tokens >= requested_tokens then
        -- 有足够的令牌，消耗令牌
        current_tokens = current_tokens - requested_tokens
        redis.call('SET', tokens_key, current_tokens)
        redis.call('SET', timestamp_key, last_refill)
        -- 设置过期时间
        local expire_time = math.ceil((capacity - current_tokens) / rate) + 1
        redis.call('EXPIRE', tokens_key, expire_time)
        redis.call('EXPIRE', timestamp_key, expire_time)
        return {1, current_tokens, capacity, 0} -- 允许通过，剩余令牌数，容量，等待时间
    else
        -- 没有足够的令牌，计算等待时间
        local tokens_needed = requested_tokens - current_tokens
        local wait_time = math.ceil(tokens_needed / rate)
        return {0, current_tokens, capacity, wait_time} -- 拒绝，当前令牌数，容量，等待时间(秒)
    end
end

-- 调用函数
return token_bucket()
```

### 增强版令牌桶

```lua
-- 增强版令牌桶算法
local function enhanced_token_bucket()
    -- 参数说明:
    -- KEYS[1]: 令牌数量键名
    -- KEYS[2]: 最后填充时间键名
    -- KEYS[3]: 配置键名
    -- ARGV[1]: 当前时间戳(毫秒)
    -- ARGV[2]: 请求消耗令牌数(默认为1)
    -- ARGV[3]: 客户端标识(用于独立配置)
    
    local tokens_key = KEYS[1]
    local timestamp_key = KEYS[2]
    local config_key = KEYS[3]
    local current_time = tonumber(ARGV[1])
    local requested_tokens = tonumber(ARGV[2]) or 1
    local client_id = ARGV[3]
    
    -- 获取配置信息
    local config = redis.call('HGETALL', config_key)
    local capacity = 100
    local rate = 10
    
    -- 解析配置
    for i = 1, #config, 2 do
        if config[i] == 'capacity' then
            capacity = tonumber(config[i + 1])
        elseif config[i] == 'rate' then
            rate = tonumber(config[i + 1])
        end
    end
    
    -- 如果有客户端特定配置
    if client_id and client_id ~= "" then
        local client_config = redis.call('HGETALL', config_key .. ":" .. client_id)
        for i = 1, #client_config, 2 do
            if client_config[i] == 'capacity' then
                capacity = tonumber(client_config[i + 1])
            elseif client_config[i] == 'rate' then
                rate = tonumber(client_config[i + 1])
            end
        end
    end
    
    -- 获取当前令牌数和最后填充时间
    local current_tokens = redis.call('GET', tokens_key)
    local last_refill = redis.call('GET', timestamp_key)
    
    -- 初始化
    if current_tokens == false then
        current_tokens = capacity
    else
        current_tokens = tonumber(current_tokens)
    end
    
    if last_refill == false then
        last_refill = current_time
    else
        last_refill = tonumber(last_refill)
    end
    
    -- 计算需要添加的令牌数
    local time_passed = current_time - last_refill
    if time_passed > 0 then
        local new_tokens = (time_passed / 1000) * rate
        current_tokens = math.min(capacity, current_tokens + new_tokens)
        last_refill = current_time
    end
    
    -- 检查是否有足够的令牌
    if current_tokens >= requested_tokens then
        -- 有足够的令牌，消耗令牌
        current_tokens = current_tokens - requested_tokens
        redis.call('SET', tokens_key, current_tokens)
        redis.call('SET', timestamp_key, last_refill)
        -- 设置过期时间
        local expire_time = math.ceil((capacity - current_tokens) / rate) + 10
        redis.call('EXPIRE', tokens_key, expire_time)
        redis.call('EXPIRE', timestamp_key, expire_time)
        return {1, current_tokens, capacity, 0}
    else
        -- 没有足够的令牌，计算等待时间
        local tokens_needed = requested_tokens - current_tokens
        local wait_time = math.ceil((tokens_needed / rate) * 1000) -- 毫秒
        return {0, current_tokens, capacity, wait_time}
    end
end

-- 调用函数
return enhanced_token_bucket()
```

## 漏桶算法

### 漏桶算法实现

```lua
-- 漏桶算法实现
local function leaky_bucket()
    -- 参数说明:
    -- KEYS[1]: 队列键名(list)
    -- KEYS[2]: 最后处理时间键名
    -- ARGV[1]: 桶容量
    -- ARGV[2]: 漏水速率(每秒)
    -- ARGV[3]: 当前时间戳(毫秒)
    -- ARGV[4]: 请求权重(默认为1)
    
    local queue_key = KEYS[1]
    local timestamp_key = KEYS[2]
    local capacity = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local current_time = tonumber(ARGV[3])
    local weight = tonumber(ARGV[4]) or 1
    
    -- 获取队列长度和最后处理时间
    local queue_length = redis.call('LLEN', queue_key)
    local last_process = redis.call('GET', timestamp_key)
    
    -- 初始化最后处理时间
    if last_process == false then
        last_process = current_time
    else
        last_process = tonumber(last_process)
    end
    
    -- 计算可以处理的请求数
    local time_passed = current_time - last_process
    local processable_requests = math.floor((time_passed / 1000) * rate)
    
    -- 处理队列中的请求
    for i = 1, processable_requests do
        local request = redis.call('LPOP', queue_key)
        if request == false then
            break
        end
    end
    
    -- 更新最后处理时间
    local new_last_process = last_process + (processable_requests / rate) * 1000
    redis.call('SET', timestamp_key, new_last_process)
    
    -- 检查队列是否已满
    local current_queue_length = redis.call('LLEN', queue_key)
    if current_queue_length + weight > capacity then
        -- 队列已满，拒绝请求
        return {0, current_queue_length, capacity}
    else
        -- 队列未满，添加请求到队列
        for i = 1, weight do
            redis.call('RPUSH', queue_key, current_time .. ":" .. math.random(1000000))
        end
        -- 设置过期时间
        local expire_time = math.ceil(capacity / rate) + 10
        redis.call('EXPIRE', queue_key, expire_time)
        redis.call('EXPIRE', timestamp_key, expire_time)
        return {1, current_queue_length + weight, capacity}
    end
end

-- 调用函数
return leaky_bucket()
```

## 高级特性脚本

### 多维度限流

```lua
-- 多维度限流实现
local function multi_dimension_rate_limit()
    -- 参数说明:
    -- KEYS[1]: 主维度计数器
    -- KEYS[2]: 次维度计数器1
    -- KEYS[3]: 次维度计数器2
    -- ARGV[1]: 主维度限制
    -- ARGV[2]: 次维度1限制
    -- ARGV[3]: 次维度2限制
    -- ARGV[4]: 时间窗口(秒)
    -- ARGV[5]: 当前时间戳(秒)
    
    local main_key = KEYS[1]
    local dim1_key = KEYS[2]
    local dim2_key = KEYS[3]
    local main_limit = tonumber(ARGV[1])
    local dim1_limit = tonumber(ARGV[2])
    local dim2_limit = tonumber(ARGV[3])
    local window = tonumber(ARGV[4])
    local current_time = tonumber(ARGV[5])
    
    -- 检查主维度
    local main_count = redis.call('GET', main_key)
    if main_count == false then
        main_count = 0
    end
    if tonumber(main_count) >= main_limit then
        return {0, "main_dimension_exceeded", main_count, main_limit}
    end
    
    -- 检查次维度1
    local dim1_count = redis.call('GET', dim1_key)
    if dim1_count == false then
        dim1_count = 0
    end
    if tonumber(dim1_count) >= dim1_limit then
        return {0, "dimension1_exceeded", dim1_count, dim1_limit}
    end
    
    -- 检查次维度2
    local dim2_count = redis.call('GET', dim2_key)
    if dim2_count == false then
        dim2_count = 0
    end
    if tonumber(dim2_count) >= dim2_limit then
        return {0, "dimension2_exceeded", dim2_count, dim2_limit}
    end
    
    -- 所有维度都未超过限制，增加计数
    redis.call('INCR', main_key)
    redis.call('INCR', dim1_key)
    redis.call('INCR', dim2_key)
    
    -- 设置过期时间
    redis.call('EXPIRE', main_key, window)
    redis.call('EXPIRE', dim1_key, window)
    redis.call('EXPIRE', dim2_key, window)
    
    return {1, "allowed", 
            tonumber(main_count) + 1, main_limit,
            tonumber(dim1_count) + 1, dim1_limit,
            tonumber(dim2_count) + 1, dim2_limit}
end

-- 调用函数
return multi_dimension_rate_limit()
```

### 动态限流阈值

```lua
-- 动态限流阈值实现
local function dynamic_rate_limit()
    -- 参数说明:
    -- KEYS[1]: 计数器键名
    -- KEYS[2]: 配置键名
    -- KEYS[3]: 负载指标键名
    -- ARGV[1]: 时间窗口(秒)
    -- ARGV[2]: 当前时间戳(秒)
    -- ARGV[3]: 请求权重(默认为1)
    
    local counter_key = KEYS[1]
    local config_key = KEYS[2]
    local load_key = KEYS[3]
    local window = tonumber(ARGV[1])
    local current_time = tonumber(ARGV[2])
    local weight = tonumber(ARGV[3]) or 1
    
    -- 获取基础配置
    local base_limit = tonumber(redis.call('HGET', config_key, 'base_limit')) or 1000
    local min_limit = tonumber(redis.call('HGET', config_key, 'min_limit')) or 100
    local max_limit = tonumber(redis.call('HGET', config_key, 'max_limit')) or 5000
    
    -- 获取系统负载指标
    local cpu_load = tonumber(redis.call('GET', load_key .. ':cpu')) or 50
    local memory_load = tonumber(redis.call('GET', load_key .. ':memory')) or 50
    
    -- 根据负载动态调整限流阈值
    local load_factor = 1.0
    if cpu_load > 80 or memory_load > 80 then
        -- 高负载时降低限流阈值
        load_factor = 0.5
    elseif cpu_load > 60 or memory_load > 60 then
        -- 中等负载时适度降低限流阈值
        load_factor = 0.7
    elseif cpu_load < 30 and memory_load < 30 then
        -- 低负载时提高限流阈值
        load_factor = 1.2
    end
    
    -- 计算动态限流阈值
    local dynamic_limit = math.max(min_limit, 
                                 math.min(max_limit, 
                                        math.floor(base_limit * load_factor)))
    
    -- 获取当前计数
    local current_count = redis.call('GET', counter_key)
    if current_count == false then
        current_count = 0
    end
    
    -- 检查是否超过动态限制
    if tonumber(current_count) + weight > dynamic_limit then
        return {0, current_count, dynamic_limit, load_factor}
    else
        -- 未超过限制，增加计数
        local new_count = redis.call('INCRBY', counter_key, weight)
        redis.call('EXPIRE', counter_key, window)
        return {1, new_count, dynamic_limit, load_factor}
    end
end

-- 调用函数
return dynamic_rate_limit()
```

## 最佳实践示例

### 错误处理和重试机制

```lua
-- 带错误处理的限流脚本
local function rate_limit_with_error_handling()
    -- 参数说明:
    -- KEYS[1]: 计数器键名
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(秒)
    -- ARGV[3]: 重试次数
    -- ARGV[4]: 重试间隔(毫秒)
    
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local max_retries = tonumber(ARGV[3]) or 3
    local retry_interval = tonumber(ARGV[4]) or 100
    
    local attempt = 0
    
    while attempt < max_retries do
        attempt = attempt + 1
        
        local success, result = pcall(function()
            -- 获取当前计数
            local current = redis.call('GET', key)
            if current == false then
                current = 0
            end
            
            -- 检查是否超过限制
            if tonumber(current) >= limit then
                return {0, current, limit}
            else
                -- 增加计数
                local new_value = redis.call('INCR', key)
                redis.call('EXPIRE', key, window)
                return {1, new_value, limit}
            end
        end)
        
        if success then
            return result
        else
            -- 记录错误
            redis.log(redis.LOG_WARNING, "Rate limit script error (attempt " .. attempt .. "): " .. tostring(result))
            
            -- 如果不是最后一次尝试，等待后重试
            if attempt < max_retries then
                redis.call('EVAL', 'redis.call("PING")', 0) -- 简单的延迟
            end
        end
    end
    
    -- 所有尝试都失败，返回错误
    return {-1, "Failed after " .. max_retries .. " attempts"}
end

-- 调用函数
return rate_limit_with_error_handling()
```

### 性能优化技巧

```lua
-- 性能优化的限流脚本
local function optimized_rate_limit()
    -- 参数说明:
    -- KEYS[1]: 计数器键名
    -- KEYS[2]: 缓存键名
    -- ARGV[1]: 限流阈值
    -- ARGV[2]: 时间窗口(秒)
    
    local counter_key = KEYS[1]
    local cache_key = KEYS[2]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    
    -- 首先检查缓存
    local cached_result = redis.call('GET', cache_key)
    if cached_result ~= false then
        local cached_data = cjson.decode(cached_result)
        if cached_data.allowed then
            return {1, cached_data.count, limit}
        else
            return {0, cached_data.count, limit}
        end
    end
    
    -- 缓存未命中，执行实际限流逻辑
    local current = redis.call('GET', counter_key)
    if current == false then
        current = 0
    end
    
    local allowed = tonumber(current) < limit
    local new_count
    
    if allowed then
        new_count = redis.call('INCR', counter_key)
        redis.call('EXPIRE', counter_key, window)
    else
        new_count = tonumber(current)
    end
    
    -- 更新缓存
    local cache_data = {
        allowed = allowed,
        count = new_count,
        timestamp = redis.call('TIME')[1]
    }
    redis.call('SET', cache_key, cjson.encode(cache_data), 'EX', 1)
    
    if allowed then
        return {1, new_count, limit}
    else
        return {0, new_count, limit}
    end
end

-- 调用函数
return optimized_rate_limit()
```

## 使用示例

### Java客户端调用

```java
// Java中调用Redis Lua脚本示例
@Component
public class LuaScriptRateLimiter {
    private final RedisTemplate<String, String> redisTemplate;
    private final DefaultRedisScript<List> fixedWindowScript;
    private final DefaultRedisScript<List> slidingWindowScript;
    
    public LuaScriptRateLimiter(RedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
        
        // 加载固定窗口脚本
        this.fixedWindowScript = new DefaultRedisScript<>(
            loadLuaScript("fixed_window_counter.lua"), List.class);
            
        // 加载滑动窗口脚本
        this.slidingWindowScript = new DefaultRedisScript<>(
            loadLuaScript("sliding_window_counter.lua"), List.class);
    }
    
    public boolean tryAcquireFixedWindow(String resource, int limit, int windowSeconds) {
        String key = "rate_limit:fixed:" + resource;
        List<String> keys = Collections.singletonList(key);
        List<String> args = Arrays.asList(
            String.valueOf(limit),
            String.valueOf(windowSeconds),
            "1" // 权重
        );
        
        try {
            List<Long> result = redisTemplate.execute(fixedWindowScript, keys, args.toArray(new String[0]));
            return result != null && !result.isEmpty() && result.get(0) == 1;
        } catch (Exception e) {
            log.error("Failed to execute fixed window rate limit script", e);
            return true; // 失败时允许通过
        }
    }
    
    public boolean tryAcquireSlidingWindow(String resource, int limit, int windowMillis) {
        String key = "rate_limit:sliding:" + resource;
        List<String> keys = Collections.singletonList(key);
        List<String> args = Arrays.asList(
            String.valueOf(limit),
            String.valueOf(windowMillis),
            String.valueOf(System.currentTimeMillis()),
            "1" // 权重
        );
        
        try {
            List<Long> result = redisTemplate.execute(slidingWindowScript, keys, args.toArray(new String[0]));
            return result != null && !result.isEmpty() && result.get(0) == 1;
        } catch (Exception e) {
            log.error("Failed to execute sliding window rate limit script", e);
            return true; // 失败时允许通过
        }
    }
    
    private String loadLuaScript(String scriptName) {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream(scriptName)) {
            if (is != null) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            log.error("Failed to load Lua script: " + scriptName, e);
        }
        return "";
    }
}
```

### Python客户端调用

```python
# Python中调用Redis Lua脚本示例
import redis
import time

class LuaScriptRateLimiter:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        
        # 固定窗口计数器脚本
        self.fixed_window_script = self.redis_client.register_script("""
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local weight = tonumber(ARGV[3]) or 1
            
            local current = redis.call('GET', key)
            if current == false then
                current = 0
            end
            
            if tonumber(current) + weight > limit then
                return {0, current, limit}
            else
                local new_value = redis.call('INCRBY', key, weight)
                redis.call('EXPIRE', key, window)
                return {1, new_value, limit}
            end
        """)
    
    def try_acquire_fixed_window(self, resource, limit, window_seconds):
        """
        尝试获取固定窗口限流许可
        """
        key = f"rate_limit:fixed:{resource}"
        try:
            result = self.fixed_window_script(
                keys=[key],
                args=[str(limit), str(window_seconds), "1"]
            )
            return result[0] == 1
        except Exception as e:
            print(f"Failed to execute rate limit script: {e}")
            return True  # 失败时允许通过
    
    def get_current_count(self, resource):
        """
        获取当前计数
        """
        key = f"rate_limit:fixed:{resource}"
        try:
            current = self.redis_client.get(key)
            return int(current) if current else 0
        except Exception as e:
            print(f"Failed to get current count: {e}")
            return 0

# 使用示例
if __name__ == "__main__":
    limiter = LuaScriptRateLimiter()
    
    # 限制每秒10个请求
    for i in range(15):
        allowed = limiter.try_acquire_fixed_window("test_resource", 10, 1)
        print(f"Request {i+1}: {'Allowed' if allowed else 'Blocked'}")
        time.sleep(0.1)  # 100ms间隔
```

## 调试和监控

### 脚本调试技巧

```lua
-- 带调试信息的限流脚本
local function debug_rate_limit()
    -- 启用调试日志
    redis.log(redis.LOG_DEBUG, "Debug rate limit script started")
    
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    
    redis.log(redis.LOG_DEBUG, "Key: " .. key .. ", Limit: " .. limit .. ", Window: " .. window)
    
    local current = redis.call('GET', key)
    if current == false then
        current = 0
    end
    
    redis.log(redis.LOG_DEBUG, "Current count: " .. current)
    
    if tonumber(current) >= limit then
        redis.log(redis.LOG_DEBUG, "Limit exceeded")
        return {0, current, limit}
    else
        local new_value = redis.call('INCR', key)
        redis.call('EXPIRE', key, window)
        redis.log(redis.LOG_DEBUG, "New count: " .. new_value)
        return {1, new_value, limit}
    end
end

-- 调用函数
return debug_rate_limit()
```

通过以上丰富的Redis Lua脚本示例，您可以根据具体需求选择合适的限流算法实现，并结合实际业务场景进行优化和扩展。这些脚本提供了从基础到高级的各种限流功能，能够满足大多数分布式限流场景的需求。