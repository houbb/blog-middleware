---
title: 服务注册与发现
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在现代分布式系统和微服务架构中，服务注册与发现是实现服务治理的核心组件之一。随着系统规模的不断扩大，服务实例的数量也在动态变化，如何有效地管理这些服务实例的位置信息，使得服务消费者能够准确地找到并调用所需的服务，成为了一个关键挑战。本章将深入探讨服务注册与发现的原理、实现方式以及在 RPC 框架中的应用。

## 服务注册与发现概述

### 什么是服务注册与发现

服务注册与发现是一种用于管理分布式系统中服务实例位置信息的机制。它包含两个核心概念：

1. **服务注册（Service Registration）**：服务提供者在启动时向注册中心注册自己的网络位置信息
2. **服务发现（Service Discovery）**：服务消费者从注册中心获取所需服务的网络位置信息

### 服务注册与发现的重要性

在微服务架构中，服务注册与发现的重要性体现在以下几个方面：

1. **动态性管理**：服务实例可以动态地加入或离开集群，注册中心能够实时更新这些变化
2. **负载均衡**：服务消费者可以根据注册中心提供的服务实例列表进行负载均衡
3. **故障容错**：当某个服务实例出现故障时，注册中心可以及时将其从服务列表中移除
4. **配置管理**：注册中心可以存储服务的配置信息，实现配置的动态更新

### 服务注册与发现的工作流程

服务注册与发现的典型工作流程如下：

1. **服务启动**：服务提供者启动时向注册中心注册自己的信息
2. **心跳检测**：服务提供者定期向注册中心发送心跳，证明自己仍然存活
3. **服务发现**：服务消费者向注册中心查询所需服务的实例列表
4. **服务调用**：服务消费者根据获取的实例列表选择一个实例进行调用
5. **健康检查**：注册中心定期检查服务实例的健康状态
6. **状态更新**：当服务实例状态发生变化时，注册中心及时更新信息

## 注册中心的设计与实现

### 注册中心的核心功能

一个完善的注册中心应该具备以下核心功能：

1. **服务注册**：接收服务实例的注册请求
2. **服务发现**：提供服务实例的查询接口
3. **健康检查**：监控服务实例的健康状态
4. **数据存储**：持久化存储服务实例信息
5. **通知机制**：当服务实例发生变化时通知相关方
6. **负载均衡**：提供基本的负载均衡策略

### 注册中心的数据模型

```java
// 服务实例信息
public class ServiceInstance {
    private String serviceId;        // 服务ID
    private String instanceId;       // 实例ID
    private String host;             // 主机地址
    private int port;                // 端口号
    private String scheme;           // 协议（http/https）
    private Map<String, String> metadata; // 元数据
    private ServiceStatus status;    // 服务状态
    private long registerTime;       // 注册时间
    private long lastHeartbeatTime;  // 最后心跳时间
    
    public ServiceInstance() {
        this.instanceId = UUID.randomUUID().toString();
        this.registerTime = System.currentTimeMillis();
        this.lastHeartbeatTime = System.currentTimeMillis();
        this.status = ServiceStatus.UP;
        this.metadata = new ConcurrentHashMap<>();
    }
    
    // 构造函数
    public ServiceInstance(String serviceId, String host, int port) {
        this();
        this.serviceId = serviceId;
        this.host = host;
        this.port = port;
    }
    
    // getter 和 setter 方法
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    
    public String getInstanceId() { return instanceId; }
    public void setInstanceId(String instanceId) { this.instanceId = instanceId; }
    
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    
    public String getScheme() { return scheme; }
    public void setScheme(String scheme) { this.scheme = scheme; }
    
    public Map<String, String> getMetadata() { return metadata; }
    public void setMetadata(Map<String, String> metadata) { this.metadata = metadata; }
    
    public ServiceStatus getStatus() { return status; }
    public void setStatus(ServiceStatus status) { this.status = status; }
    
    public long getRegisterTime() { return registerTime; }
    public void setRegisterTime(long registerTime) { this.registerTime = registerTime; }
    
    public long getLastHeartbeatTime() { return lastHeartbeatTime; }
    public void setLastHeartbeatTime(long lastHeartbeatTime) { this.lastHeartbeatTime = lastHeartbeatTime; }
    
    // 添加元数据
    public void addMetadata(String key, String value) {
        this.metadata.put(key, value);
    }
    
    // 获取元数据
    public String getMetadata(String key) {
        return this.metadata.get(key);
    }
    
    @Override
    public String toString() {
        return "ServiceInstance{" +
                "serviceId='" + serviceId + '\'' +
                ", instanceId='" + instanceId + '\'' +
                ", host='" + host + '\'' +
                ", port=" + port +
                ", scheme='" + scheme + '\'' +
                ", status=" + status +
                ", registerTime=" + registerTime +
                '}';
    }
}

// 服务状态枚举
public enum ServiceStatus {
    UP,      // 正常
    DOWN,    // 停机
    STARTING,// 启动中
    OUT_OF_SERVICE // 维护中
}

// 服务注册请求
public class ServiceRegistrationRequest {
    private ServiceInstance serviceInstance;
    private long leaseDuration; // 租约时长
    
    public ServiceRegistrationRequest() {}
    
    public ServiceRegistrationRequest(ServiceInstance serviceInstance, long leaseDuration) {
        this.serviceInstance = serviceInstance;
        this.leaseDuration = leaseDuration;
    }
    
    // getter 和 setter 方法
    public ServiceInstance getServiceInstance() { return serviceInstance; }
    public void setServiceInstance(ServiceInstance serviceInstance) { this.serviceInstance = serviceInstance; }
    
    public long getLeaseDuration() { return leaseDuration; }
    public void setLeaseDuration(long leaseDuration) { this.leaseDuration = leaseDuration; }
}

// 服务发现请求
public class ServiceDiscoveryRequest {
    private String serviceId;
    private ServiceStatus status; // 只发现指定状态的服务
    
    public ServiceDiscoveryRequest() {}
    
    public ServiceDiscoveryRequest(String serviceId) {
        this.serviceId = serviceId;
        this.status = ServiceStatus.UP;
    }
    
    // getter 和 setter 方法
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    
    public ServiceStatus getStatus() { return status; }
    public void setStatus(ServiceStatus status) { this.status = status; }
}
```

## 基于内存的注册中心实现

### 简单的内存注册中心

```java
import java.util.*;
import java.util.concurrent.*;

// 基于内存的简单注册中心
public class InMemoryRegistryCenter implements RegistryCenter {
    // 服务注册表：服务ID -> 服务实例列表
    private final Map<String, List<ServiceInstance>> serviceRegistry = new ConcurrentHashMap<>();
    
    // 实例映射：实例ID -> 服务实例
    private final Map<String, ServiceInstance> instanceMap = new ConcurrentHashMap<>();
    
    // 心跳注册表：实例ID -> 最后心跳时间
    private final Map<String, Long> heartbeatRegistry = new ConcurrentHashMap<>();
    
    // 服务监听器
    private final Map<String, List<ServiceChangeListener>> listeners = new ConcurrentHashMap<>();
    
    // 心跳超时时间（毫秒）
    private static final long HEARTBEAT_TIMEOUT = 90000; // 90秒
    
    // 心跳检查线程
    private final ScheduledExecutorService heartbeatChecker = 
        Executors.newSingleThreadScheduledExecutor();
    
    public InMemoryRegistryCenter() {
        // 启动心跳检查任务
        startHeartbeatCheck();
    }
    
    @Override
    public void register(ServiceInstance instance) {
        String serviceId = instance.getServiceId();
        String instanceId = instance.getInstanceId();
        
        // 添加到服务注册表
        serviceRegistry.computeIfAbsent(serviceId, k -> new ArrayList<>()).add(instance);
        
        // 添加到实例映射
        instanceMap.put(instanceId, instance);
        
        // 记录心跳时间
        heartbeatRegistry.put(instanceId, System.currentTimeMillis());
        
        System.out.println("Service registered: " + instance);
        
        // 通知监听器
        notifyListeners(serviceId, ServiceChangeEvent.REGISTERED, instance);
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        String serviceId = instance.getServiceId();
        String instanceId = instance.getInstanceId();
        
        // 从服务注册表中移除
        List<ServiceInstance> instances = serviceRegistry.get(serviceId);
        if (instances != null) {
            instances.removeIf(si -> si.getInstanceId().equals(instanceId));
        }
        
        // 从实例映射中移除
        instanceMap.remove(instanceId);
        
        // 从心跳注册表中移除
        heartbeatRegistry.remove(instanceId);
        
        System.out.println("Service unregistered: " + instance);
        
        // 通知监听器
        notifyListeners(serviceId, ServiceChangeEvent.UNREGISTERED, instance);
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        List<ServiceInstance> instances = serviceRegistry.get(serviceId);
        if (instances == null) {
            return new ArrayList<>();
        }
        
        // 只返回正常状态的服务实例
        return instances.stream()
                .filter(instance -> instance.getStatus() == ServiceStatus.UP)
                .collect(Collectors.toList());
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        String instanceId = instance.getInstanceId();
        ServiceInstance existingInstance = instanceMap.get(instanceId);
        
        if (existingInstance != null) {
            // 更新心跳时间
            heartbeatRegistry.put(instanceId, System.currentTimeMillis());
            
            // 更新实例信息
            existingInstance.setLastHeartbeatTime(System.currentTimeMillis());
            existingInstance.setStatus(ServiceStatus.UP);
        }
    }
    
    @Override
    public void addListener(String serviceId, ServiceChangeListener listener) {
        listeners.computeIfAbsent(serviceId, k -> new ArrayList<>()).add(listener);
    }
    
    @Override
    public void removeListener(String serviceId, ServiceChangeListener listener) {
        List<ServiceChangeListener> serviceListeners = listeners.get(serviceId);
        if (serviceListeners != null) {
            serviceListeners.remove(listener);
        }
    }
    
    // 启动心跳检查任务
    private void startHeartbeatCheck() {
        heartbeatChecker.scheduleAtFixedRate(() -> {
            long currentTime = System.currentTimeMillis();
            List<ServiceInstance> expiredInstances = new ArrayList<>();
            
            // 检查过期实例
            for (Map.Entry<String, Long> entry : heartbeatRegistry.entrySet()) {
                String instanceId = entry.getKey();
                Long lastHeartbeatTime = entry.getValue();
                
                if (currentTime - lastHeartbeatTime > HEARTBEAT_TIMEOUT) {
                    ServiceInstance instance = instanceMap.get(instanceId);
                    if (instance != null) {
                        expiredInstances.add(instance);
                    }
                }
            }
            
            // 处理过期实例
            for (ServiceInstance instance : expiredInstances) {
                handleExpiredInstance(instance);
            }
        }, 30, 30, TimeUnit.SECONDS); // 每30秒检查一次
    }
    
    // 处理过期实例
    private void handleExpiredInstance(ServiceInstance instance) {
        System.out.println("Service instance expired: " + instance);
        
        // 更新实例状态
        instance.setStatus(ServiceStatus.DOWN);
        
        // 通知监听器
        notifyListeners(instance.getServiceId(), ServiceChangeEvent.EXPIRED, instance);
    }
    
    // 通知监听器
    private void notifyListeners(String serviceId, ServiceChangeEvent event, ServiceInstance instance) {
        List<ServiceChangeListener> serviceListeners = listeners.get(serviceId);
        if (serviceListeners != null) {
            for (ServiceChangeListener listener : serviceListeners) {
                try {
                    listener.onChange(event, instance);
                } catch (Exception e) {
                    System.err.println("Error notifying listener: " + e.getMessage());
                }
            }
        }
    }
    
    // 关闭注册中心
    public void shutdown() {
        heartbeatChecker.shutdown();
    }
}

// 注册中心接口
interface RegistryCenter {
    void register(ServiceInstance instance);
    void unregister(ServiceInstance instance);
    List<ServiceInstance> discover(String serviceId);
    void heartbeat(ServiceInstance instance);
    void addListener(String serviceId, ServiceChangeListener listener);
    void removeListener(String serviceId, ServiceChangeListener listener);
}

// 服务变更事件
enum ServiceChangeEvent {
    REGISTERED,    // 注册
    UNREGISTERED,  // 注销
    EXPIRED        // 过期
}

// 服务变更监听器
interface ServiceChangeListener {
    void onChange(ServiceChangeEvent event, ServiceInstance instance);
}
```

## 基于 ZooKeeper 的注册中心实现

### ZooKeeper 注册中心

```java
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.framework.recipes.cache.*;
import org.apache.curator.retry.ExponentialBackoffRetry;
import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.data.Stat;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

// 基于 ZooKeeper 的注册中心
public class ZookeeperRegistryCenter implements RegistryCenter {
    private CuratorFramework client;
    private String basePath = "/services";
    private Map<String, List<ServiceChangeListener>> listeners = new ConcurrentHashMap<>();
    
    public ZookeeperRegistryCenter(String connectString) {
        this.client = CuratorFrameworkFactory.newClient(connectString, 
            new ExponentialBackoffRetry(1000, 3));
        this.client.start();
    }
    
    @Override
    public void register(ServiceInstance instance) {
        try {
            String path = buildInstancePath(instance);
            String data = serializeInstance(instance);
            
            // 创建临时节点
            client.create()
                  .creatingParentsIfNeeded()
                  .withMode(CreateMode.EPHEMERAL)
                  .forPath(path, data.getBytes());
            
            System.out.println("Service registered in ZooKeeper: " + path);
        } catch (Exception e) {
            throw new RuntimeException("Failed to register service", e);
        }
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        try {
            String path = buildInstancePath(instance);
            client.delete().forPath(path);
            System.out.println("Service unregistered from ZooKeeper: " + path);
        } catch (Exception e) {
            throw new RuntimeException("Failed to unregister service", e);
        }
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        try {
            String servicePath = basePath + "/" + serviceId;
            List<String> children = client.getChildren().forPath(servicePath);
            List<ServiceInstance> instances = new ArrayList<>();
            
            for (String child : children) {
                String instancePath = servicePath + "/" + child;
                byte[] data = client.getData().forPath(instancePath);
                ServiceInstance instance = deserializeInstance(new String(data));
                instances.add(instance);
            }
            
            return instances;
        } catch (Exception e) {
            throw new RuntimeException("Failed to discover services", e);
        }
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        // ZooKeeper 通过临时节点自动处理心跳
    }
    
    @Override
    public void addListener(String serviceId, ServiceChangeListener listener) {
        try {
            listeners.computeIfAbsent(serviceId, k -> new ArrayList<>()).add(listener);
            
            // 添加节点监听器
            String servicePath = basePath + "/" + serviceId;
            NodeCache nodeCache = new NodeCache(client, servicePath);
            nodeCache.getListenable().addListener(new NodeCacheListener() {
                @Override
                public void nodeChanged() throws Exception {
                    // 节点变化时重新发现服务
                    List<ServiceInstance> instances = discover(serviceId);
                    // 通知监听器
                    for (ServiceChangeListener l : listeners.get(serviceId)) {
                        // 这里简化处理，实际应该传递具体的变化信息
                    }
                }
            });
            nodeCache.start();
        } catch (Exception e) {
            throw new RuntimeException("Failed to add listener", e);
        }
    }
    
    @Override
    public void removeListener(String serviceId, ServiceChangeListener listener) {
        List<ServiceChangeListener> serviceListeners = listeners.get(serviceId);
        if (serviceListeners != null) {
            serviceListeners.remove(listener);
        }
    }
    
    private String buildInstancePath(ServiceInstance instance) {
        return basePath + "/" + instance.getServiceId() + "/" + instance.getInstanceId();
    }
    
    private String serializeInstance(ServiceInstance instance) {
        // 简化的序列化实现
        return instance.getHost() + ":" + instance.getPort() + ":" + instance.getStatus();
    }
    
    private ServiceInstance deserializeInstance(String data) {
        // 简化的反序列化实现
        String[] parts = data.split(":");
        ServiceInstance instance = new ServiceInstance();
        instance.setHost(parts[0]);
        instance.setPort(Integer.parseInt(parts[1]));
        instance.setStatus(ServiceStatus.valueOf(parts[2]));
        return instance;
    }
}
```

## 服务提供者实现

### 服务提供者启动类

```java
// 服务提供者
public class ServiceProvider {
    private RegistryCenter registryCenter;
    private String serviceId;
    private String host;
    private int port;
    private ScheduledExecutorService heartbeatScheduler;
    
    public ServiceProvider(RegistryCenter registryCenter, String serviceId, String host, int port) {
        this.registryCenter = registryCenter;
        this.serviceId = serviceId;
        this.host = host;
        this.port = port;
        this.heartbeatScheduler = Executors.newScheduledThreadPool(1);
    }
    
    public void start() {
        // 注册服务
        ServiceInstance instance = new ServiceInstance(serviceId, host, port);
        instance.addMetadata("version", "1.0.0");
        instance.addMetadata("zone", "default");
        
        registryCenter.register(instance);
        
        // 启动心跳
        startHeartbeat(instance);
        
        System.out.println("Service provider started: " + serviceId + " at " + host + ":" + port);
    }
    
    public void stop() {
        // 取消注册
        ServiceInstance instance = new ServiceInstance(serviceId, host, port);
        registryCenter.unregister(instance);
        
        // 停止心跳
        heartbeatScheduler.shutdown();
        
        System.out.println("Service provider stopped: " + serviceId);
    }
    
    private void startHeartbeat(ServiceInstance instance) {
        heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                registryCenter.heartbeat(instance);
                System.out.println("Heartbeat sent for service: " + serviceId);
            } catch (Exception e) {
                System.err.println("Heartbeat failed: " + e.getMessage());
            }
        }, 0, 30, TimeUnit.SECONDS); // 每30秒发送一次心跳
    }
}

// 服务提供者启动示例
public class ServiceProviderExample {
    public static void main(String[] args) {
        // 创建注册中心
        RegistryCenter registryCenter = new InMemoryRegistryCenter();
        
        // 创建服务提供者
        ServiceProvider userServiceProvider = new ServiceProvider(
            registryCenter, "UserService", "localhost", 8081);
        
        ServiceProvider orderServiceProvider = new ServiceProvider(
            registryCenter, "OrderService", "localhost", 8082);
        
        // 启动服务提供者
        userServiceProvider.start();
        orderServiceProvider.start();
        
        // 保持程序运行
        try {
            Thread.sleep(60000); // 运行1分钟
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // 停止服务提供者
        userServiceProvider.stop();
        orderServiceProvider.stop();
        
        // 关闭注册中心
        if (registryCenter instanceof InMemoryRegistryCenter) {
            ((InMemoryRegistryCenter) registryCenter).shutdown();
        }
    }
}
```

## 服务消费者实现

### 服务消费者

```java
// 服务消费者
public class ServiceConsumer {
    private RegistryCenter registryCenter;
    private LoadBalancer loadBalancer;
    
    public ServiceConsumer(RegistryCenter registryCenter, LoadBalancer loadBalancer) {
        this.registryCenter = registryCenter;
        this.loadBalancer = loadBalancer;
    }
    
    public ServiceInstance selectInstance(String serviceId) {
        List<ServiceInstance> instances = registryCenter.discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceId);
        }
        
        return loadBalancer.select(instances);
    }
    
    public List<ServiceInstance> getAllInstances(String serviceId) {
        return registryCenter.discover(serviceId);
    }
}

// 负载均衡器接口
interface LoadBalancer {
    ServiceInstance select(List<ServiceInstance> instances);
}

// 随机负载均衡器
public class RandomLoadBalancer implements LoadBalancer {
    private Random random = new Random();
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        int index = random.nextInt(instances.size());
        return instances.get(index);
    }
}

// 轮询负载均衡器
public class RoundRobinLoadBalancer implements LoadBalancer {
    private AtomicInteger index = new AtomicInteger(0);
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        int pos = Math.abs(index.getAndIncrement()) % instances.size();
        return instances.get(pos);
    }
}

// 服务消费者示例
public class ServiceConsumerExample {
    public static void main(String[] args) {
        // 创建注册中心
        RegistryCenter registryCenter = new InMemoryRegistryCenter();
        
        // 创建负载均衡器
        LoadBalancer loadBalancer = new RandomLoadBalancer();
        
        // 创建服务消费者
        ServiceConsumer consumer = new ServiceConsumer(registryCenter, loadBalancer);
        
        // 模拟服务调用
        try {
            for (int i = 0; i < 10; i++) {
                ServiceInstance instance = consumer.selectInstance("UserService");
                System.out.println("Selected instance: " + instance.getHost() + ":" + instance.getPort());
                Thread.sleep(1000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 健康检查机制

### 主动健康检查

```java
// 健康检查器
public class HealthChecker {
    private ExecutorService executorService = Executors.newFixedThreadPool(10);
    
    public boolean checkHealth(ServiceInstance instance) {
        try {
            // 尝试连接到服务实例
            String host = instance.getHost();
            int port = instance.getPort();
            
            // 这里可以实现具体的健康检查逻辑
            // 例如：HTTP 健康检查端点、TCP 连接检查等
            return pingService(host, port);
        } catch (Exception e) {
            return false;
        }
    }
    
    public void checkHealthAsync(ServiceInstance instance, HealthCheckCallback callback) {
        executorService.submit(() -> {
            boolean isHealthy = checkHealth(instance);
            callback.onHealthCheckResult(instance, isHealthy);
        });
    }
    
    private boolean pingService(String host, int port) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 3000); // 3秒超时
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}

// 健康检查回调接口
interface HealthCheckCallback {
    void onHealthCheckResult(ServiceInstance instance, boolean isHealthy);
}

// 带健康检查的注册中心
public class HealthAwareRegistryCenter implements RegistryCenter {
    private RegistryCenter delegate;
    private HealthChecker healthChecker;
    private ScheduledExecutorService healthCheckScheduler;
    private Map<String, Boolean> healthStatusMap = new ConcurrentHashMap<>();
    
    public HealthAwareRegistryCenter(RegistryCenter delegate) {
        this.delegate = delegate;
        this.healthChecker = new HealthChecker();
        this.healthCheckScheduler = Executors.newScheduledThreadPool(5);
        
        // 启动定期健康检查
        startPeriodicHealthCheck();
    }
    
    @Override
    public void register(ServiceInstance instance) {
        delegate.register(instance);
        // 立即进行一次健康检查
        checkInstanceHealth(instance);
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        delegate.unregister(instance);
        healthStatusMap.remove(getInstanceKey(instance));
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        List<ServiceInstance> instances = delegate.discover(serviceId);
        // 过滤掉不健康的实例
        return instances.stream()
                .filter(instance -> isInstanceHealthy(instance))
                .collect(Collectors.toList());
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        delegate.heartbeat(instance);
    }
    
    @Override
    public void addListener(String serviceId, ServiceChangeListener listener) {
        delegate.addListener(serviceId, listener);
    }
    
    @Override
    public void removeListener(String serviceId, ServiceChangeListener listener) {
        delegate.removeListener(serviceId, listener);
    }
    
    private void startPeriodicHealthCheck() {
        healthCheckScheduler.scheduleAtFixedRate(() -> {
            // 获取所有已注册的服务实例并进行健康检查
            // 这里简化处理，实际实现需要遍历所有服务实例
        }, 0, 60, TimeUnit.SECONDS); // 每60秒检查一次
    }
    
    private void checkInstanceHealth(ServiceInstance instance) {
        healthChecker.checkHealthAsync(instance, (inst, isHealthy) -> {
            healthStatusMap.put(getInstanceKey(inst), isHealthy);
            if (!isHealthy) {
                System.out.println("Instance is unhealthy: " + getInstanceKey(inst));
            }
        });
    }
    
    private boolean isInstanceHealthy(ServiceInstance instance) {
        Boolean isHealthy = healthStatusMap.get(getInstanceKey(instance));
        return isHealthy == null || isHealthy; // 默认认为是健康的
    }
    
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getServiceId() + "@" + instance.getHost() + ":" + instance.getPort();
    }
}
```

## 总结

通过本章的学习，我们深入了解了服务注册与发现的核心概念、实现原理以及在分布式系统中的重要作用。关键要点包括：

1. **核心概念**：理解了服务注册与发现的基本概念和工作流程
2. **数据模型**：设计了服务实例、注册请求、发现请求等核心数据结构
3. **实现方式**：实现了基于内存和 ZooKeeper 的注册中心
4. **服务提供者**：构建了服务提供者的注册和心跳机制
5. **服务消费者**：实现了服务发现和负载均衡功能
6. **健康检查**：设计了主动健康检查机制

服务注册与发现是构建高可用、可扩展的分布式系统的基础组件。通过合理的实现，可以大大提高系统的可靠性和维护性。

在下一章中，我们将探讨客户端负载均衡策略，进一步完善 RPC 框架的服务治理能力。