---
title: 最小可用注册中心
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center]
published: true
---

在理解了服务注册中心的基本原理后，我们来动手实现一个最小可用的注册中心。通过这个实践项目，我们将深入理解注册中心的核心机制，并为后续学习主流框架打下坚实基础。

## 用内存 Map 实现服务注册与发现

我们将使用内存中的数据结构来存储服务实例信息，这是最简单的实现方式。核心数据结构可以定义如下：

```java
// 服务实例信息
class ServiceInstance {
    private String serviceId;    // 服务ID
    private String host;         // 主机地址
    private int port;            // 端口
    private long registerTime;   // 注册时间
    // getter和setter方法
}

// 注册中心核心类
class SimpleRegistry {
    // 使用ConcurrentHashMap存储服务实例信息
    // key: 服务名称, value: 该服务的所有实例列表
    private ConcurrentHashMap<String, List<ServiceInstance>> serviceRegistry = new ConcurrentHashMap<>();
    
    // 注册服务
    public void register(String serviceName, ServiceInstance instance) {
        serviceRegistry.computeIfAbsent(serviceName, k -> new ArrayList<>()).add(instance);
    }
    
    // 发现服务
    public List<ServiceInstance> discover(String serviceName) {
        return serviceRegistry.getOrDefault(serviceName, new ArrayList<>());
    }
    
    // 注销服务
    public void deregister(String serviceName, ServiceInstance instance) {
        List<ServiceInstance> instances = serviceRegistry.get(serviceName);
        if (instances != null) {
            instances.remove(instance);
        }
    }
}
```

## 简单 HTTP API 实现服务查询

为了让其他服务能够与我们的注册中心交互，我们需要提供HTTP API接口：

```java
// 使用简单的HTTP服务器框架（如Spark Java）
import static spark.Spark.*;

public class RegistryServer {
    private SimpleRegistry registry = new SimpleRegistry();
    
    public void start() {
        // 注册服务接口
        post("/register", (req, res) -> {
            // 解析请求参数
            String serviceName = req.queryParams("serviceName");
            String host = req.queryParams("host");
            int port = Integer.parseInt(req.queryParams("port"));
            
            // 创建服务实例
            ServiceInstance instance = new ServiceInstance();
            instance.setServiceId(serviceName);
            instance.setHost(host);
            instance.setPort(port);
            instance.setRegisterTime(System.currentTimeMillis());
            
            // 注册到注册中心
            registry.register(serviceName, instance);
            
            return "Service registered successfully";
        });
        
        // 发现服务接口
        get("/discover/:serviceName", (req, res) -> {
            String serviceName = req.params(":serviceName");
            List<ServiceInstance> instances = registry.discover(serviceName);
            
            // 将结果转换为JSON格式返回
            return new Gson().toJson(instances);
        });
        
        // 注销服务接口
        post("/deregister", (req, res) -> {
            // 解析请求参数
            String serviceName = req.queryParams("serviceName");
            String host = req.queryParams("host");
            int port = Integer.parseInt(req.queryParams("port"));
            
            // 创建服务实例
            ServiceInstance instance = new ServiceInstance();
            instance.setServiceId(serviceName);
            instance.setHost(host);
            instance.setPort(port);
            
            // 从注册中心注销
            registry.deregister(serviceName, instance);
            
            return "Service deregistered successfully";
        });
    }
}
```

## 基于心跳的下线机制

为了确保注册中心中的服务实例信息是实时有效的，我们需要实现心跳机制：

```java
class HeartbeatManager {
    private SimpleRegistry registry;
    private ConcurrentHashMap<String, Long> lastHeartbeatTime = new ConcurrentHashMap<>();
    private long timeout = 30000; // 30秒超时
    
    public HeartbeatManager(SimpleRegistry registry) {
        this.registry = registry;
        // 启动定时任务检查心跳超时
        startHeartbeatChecker();
    }
    
    // 接收心跳
    public void receiveHeartbeat(String serviceName, ServiceInstance instance) {
        String key = serviceName + ":" + instance.getHost() + ":" + instance.getPort();
        lastHeartbeatTime.put(key, System.currentTimeMillis());
    }
    
    // 启动心跳检查器
    private void startHeartbeatChecker() {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> {
            long currentTime = System.currentTimeMillis();
            Iterator<Map.Entry<String, Long>> iterator = lastHeartbeatTime.entrySet().iterator();
            
            while (iterator.hasNext()) {
                Map.Entry<String, Long> entry = iterator.next();
                String key = entry.getKey();
                Long lastTime = entry.getValue();
                
                // 如果超过超时时间没有收到心跳，则认为服务下线
                if (currentTime - lastTime > timeout) {
                    String[] parts = key.split(":");
                    String serviceName = parts[0];
                    String host = parts[1];
                    int port = Integer.parseInt(parts[2]);
                    
                    // 创建服务实例
                    ServiceInstance instance = new ServiceInstance();
                    instance.setServiceId(serviceName);
                    instance.setHost(host);
                    instance.setPort(port);
                    
                    // 从注册中心注销
                    registry.deregister(serviceName, instance);
                    
                    // 移除心跳记录
                    iterator.remove();
                }
            }
        }, 0, 10, TimeUnit.SECONDS); // 每10秒检查一次
    }
}
```

## 总结

通过以上实现，我们构建了一个最小可用的注册中心，具备了以下核心功能：

1. 服务注册：服务启动时向注册中心注册自己的信息
2. 服务发现：客户端可以从注册中心获取服务实例列表
3. 服务注销：服务停止时从注册中心注销自己
4. 心跳机制：通过心跳保持服务状态的实时性

虽然这个实现还比较简单，但它涵盖了注册中心的核心功能。在实际生产环境中，还需要考虑更多因素，如数据持久化、高可用性、性能优化等。在后续章节中，我们将逐步完善这个注册中心，使其更加健壮和实用。