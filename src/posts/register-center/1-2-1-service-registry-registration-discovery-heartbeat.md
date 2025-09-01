---
title: 服务注册中心基本原理：注册、发现与心跳机制
date: 2025-09-02
categories: [RegisterCenter]
tags: [register-center, service-registry]
published: true
---

在微服务架构中，服务注册中心扮演着至关重要的角色。它就像一个通讯录，记录着所有服务实例的地址信息，使得服务之间能够相互发现和调用。本章将深入探讨服务注册中心的核心机制：服务注册、服务发现和心跳机制。

## 服务注册机制

服务注册是服务实例启动时向注册中心报告自身信息的过程。这些信息通常包括服务名称、IP地址、端口号、元数据等。

### 注册信息结构

```java
// 服务实例信息定义
public class ServiceInstance {
    private String serviceId;     // 服务唯一标识
    private String host;          // 服务实例IP地址
    private int port;             // 服务实例端口
    private String instanceId;    // 实例唯一标识
    private Map<String, String> metadata; // 元数据信息
    private long registerTime;    // 注册时间戳
    private boolean healthy;      // 健康状态
    
    // 构造函数、getter和setter方法
    public ServiceInstance(String serviceId, String host, int port) {
        this.serviceId = serviceId;
        this.host = host;
        this.port = port;
        this.instanceId = generateInstanceId();
        this.metadata = new HashMap<>();
        this.registerTime = System.currentTimeMillis();
        this.healthy = true;
    }
    
    private String generateInstanceId() {
        return serviceId + "-" + host + "-" + port + "-" + UUID.randomUUID().toString();
    }
    
    // getter和setter方法省略...
}
```

### 注册流程实现

```java
// 服务注册中心核心接口
public interface ServiceRegistry {
    /**
     * 服务注册
     * @param serviceInstance 服务实例信息
     */
    void register(ServiceInstance serviceInstance);
    
    /**
     * 服务注销
     * @param serviceInstance 服务实例信息
     */
    void deregister(ServiceInstance serviceInstance);
    
    /**
     * 获取服务实例列表
     * @param serviceId 服务ID
     * @return 服务实例列表
     */
    List<ServiceInstance> getInstances(String serviceId);
}

// 基于内存的注册中心实现
public class InMemoryServiceRegistry implements ServiceRegistry {
    // 使用线程安全的ConcurrentHashMap存储服务实例
    private final ConcurrentHashMap<String, 
        ConcurrentHashMap<String, ServiceInstance>> registry = new ConcurrentHashMap<>();
    
    @Override
    public void register(ServiceInstance serviceInstance) {
        String serviceId = serviceInstance.getServiceId();
        String instanceId = serviceInstance.getInstanceId();
        
        // 为每个服务创建实例映射
        registry.computeIfAbsent(serviceId, k -> new ConcurrentHashMap<>())
                .put(instanceId, serviceInstance);
        
        System.out.println("服务注册成功: " + serviceId + " -> " + instanceId);
    }
    
    @Override
    public void deregister(ServiceInstance serviceInstance) {
        String serviceId = serviceInstance.getServiceId();
        String instanceId = serviceInstance.getInstanceId();
        
        ConcurrentHashMap<String, ServiceInstance> instances = registry.get(serviceId);
        if (instances != null) {
            instances.remove(instanceId);
            System.out.println("服务注销成功: " + serviceId + " -> " + instanceId);
        }
    }
    
    @Override
    public List<ServiceInstance> getInstances(String serviceId) {
        ConcurrentHashMap<String, ServiceInstance> instances = registry.get(serviceId);
        if (instances == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(instances.values());
    }
}
```

### 服务启动时的注册过程

```java
// 服务启动时的注册示例
@Component
public class ServiceRegistryClient {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    @Value("${server.port}")
    private int port;
    
    @Value("${spring.application.name}")
    private String serviceName;
    
    @PostConstruct
    public void registerService() {
        try {
            // 获取本机IP地址
            String host = InetAddress.getLocalHost().getHostAddress();
            
            // 创建服务实例
            ServiceInstance instance = new ServiceInstance(serviceName, host, port);
            
            // 添加元数据信息
            instance.getMetadata().put("version", "1.0.0");
            instance.getMetadata().put("zone", "shanghai");
            instance.getMetadata().put("weight", "10");
            
            // 注册到注册中心
            serviceRegistry.register(instance);
            
            System.out.println("服务注册完成: " + serviceName);
        } catch (Exception e) {
            System.err.println("服务注册失败: " + e.getMessage());
        }
    }
    
    @PreDestroy
    public void deregisterService() {
        try {
            String host = InetAddress.getLocalHost().getHostAddress();
            ServiceInstance instance = new ServiceInstance(serviceName, host, port);
            serviceRegistry.deregister(instance);
            System.out.println("服务注销完成: " + serviceName);
        } catch (Exception e) {
            System.err.println("服务注销失败: " + e.getMessage());
        }
    }
}
```

## 服务发现机制

服务发现是客户端从注册中心获取可用服务实例列表的过程。这是实现服务间调用的基础。

### 发现流程实现

```java
// 服务发现接口
public interface ServiceDiscovery {
    /**
     * 发现服务实例
     * @param serviceId 服务ID
     * @return 服务实例列表
     */
    List<ServiceInstance> discover(String serviceId);
    
    /**
     * 根据负载均衡策略选择一个服务实例
     * @param serviceId 服务ID
     * @return 选中的服务实例
     */
    ServiceInstance chooseInstance(String serviceId);
}

// 基于轮询的负载均衡实现
public class RoundRobinServiceDiscovery implements ServiceDiscovery {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    private final ConcurrentHashMap<String, AtomicInteger> indexMap = new ConcurrentHashMap<>();
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        List<ServiceInstance> instances = serviceRegistry.getInstances(serviceId);
        // 过滤掉不健康的实例
        return instances.stream()
                .filter(ServiceInstance::isHealthy)
                .collect(Collectors.toList());
    }
    
    @Override
    public ServiceInstance chooseInstance(String serviceId) {
        List<ServiceInstance> instances = discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("没有可用的服务实例: " + serviceId);
        }
        
        // 轮询算法选择实例
        AtomicInteger index = indexMap.computeIfAbsent(serviceId, k -> new AtomicInteger(0));
        int currentIndex = Math.abs(index.getAndIncrement()) % instances.size();
        return instances.get(currentIndex);
    }
}
```

### 客户端使用示例

```java
// 客户端服务调用示例
@Service
public class UserServiceClient {
    
    @Autowired
    private ServiceDiscovery serviceDiscovery;
    
    @Autowired
    private RestTemplate restTemplate;
    
    public User getUserById(Long userId) {
        try {
            // 发现用户服务实例
            ServiceInstance instance = serviceDiscovery.chooseInstance("user-service");
            
            // 构造服务调用URL
            String url = "http://" + instance.getHost() + ":" + instance.getPort() + 
                        "/users/" + userId;
            
            // 调用服务
            return restTemplate.getForObject(url, User.class);
        } catch (Exception e) {
            throw new RuntimeException("调用用户服务失败", e);
        }
    }
}
```

## 心跳机制

心跳机制用于检测服务实例的健康状态，及时移除不健康或已下线的实例。

### 心跳检测实现

```java
// 心跳管理器
@Component
public class HeartbeatManager {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    // 记录每个实例的最后心跳时间
    private final ConcurrentHashMap<String, Long> lastHeartbeatTime = new ConcurrentHashMap<>();
    
    // 心跳超时时间（毫秒）
    private static final long HEARTBEAT_TIMEOUT = 30000;
    
    // 心跳检查间隔（毫秒）
    private static final long CHECK_INTERVAL = 10000;
    
    @PostConstruct
    public void startHeartbeatChecker() {
        // 启动定时任务检查心跳
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(this::checkHeartbeats, 
                                    CHECK_INTERVAL, CHECK_INTERVAL, TimeUnit.MILLISECONDS);
    }
    
    // 服务实例发送心跳
    public void heartbeat(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        lastHeartbeatTime.put(key, System.currentTimeMillis());
    }
    
    // 检查心跳超时
    private void checkHeartbeats() {
        long currentTime = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> iterator = lastHeartbeatTime.entrySet().iterator();
        
        while (iterator.hasNext()) {
            Map.Entry<String, Long> entry = iterator.next();
            String instanceKey = entry.getKey();
            Long lastHeartbeat = entry.getValue();
            
            // 如果超过超时时间没有收到心跳
            if (currentTime - lastHeartbeat > HEARTBEAT_TIMEOUT) {
                // 解析实例信息
                String[] parts = instanceKey.split(":");
                if (parts.length >= 3) {
                    String serviceId = parts[0];
                    String host = parts[1];
                    int port = Integer.parseInt(parts[2]);
                    
                    // 创建服务实例对象
                    ServiceInstance instance = new ServiceInstance(serviceId, host, port);
                    
                    // 从注册中心移除
                    serviceRegistry.deregister(instance);
                    
                    // 移除心跳记录
                    iterator.remove();
                    
                    System.out.println("实例心跳超时，已移除: " + instanceKey);
                }
            }
        }
    }
    
    // 生成实例唯一键
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getServiceId() + ":" + 
               instance.getHost() + ":" + 
               instance.getPort();
    }
}
```

### 服务端心跳处理

```java
// 心跳处理控制器
@RestController
@RequestMapping("/heartbeat")
public class HeartbeatController {
    
    @Autowired
    private HeartbeatManager heartbeatManager;
    
    @PostMapping("/ping")
    public ResponseEntity<String> heartbeat(@RequestBody HeartbeatRequest request) {
        try {
            // 创建服务实例对象
            ServiceInstance instance = new ServiceInstance(
                request.getServiceId(), 
                request.getHost(), 
                request.getPort()
            );
            
            // 处理心跳
            heartbeatManager.heartbeat(instance);
            
            return ResponseEntity.ok("Heartbeat received");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Heartbeat failed: " + e.getMessage());
        }
    }
}

// 心跳请求数据结构
class HeartbeatRequest {
    private String serviceId;
    private String host;
    private int port;
    
    // getter和setter方法
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
}
```

### 客户端心跳发送

```java
// 客户端心跳发送器
@Component
public class HeartbeatSender {
    
    @Value("${server.port}")
    private int port;
    
    @Value("${spring.application.name}")
    private String serviceName;
    
    @Autowired
    private RestTemplate restTemplate;
    
    private String registryAddress = "http://registry-center:8080";
    
    @PostConstruct
    public void startHeartbeat() {
        // 启动定时发送心跳
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(this::sendHeartbeat, 
                                    0, 20, TimeUnit.SECONDS); // 每20秒发送一次心跳
    }
    
    private void sendHeartbeat() {
        try {
            String host = InetAddress.getLocalHost().getHostAddress();
            
            // 构造心跳请求
            HeartbeatRequest request = new HeartbeatRequest();
            request.setServiceId(serviceName);
            request.setHost(host);
            request.setPort(port);
            
            // 发送心跳请求
            String url = registryAddress + "/heartbeat/ping";
            restTemplate.postForObject(url, request, String.class);
            
        } catch (Exception e) {
            System.err.println("发送心跳失败: " + e.getMessage());
        }
    }
}
```

## 临时节点与永久节点

在服务注册中心中，节点通常分为临时节点和永久节点两种类型。

### 节点类型对比

```java
// 节点类型枚举
public enum NodeType {
    /**
     * 临时节点
     * 当客户端断开连接时自动删除
     */
    EPHEMERAL,
    
    /**
     * 永久节点
     * 即使客户端断开连接也会保留
     */
    PERSISTENT
}

// 带节点类型的服务实例
public class ServiceInstanceWithNodeType extends ServiceInstance {
    private NodeType nodeType;
    
    public ServiceInstanceWithNodeType(String serviceId, String host, int port, NodeType nodeType) {
        super(serviceId, host, port);
        this.nodeType = nodeType;
    }
    
    public NodeType getNodeType() {
        return nodeType;
    }
    
    public void setNodeType(NodeType nodeType) {
        this.nodeType = nodeType;
    }
}
```

### 节点管理实现

```java
// 支持节点类型的注册中心
public class NodeAwareServiceRegistry implements ServiceRegistry {
    private final ConcurrentHashMap<String, 
        ConcurrentHashMap<String, ServiceInstanceWithNodeType>> registry = new ConcurrentHashMap<>();
    
    // 记录临时节点的连接状态
    private final ConcurrentHashMap<String, Boolean> ephemeralNodeConnections = new ConcurrentHashMap<>();
    
    @Override
    public void register(ServiceInstance serviceInstance) {
        if (serviceInstance instanceof ServiceInstanceWithNodeType) {
            ServiceInstanceWithNodeType instance = (ServiceInstanceWithNodeType) serviceInstance;
            String serviceId = instance.getServiceId();
            String instanceId = instance.getInstanceId();
            
            registry.computeIfAbsent(serviceId, k -> new ConcurrentHashMap<>())
                    .put(instanceId, instance);
            
            // 如果是临时节点，记录连接状态
            if (instance.getNodeType() == NodeType.EPHEMERAL) {
                ephemeralNodeConnections.put(instanceId, true);
            }
        } else {
            // 默认按临时节点处理
            ServiceInstanceWithNodeType instance = new ServiceInstanceWithNodeType(
                serviceInstance.getServiceId(),
                serviceInstance.getHost(),
                serviceInstance.getPort(),
                NodeType.EPHEMERAL
            );
            register(instance);
        }
    }
    
    // 处理客户端断开连接
    public void handleClientDisconnect(String clientId) {
        // 标记该客户端的所有临时节点为断开状态
        ephemeralNodeConnections.entrySet().stream()
            .filter(entry -> entry.getKey().startsWith(clientId))
            .forEach(entry -> entry.setValue(false));
    }
    
    // 清理断开连接的临时节点
    public void cleanupDisconnectedEphemeralNodes() {
        ephemeralNodeConnections.entrySet().stream()
            .filter(entry -> !entry.getValue()) // 找到断开连接的节点
            .forEach(entry -> {
                String instanceId = entry.getKey();
                // 从注册表中移除
                removeInstanceById(instanceId);
                // 移除连接状态记录
                ephemeralNodeConnections.remove(instanceId);
            });
    }
    
    private void removeInstanceById(String instanceId) {
        for (ConcurrentHashMap<String, ServiceInstanceWithNodeType> instances : registry.values()) {
            instances.entrySet().stream()
                .filter(entry -> entry.getValue().getInstanceId().equals(instanceId))
                .findFirst()
                .ifPresent(entry -> {
                    instances.remove(entry.getKey());
                    System.out.println("移除临时节点: " + instanceId);
                });
        }
    }
    
    @Override
    public void deregister(ServiceInstance serviceInstance) {
        String serviceId = serviceInstance.getServiceId();
        String instanceId = serviceInstance.getInstanceId();
        
        ConcurrentHashMap<String, ServiceInstanceWithNodeType> instances = registry.get(serviceId);
        if (instances != null) {
            ServiceInstanceWithNodeType removed = instances.remove(instanceId);
            if (removed != null) {
                // 如果是临时节点，也移除连接状态记录
                if (removed.getNodeType() == NodeType.EPHEMERAL) {
                    ephemeralNodeConnections.remove(instanceId);
                }
                System.out.println("服务注销成功: " + serviceId + " -> " + instanceId);
            }
        }
    }
    
    @Override
    public List<ServiceInstance> getInstances(String serviceId) {
        ConcurrentHashMap<String, ServiceInstanceWithNodeType> instances = registry.get(serviceId);
        if (instances == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(instances.values());
    }
}
```

## 客户端缓存与订阅模型

为了提高性能和减少网络请求，客户端通常会缓存服务实例信息，并通过订阅机制获取更新。

### 客户端缓存实现

```java
// 带缓存的服务发现客户端
public class CachedServiceDiscovery implements ServiceDiscovery {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    // 本地缓存：服务ID -> 服务实例列表
    private final ConcurrentHashMap<String, List<ServiceInstance>> cache = new ConcurrentHashMap<>();
    
    // 缓存过期时间（毫秒）
    private static final long CACHE_EXPIRE_TIME = 30000;
    
    // 缓存更新时间记录
    private final ConcurrentHashMap<String, Long> cacheUpdateTime = new ConcurrentHashMap<>();
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        // 检查缓存是否过期
        Long lastUpdate = cacheUpdateTime.get(serviceId);
        long currentTime = System.currentTimeMillis();
        
        if (lastUpdate == null || (currentTime - lastUpdate) > CACHE_EXPIRE_TIME) {
            // 缓存过期，从注册中心获取最新数据
            List<ServiceInstance> instances = serviceRegistry.getInstances(serviceId);
            cache.put(serviceId, instances);
            cacheUpdateTime.put(serviceId, currentTime);
            return instances;
        }
        
        // 返回缓存数据
        return cache.getOrDefault(serviceId, Collections.emptyList());
    }
    
    @Override
    public ServiceInstance chooseInstance(String serviceId) {
        List<ServiceInstance> instances = discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("没有可用的服务实例: " + serviceId);
        }
        
        // 简单轮询选择
        return instances.get((int) (System.currentTimeMillis() % instances.size()));
    }
    
    // 主动刷新缓存
    public void refreshCache(String serviceId) {
        List<ServiceInstance> instances = serviceRegistry.getInstances(serviceId);
        cache.put(serviceId, instances);
        cacheUpdateTime.put(serviceId, System.currentTimeMillis());
    }
}
```

### 订阅模型实现

```java
// 服务实例变化监听器
public interface ServiceInstancesChangeListener {
    void onInstancesChange(String serviceId, List<ServiceInstance> instances);
}

// 订阅式服务发现
public class SubscribableServiceDiscovery implements ServiceDiscovery {
    
    @Autowired
    private ServiceRegistry serviceRegistry;
    
    // 订阅者列表：服务ID -> 监听器列表
    private final ConcurrentHashMap<String, List<ServiceInstancesChangeListener>> subscribers = new ConcurrentHashMap<>();
    
    // 本地缓存
    private final ConcurrentHashMap<String, List<ServiceInstance>> cache = new ConcurrentHashMap<>();
    
    // 添加订阅者
    public void subscribe(String serviceId, ServiceInstancesChangeListener listener) {
        subscribers.computeIfAbsent(serviceId, k -> new ArrayList<>()).add(listener);
        
        // 立即推送当前实例列表
        List<ServiceInstance> currentInstances = serviceRegistry.getInstances(serviceId);
        cache.put(serviceId, currentInstances);
        listener.onInstancesChange(serviceId, currentInstances);
    }
    
    // 移除订阅者
    public void unsubscribe(String serviceId, ServiceInstancesChangeListener listener) {
        List<ServiceInstancesChangeListener> listeners = subscribers.get(serviceId);
        if (listeners != null) {
            listeners.remove(listener);
        }
    }
    
    // 通知服务实例变化
    public void notifyInstancesChange(String serviceId) {
        List<ServiceInstance> instances = serviceRegistry.getInstances(serviceId);
        cache.put(serviceId, instances);
        
        List<ServiceInstancesChangeListener> listeners = subscribers.get(serviceId);
        if (listeners != null) {
            // 异步通知所有订阅者
            listeners.parallelStream().forEach(listener -> {
                try {
                    listener.onInstancesChange(serviceId, instances);
                } catch (Exception e) {
                    System.err.println("通知订阅者失败: " + e.getMessage());
                }
            });
        }
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        return cache.getOrDefault(serviceId, Collections.emptyList());
    }
    
    @Override
    public ServiceInstance chooseInstance(String serviceId) {
        List<ServiceInstance> instances = discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("没有可用的服务实例: " + serviceId);
        }
        
        return instances.get((int) (System.currentTimeMillis() % instances.size()));
    }
}

// 客户端使用订阅模型的示例
@Component
public class SubscriptionClient implements ServiceInstancesChangeListener {
    
    @Autowired
    private SubscribableServiceDiscovery serviceDiscovery;
    
    @Value("${target.service.name:user-service}")
    private String targetServiceName;
    
    @PostConstruct
    public void init() {
        // 订阅服务实例变化
        serviceDiscovery.subscribe(targetServiceName, this);
    }
    
    @Override
    public void onInstancesChange(String serviceId, List<ServiceInstance> instances) {
        System.out.println("服务实例发生变化: " + serviceId);
        instances.forEach(instance -> 
            System.out.println("  - " + instance.getHost() + ":" + instance.getPort()));
        
        // 在这里可以更新本地负载均衡器的实例列表
        updateLoadBalancer(instances);
    }
    
    private void updateLoadBalancer(List<ServiceInstance> instances) {
        // 更新负载均衡器的实例列表
        // 实际实现会根据具体的负载均衡算法进行处理
    }
}
```

## 总结

服务注册中心的基本原理涵盖了服务注册、服务发现和心跳机制三个核心组成部分：

1. **服务注册**：服务实例启动时向注册中心报告自身信息，包括IP、端口、元数据等
2. **服务发现**：客户端通过注册中心获取可用服务实例列表，实现服务间调用
3. **心跳机制**：通过定期心跳检测服务实例的健康状态，及时移除不健康的实例

此外，我们还探讨了临时节点与永久节点的区别，以及客户端缓存和订阅模型等高级特性。这些机制共同构成了服务注册中心的核心功能，为微服务架构的稳定运行提供了基础保障。

在实际应用中，还需要考虑更多因素，如数据持久化、高可用性、性能优化等，这些内容将在后续章节中详细介绍。