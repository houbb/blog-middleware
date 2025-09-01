---
title: 服务发现与负载均衡
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在现代分布式系统和微服务架构中，服务发现与负载均衡是两个至关重要的组件。随着服务数量的增加和动态变化，如何有效地发现和路由到可用的服务实例成为了一个关键挑战。本章将深入探讨服务发现与负载均衡的原理、实现方式以及在 RPC 系统中的应用。

## 服务发现机制

### 什么是服务发现

服务发现是指在分布式系统中，客户端能够自动发现和定位可用服务实例的过程。在微服务架构中，服务实例的数量和位置可能会动态变化，服务发现机制使得客户端无需硬编码服务地址，而是通过注册中心动态获取服务信息。

### 服务发现的核心组件

服务发现系统通常包含以下核心组件：

1. **服务注册中心**：存储和管理服务实例信息的中央组件
2. **服务提供者**：向注册中心注册自己的服务实例
3. **服务消费者**：从注册中心获取服务实例信息
4. **健康检查机制**：监控服务实例的健康状态

### 服务注册与发现流程

```java
// 服务实例信息
public class ServiceInstance {
    private String serviceId;
    private String host;
    private int port;
    private String metadata;
    private long registerTime;
    
    // 构造函数、getter 和 setter 方法
    public ServiceInstance(String serviceId, String host, int port) {
        this.serviceId = serviceId;
        this.host = host;
        this.port = port;
        this.registerTime = System.currentTimeMillis();
    }
    
    // getter 和 setter 方法
    public String getServiceId() { return serviceId; }
    public void setServiceId(String serviceId) { this.serviceId = serviceId; }
    
    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }
    
    public int getPort() { return port; }
    public void setPort(int port) { this.port = port; }
    
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    
    public long getRegisterTime() { return registerTime; }
    public void setRegisterTime(long registerTime) { this.registerTime = registerTime; }
}

// 注册中心接口
public interface RegistryCenter {
    void register(ServiceInstance instance);
    void unregister(ServiceInstance instance);
    List<ServiceInstance> discover(String serviceId);
    void heartbeat(ServiceInstance instance);
}

// 简单的内存注册中心实现
public class InMemoryRegistryCenter implements RegistryCenter {
    private Map<String, List<ServiceInstance>> serviceRegistry = new ConcurrentHashMap<>();
    private Map<String, Long> heartbeatRegistry = new ConcurrentHashMap<>();
    private static final long HEARTBEAT_TIMEOUT = 30000; // 30秒超时
    
    @Override
    public void register(ServiceInstance instance) {
        serviceRegistry.computeIfAbsent(instance.getServiceId(), k -> new ArrayList<>()).add(instance);
        heartbeatRegistry.put(getInstanceKey(instance), System.currentTimeMillis());
        System.out.println("Service registered: " + instance.getServiceId() + 
                          " at " + instance.getHost() + ":" + instance.getPort());
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        List<ServiceInstance> instances = serviceRegistry.get(instance.getServiceId());
        if (instances != null) {
            instances.removeIf(si -> si.getHost().equals(instance.getHost()) && 
                                   si.getPort() == instance.getPort());
        }
        heartbeatRegistry.remove(getInstanceKey(instance));
        System.out.println("Service unregistered: " + instance.getServiceId() + 
                          " at " + instance.getHost() + ":" + instance.getPort());
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        // 清理过期实例
        cleanupExpiredInstances();
        
        List<ServiceInstance> instances = serviceRegistry.get(serviceId);
        return instances != null ? new ArrayList<>(instances) : new ArrayList<>();
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        heartbeatRegistry.put(getInstanceKey(instance), System.currentTimeMillis());
    }
    
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getServiceId() + "@" + instance.getHost() + ":" + instance.getPort();
    }
    
    private void cleanupExpiredInstances() {
        long currentTime = System.currentTimeMillis();
        heartbeatRegistry.entrySet().removeIf(entry -> {
            if (currentTime - entry.getValue() > HEARTBEAT_TIMEOUT) {
                String[] parts = entry.getKey().split("@");
                String serviceId = parts[0];
                String[] hostPort = parts[1].split(":");
                String host = hostPort[0];
                int port = Integer.parseInt(hostPort[1]);
                
                // 从服务注册表中移除过期实例
                List<ServiceInstance> instances = serviceRegistry.get(serviceId);
                if (instances != null) {
                    instances.removeIf(si -> si.getHost().equals(host) && si.getPort() == port);
                }
                return true;
            }
            return false;
        });
    }
}

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
        registryCenter.register(instance);
        
        // 启动心跳
        startHeartbeat(instance);
    }
    
    public void stop() {
        // 取消注册
        ServiceInstance instance = new ServiceInstance(serviceId, host, port);
        registryCenter.unregister(instance);
        
        // 停止心跳
        heartbeatScheduler.shutdown();
    }
    
    private void startHeartbeat(ServiceInstance instance) {
        heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                registryCenter.heartbeat(instance);
                System.out.println("Heartbeat sent for service: " + serviceId);
            } catch (Exception e) {
                System.err.println("Heartbeat failed: " + e.getMessage());
            }
        }, 0, 10, TimeUnit.SECONDS); // 每10秒发送一次心跳
    }
}

// 服务消费者
public class ServiceConsumer {
    private RegistryCenter registryCenter;
    
    public ServiceConsumer(RegistryCenter registryCenter) {
        this.registryCenter = registryCenter;
    }
    
    public ServiceInstance selectInstance(String serviceId) {
        List<ServiceInstance> instances = registryCenter.discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceId);
        }
        
        // 简单的随机选择
        Random random = new Random();
        return instances.get(random.nextInt(instances.size()));
    }
}
```

## 常见的服务发现方案

### Zookeeper

Zookeeper 是 Apache 的一个分布式协调服务，广泛用于服务发现：

```java
// 基于 Zookeeper 的服务发现实现
public class ZookeeperRegistryCenter implements RegistryCenter {
    private CuratorFramework client;
    private static final String BASE_PATH = "/services";
    
    public ZookeeperRegistryCenter(String connectString) {
        client = CuratorFrameworkFactory.newClient(connectString, new ExponentialBackoffRetry(1000, 3));
        client.start();
    }
    
    @Override
    public void register(ServiceInstance instance) {
        try {
            String path = BASE_PATH + "/" + instance.getServiceId() + "/" + 
                         instance.getHost() + ":" + instance.getPort();
            String data = instance.getMetadata() != null ? instance.getMetadata() : "";
            client.create().creatingParentsIfNeeded().withMode(CreateMode.EPHEMERAL)
                  .forPath(path, data.getBytes());
            System.out.println("Service registered in Zookeeper: " + path);
        } catch (Exception e) {
            throw new RuntimeException("Failed to register service", e);
        }
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        try {
            String path = BASE_PATH + "/" + instance.getServiceId() + "/" + 
                         instance.getHost() + ":" + instance.getPort();
            client.delete().forPath(path);
            System.out.println("Service unregistered from Zookeeper: " + path);
        } catch (Exception e) {
            throw new RuntimeException("Failed to unregister service", e);
        }
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        try {
            String path = BASE_PATH + "/" + serviceId;
            List<String> children = client.getChildren().forPath(path);
            List<ServiceInstance> instances = new ArrayList<>();
            
            for (String child : children) {
                String[] parts = child.split(":");
                if (parts.length == 2) {
                    String host = parts[0];
                    int port = Integer.parseInt(parts[1]);
                    instances.add(new ServiceInstance(serviceId, host, port));
                }
            }
            
            return instances;
        } catch (Exception e) {
            throw new RuntimeException("Failed to discover services", e);
        }
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        // Zookeeper 通过临时节点自动处理心跳
    }
}
```

### Consul

Consul 是 HashiCorp 开发的服务发现和配置管理工具：

```java
// 基于 Consul 的服务发现实现
public class ConsulRegistryCenter implements RegistryCenter {
    private ConsulClient consulClient;
    
    public ConsulRegistryCenter(String host, int port) {
        this.consulClient = new ConsulClient(host, port);
    }
    
    @Override
    public void register(ServiceInstance instance) {
        Registration registration = new Registration();
        registration.setId(instance.getServiceId() + "-" + instance.getHost() + "-" + instance.getPort());
        registration.setName(instance.getServiceId());
        registration.setAddress(instance.getHost());
        registration.setPort(instance.getPort());
        
        Registration.Check check = new Registration.Check();
        check.setHttp("http://" + instance.getHost() + ":" + instance.getPort() + "/health");
        check.setInterval("10s");
        registration.setCheck(check);
        
        consulClient.agentServiceRegister(registration);
        System.out.println("Service registered in Consul: " + instance.getServiceId());
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        String serviceId = instance.getServiceId() + "-" + instance.getHost() + "-" + instance.getPort();
        consulClient.agentServiceDeregister(serviceId);
        System.out.println("Service unregistered from Consul: " + instance.getServiceId());
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        try {
            Response<List<HealthService>> response = consulClient.getHealthServices(serviceId, true, QueryParams.DEFAULT);
            List<HealthService> healthServices = response.getValue();
            List<ServiceInstance> instances = new ArrayList<>();
            
            for (HealthService healthService : healthServices) {
                Service service = healthService.getService();
                instances.add(new ServiceInstance(serviceId, service.getAddress(), service.getPort()));
            }
            
            return instances;
        } catch (Exception e) {
            throw new RuntimeException("Failed to discover services", e);
        }
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        // Consul 通过健康检查自动处理心跳
    }
}
```

### Nacos

Nacos 是阿里巴巴开源的服务发现和配置管理平台：

```java
// 基于 Nacos 的服务发现实现
public class NacosRegistryCenter implements RegistryCenter {
    private NamingService namingService;
    
    public NacosRegistryCenter(String serverAddr) {
        try {
            Properties properties = new Properties();
            properties.setProperty("serverAddr", serverAddr);
            this.namingService = NamingFactory.createNamingService(properties);
        } catch (Exception e) {
            throw new RuntimeException("Failed to create Nacos naming service", e);
        }
    }
    
    @Override
    public void register(ServiceInstance instance) {
        try {
            namingService.registerInstance(instance.getServiceId(), instance.getHost(), instance.getPort());
            System.out.println("Service registered in Nacos: " + instance.getServiceId());
        } catch (Exception e) {
            throw new RuntimeException("Failed to register service", e);
        }
    }
    
    @Override
    public void unregister(ServiceInstance instance) {
        try {
            namingService.deregisterInstance(instance.getServiceId(), instance.getHost(), instance.getPort());
            System.out.println("Service unregistered from Nacos: " + instance.getServiceId());
        } catch (Exception e) {
            throw new RuntimeException("Failed to unregister service", e);
        }
    }
    
    @Override
    public List<ServiceInstance> discover(String serviceId) {
        try {
            List<com.alibaba.nacos.api.naming.pojo.Instance> instances = 
                namingService.getAllInstances(serviceId);
            List<ServiceInstance> serviceInstances = new ArrayList<>();
            
            for (com.alibaba.nacos.api.naming.pojo.Instance instance : instances) {
                if (instance.isHealthy()) {
                    serviceInstances.add(new ServiceInstance(serviceId, instance.getIp(), instance.getPort()));
                }
            }
            
            return serviceInstances;
        } catch (Exception e) {
            throw new RuntimeException("Failed to discover services", e);
        }
    }
    
    @Override
    public void heartbeat(ServiceInstance instance) {
        // Nacos 自动处理心跳
    }
}
```

## 负载均衡策略

### 负载均衡器接口

```java
// 负载均衡器接口
public interface LoadBalancer {
    ServiceInstance select(List<ServiceInstance> instances);
}

// 负载均衡上下文
public class LoadBalancerContext {
    private String serviceId;
    private List<ServiceInstance> instances;
    private Map<String, Object> attributes;
    
    public LoadBalancerContext(String serviceId, List<ServiceInstance> instances) {
        this.serviceId = serviceId;
        this.instances = instances;
        this.attributes = new ConcurrentHashMap<>();
    }
    
    // getter 和 setter 方法
    public String getServiceId() { return serviceId; }
    public List<ServiceInstance> getInstances() { return instances; }
    public Map<String, Object> getAttributes() { return attributes; }
}
```

### 轮询（Round Robin）策略

轮询策略按顺序将请求分发到各个服务实例：

```java
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
```

### 随机（Random）策略

随机策略随机选择一个服务实例：

```java
public class RandomLoadBalancer implements LoadBalancer {
    private Random random = new Random();
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        int pos = random.nextInt(instances.size());
        return instances.get(pos);
    }
}
```

### 加权轮询（Weighted Round Robin）策略

加权轮询策略根据服务实例的权重分配请求：

```java
public class WeightedRoundRobinLoadBalancer implements LoadBalancer {
    private Map<String, Integer> weightMap = new ConcurrentHashMap<>();
    private Map<String, Integer> currentWeightMap = new ConcurrentHashMap<>();
    
    public void setWeight(String instanceKey, int weight) {
        weightMap.put(instanceKey, weight);
        currentWeightMap.put(instanceKey, 0);
    }
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        // 初始化权重
        for (ServiceInstance instance : instances) {
            String key = getInstanceKey(instance);
            if (!weightMap.containsKey(key)) {
                weightMap.put(key, 1);
                currentWeightMap.put(key, 0);
            }
        }
        
        // 加权轮询算法
        ServiceInstance selectedInstance = null;
        int totalWeight = 0;
        
        for (ServiceInstance instance : instances) {
            String key = getInstanceKey(instance);
            int weight = weightMap.get(key);
            int currentWeight = currentWeightMap.get(key);
            
            currentWeightMap.put(key, currentWeight + weight);
            totalWeight += weight;
            
            if (selectedInstance == null || currentWeightMap.get(key) > currentWeightMap.get(getInstanceKey(selectedInstance))) {
                selectedInstance = instance;
            }
        }
        
        // 更新选中实例的当前权重
        String selectedKey = getInstanceKey(selectedInstance);
        currentWeightMap.put(selectedKey, currentWeightMap.get(selectedKey) - totalWeight);
        
        return selectedInstance;
    }
    
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getHost() + ":" + instance.getPort();
    }
}
```

### 最少连接（Least Connections）策略

最少连接策略将请求发送到当前连接数最少的服务实例：

```java
public class LeastConnectionsLoadBalancer implements LoadBalancer {
    private Map<String, AtomicInteger> connectionCountMap = new ConcurrentHashMap<>();
    
    public void incrementConnection(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        connectionCountMap.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet();
    }
    
    public void decrementConnection(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        AtomicInteger count = connectionCountMap.get(key);
        if (count != null) {
            count.decrementAndGet();
        }
    }
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        ServiceInstance selectedInstance = instances.get(0);
        int minConnections = getConnectionCount(selectedInstance);
        
        for (ServiceInstance instance : instances) {
            int connections = getConnectionCount(instance);
            if (connections < minConnections) {
                selectedInstance = instance;
                minConnections = connections;
            }
        }
        
        return selectedInstance;
    }
    
    private int getConnectionCount(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        AtomicInteger count = connectionCountMap.get(key);
        return count != null ? count.get() : 0;
    }
    
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getHost() + ":" + instance.getPort();
    }
}
```

### 一致性哈希（Consistent Hashing）策略

一致性哈希策略根据请求参数的一致性哈希值选择服务实例：

```java
public class ConsistentHashLoadBalancer implements LoadBalancer {
    private TreeMap<Integer, ServiceInstance> circle = new TreeMap<>();
    private int virtualNodeCount = 160; // 虚拟节点数
    
    public void addInstance(ServiceInstance instance) {
        for (int i = 0; i < virtualNodeCount; i++) {
            String virtualNodeKey = instance.getHost() + ":" + instance.getPort() + "#" + i;
            int hash = getHash(virtualNodeKey);
            circle.put(hash, instance);
        }
    }
    
    public void removeInstance(ServiceInstance instance) {
        for (int i = 0; i < virtualNodeCount; i++) {
            String virtualNodeKey = instance.getHost() + ":" + instance.getPort() + "#" + i;
            int hash = getHash(virtualNodeKey);
            circle.remove(hash);
        }
    }
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        // 构建一致性哈希环
        circle.clear();
        for (ServiceInstance instance : instances) {
            addInstance(instance);
        }
        
        // 使用固定值进行测试
        return selectInstance("test-key");
    }
    
    public ServiceInstance selectInstance(String key) {
        if (circle.isEmpty()) {
            return null;
        }
        
        int hash = getHash(key);
        // 找到大于等于该哈希值的第一个节点
        SortedMap<Integer, ServiceInstance> tailMap = circle.tailMap(hash);
        int targetHash = tailMap.isEmpty() ? circle.firstKey() : tailMap.firstKey();
        return circle.get(targetHash);
    }
    
    private int getHash(String key) {
        // 简单的哈希实现
        return key.hashCode();
    }
}
```

## 服务发现与负载均衡的集成

### 服务发现负载均衡器

```java
// 集成服务发现和负载均衡的客户端
public class DiscoveryLoadBalancerClient {
    private RegistryCenter registryCenter;
    private LoadBalancer loadBalancer;
    
    public DiscoveryLoadBalancerClient(RegistryCenter registryCenter, LoadBalancer loadBalancer) {
        this.registryCenter = registryCenter;
        this.loadBalancer = loadBalancer;
    }
    
    public ServiceInstance selectServiceInstance(String serviceId) {
        // 发现服务实例
        List<ServiceInstance> instances = registryCenter.discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceId);
        }
        
        // 负载均衡选择
        return loadBalancer.select(instances);
    }
}

// RPC 客户端集成示例
public class RpcClientWithDiscovery {
    private DiscoveryLoadBalancerClient discoveryClient;
    private Map<String, ConnectionPool> connectionPools = new ConcurrentHashMap<>();
    
    public RpcClientWithDiscovery(RegistryCenter registryCenter, LoadBalancer loadBalancer) {
        this.discoveryClient = new DiscoveryLoadBalancerClient(registryCenter, loadBalancer);
    }
    
    public RpcResponse sendRequest(String serviceId, RpcRequest request) throws Exception {
        // 通过服务发现和负载均衡选择服务实例
        ServiceInstance instance = discoveryClient.selectServiceInstance(serviceId);
        
        // 获取连接池
        String poolKey = instance.getHost() + ":" + instance.getPort();
        ConnectionPool pool = connectionPools.computeIfAbsent(poolKey, 
            k -> new ConnectionPool(instance.getHost(), instance.getPort(), 10, 30000));
        
        // 获取连接并发送请求
        Socket socket = pool.getConnection();
        try {
            ObjectOutputStream output = new ObjectOutputStream(socket.getOutputStream());
            ObjectInputStream input = new ObjectInputStream(socket.getInputStream());
            
            // 发送请求
            output.writeObject(request);
            output.flush();
            
            // 接收响应
            return (RpcResponse) input.readObject();
        } finally {
            pool.releaseConnection(socket);
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
            Socket socket = new Socket();
            socket.connect(new InetSocketAddress(instance.getHost(), instance.getPort()), 3000); // 3秒超时
            socket.close();
            return true;
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
}

// 健康检查回调接口
public interface HealthCheckCallback {
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
    
    private void startPeriodicHealthCheck() {
        healthCheckScheduler.scheduleAtFixedRate(() -> {
            // 获取所有已注册的服务实例并进行健康检查
            // 这里简化处理，实际实现需要遍历所有服务实例
        }, 0, 30, TimeUnit.SECONDS); // 每30秒检查一次
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

## 配置管理

### 动态配置更新

```java
// 配置监听器
public interface ConfigurationListener {
    void onConfigurationChanged(String key, String value);
}

// 配置管理器
public class ConfigurationManager {
    private RegistryCenter registryCenter;
    private Map<String, String> configuration = new ConcurrentHashMap<>();
    private List<ConfigurationListener> listeners = new ArrayList<>();
    
    public ConfigurationManager(RegistryCenter registryCenter) {
        this.registryCenter = registryCenter;
        // 初始化配置
        loadConfiguration();
    }
    
    public String getProperty(String key, String defaultValue) {
        return configuration.getOrDefault(key, defaultValue);
    }
    
    public void setProperty(String key, String value) {
        configuration.put(key, value);
        // 通知监听器
        notifyListeners(key, value);
    }
    
    public void addConfigurationListener(ConfigurationListener listener) {
        listeners.add(listener);
    }
    
    private void loadConfiguration() {
        // 从注册中心加载配置
        // 这里简化处理
        configuration.put("loadbalancer.strategy", "roundrobin");
        configuration.put("discovery.heartbeat.interval", "10");
    }
    
    private void notifyListeners(String key, String value) {
        for (ConfigurationListener listener : listeners) {
            listener.onConfigurationChanged(key, value);
        }
    }
}

// 动态负载均衡器
public class DynamicLoadBalancer implements LoadBalancer, ConfigurationListener {
    private LoadBalancer currentLoadBalancer;
    private ConfigurationManager configurationManager;
    
    public DynamicLoadBalancer(ConfigurationManager configurationManager) {
        this.configurationManager = configurationManager;
        this.configurationManager.addConfigurationListener(this);
        // 初始化负载均衡器
        updateLoadBalancer();
    }
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        return currentLoadBalancer.select(instances);
    }
    
    @Override
    public void onConfigurationChanged(String key, String value) {
        if ("loadbalancer.strategy".equals(key)) {
            updateLoadBalancer();
        }
    }
    
    private void updateLoadBalancer() {
        String strategy = configurationManager.getProperty("loadbalancer.strategy", "roundrobin");
        switch (strategy.toLowerCase()) {
            case "random":
                currentLoadBalancer = new RandomLoadBalancer();
                break;
            case "weighted":
                currentLoadBalancer = new WeightedRoundRobinLoadBalancer();
                break;
            case "leastconn":
                currentLoadBalancer = new LeastConnectionsLoadBalancer();
                break;
            case "consistenthash":
                currentLoadBalancer = new ConsistentHashLoadBalancer();
                break;
            default:
                currentLoadBalancer = new RoundRobinLoadBalancer();
                break;
        }
        System.out.println("Load balancer updated to: " + strategy);
    }
}
```

## 最佳实践

### 1. 服务注册与发现的最佳实践

```java
// 优雅的服务注册与注销
public class GracefulServiceProvider {
    private ServiceProvider serviceProvider;
    private volatile boolean isRunning = false;
    
    public void start() {
        if (isRunning) {
            return;
        }
        
        try {
            serviceProvider.start();
            isRunning = true;
            
            // 注册关闭钩子
            Runtime.getRuntime().addShutdownHook(new Thread(this::stop));
        } catch (Exception e) {
            System.err.println("Failed to start service provider: " + e.getMessage());
        }
    }
    
    public void stop() {
        if (!isRunning) {
            return;
        }
        
        try {
            serviceProvider.stop();
            isRunning = false;
        } catch (Exception e) {
            System.err.println("Failed to stop service provider: " + e.getMessage());
        }
    }
}
```

### 2. 负载均衡的最佳实践

```java
// 智能负载均衡器
public class SmartLoadBalancer implements LoadBalancer {
    private LoadBalancer primaryLoadBalancer;
    private LoadBalancer fallbackLoadBalancer;
    private Map<String, Long> failureCountMap = new ConcurrentHashMap<>();
    private static final int FAILURE_THRESHOLD = 5;
    
    public SmartLoadBalancer(LoadBalancer primary, LoadBalancer fallback) {
        this.primaryLoadBalancer = primary;
        this.fallbackLoadBalancer = fallback;
    }
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        // 过滤掉失败次数过多的实例
        List<ServiceInstance> healthyInstances = instances.stream()
                .filter(instance -> getFailureCount(instance) < FAILURE_THRESHOLD)
                .collect(Collectors.toList());
        
        if (healthyInstances.isEmpty()) {
            // 如果没有健康实例，使用备用负载均衡器
            return fallbackLoadBalancer.select(instances);
        }
        
        return primaryLoadBalancer.select(healthyInstances);
    }
    
    public void recordFailure(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        failureCountMap.compute(key, (k, v) -> (v == null) ? 1 : v + 1);
    }
    
    public void recordSuccess(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        failureCountMap.remove(key);
    }
    
    private long getFailureCount(ServiceInstance instance) {
        String key = getInstanceKey(instance);
        return failureCountMap.getOrDefault(key, 0L);
    }
    
    private String getInstanceKey(ServiceInstance instance) {
        return instance.getHost() + ":" + instance.getPort();
    }
}
```

### 3. 监控与告警

```java
// 服务发现监控
public class DiscoveryMonitoring {
    private RegistryCenter registryCenter;
    private MetricRegistry metricRegistry;
    
    public DiscoveryMonitoring(RegistryCenter registryCenter) {
        this.registryCenter = registryCenter;
        this.metricRegistry = new MetricRegistry();
        // 注册监控指标
        registerMetrics();
    }
    
    private void registerMetrics() {
        // 注册服务实例数量指标
        metricRegistry.register("service.instances.count", (Gauge<Integer>) () -> {
            // 这里需要遍历所有服务并统计实例数量
            return 0; // 简化处理
        });
        
        // 注册发现延迟指标
        metricRegistry.timer("discovery.latency");
    }
    
    public List<ServiceInstance> monitoredDiscover(String serviceId) {
        Timer.Context context = metricRegistry.timer("discovery.latency").time();
        try {
            return registryCenter.discover(serviceId);
        } finally {
            context.stop();
        }
    }
}
```

## 总结

服务发现与负载均衡是现代分布式系统和微服务架构的核心组件。通过服务发现机制，客户端可以动态地发现和定位可用的服务实例，而负载均衡则确保请求能够合理地分发到各个服务实例上。

在实际应用中，我们需要根据具体场景选择合适的服务发现方案（如 Zookeeper、Consul、Nacos 等）和负载均衡策略（如轮询、随机、加权轮询、最少连接、一致性哈希等）。同时，还需要考虑健康检查、配置管理、监控告警等重要方面，以构建一个健壮、高效的服务治理体系。

通过本章的学习，我们应该能够：
1. 理解服务发现与负载均衡的基本概念和原理
2. 掌握常见的服务发现方案和负载均衡策略
3. 了解如何在 RPC 系统中集成服务发现与负载均衡
4. 掌握相关的最佳实践和注意事项

在后续章节中，我们将继续探讨 RPC 系统的其他核心组件，如容错机制、安全认证等，进一步加深对 RPC 技术的理解。