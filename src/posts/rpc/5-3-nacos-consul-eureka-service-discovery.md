---
title: Nacos/Consul/Eureka 实现服务发现
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

在微服务架构中，服务发现是实现服务治理的核心组件之一。除了 ZooKeeper 之外，Nacos、Consul 和 Eureka 也是业界广泛使用的服务发现解决方案。每种方案都有其独特的特性和优势，适用于不同的应用场景。本章将深入探讨这三种服务发现组件的实现原理和使用方法。

## 服务发现组件对比

### 核心特性对比

| 特性 | Nacos | Consul | Eureka |
|------|-------|--------|--------|
| 开发商 | 阿里巴巴 | HashiCorp | Netflix |
| 语言 | Java | Go | Java |
| 数据一致性 | Raft | Raft | AP |
| 健康检查 | TCP/HTTP/MySQL/Redis | TCP/HTTP/Docker | Client Beat |
| 负载均衡 | 权重/metadata | 权重 | Ribbon |
| 配置管理 | 支持 | 支持 | 不支持 |
| 多数据中心 | 支持 | 支持 | 不支持 |
| 跨语言支持 | 支持 | 支持 | 有限 |
| CAP理论 | CP+AP | CP | AP |

### 适用场景

1. **Nacos**：适合需要配置管理和服务发现一体化的场景
2. **Consul**：适合多语言环境和复杂网络环境
3. **Eureka**：适合 Spring Cloud 生态系统

## Nacos 服务发现实现

### Nacos 简介

Nacos（Dynamic Naming and Configuration Service）是阿里巴巴开源的易于构建云原生应用的动态服务发现、配置管理和服务管理平台。

### 环境搭建

```bash
# 下载 Nacos
wget https://github.com/alibaba/nacos/releases/download/2.0.3/nacos-server-2.0.3.tar.gz

# 解压
tar -zxvf nacos-server-2.0.3.tar.gz
cd nacos/bin

# 启动（单机模式）
sh startup.sh -m standalone

# 访问控制台 http://localhost:8848/nacos
# 默认用户名密码：nacos/nacos
```

### 添加依赖

```xml
<!-- Nacos 客户端依赖 -->
<dependency>
    <groupId>com.alibaba.nacos</groupId>
    <artifactId>nacos-client</artifactId>
    <version>2.0.3</version>
</dependency>

<!-- Spring Cloud Alibaba Nacos Discovery -->
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-nacos-discovery</artifactId>
    <version>2021.1</version>
</dependency>
```

### Nacos 服务注册中心实现

```java
import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.exception.NacosException;
import com.alibaba.nacos.api.naming.NamingService;
import com.alibaba.nacos.api.naming.pojo.Instance;
import java.util.*;

// 基于 Nacos 的服务注册中心
public class NacosRegistryCenter {
    private NamingService namingService;
    private String serverAddr;
    
    public NacosRegistryCenter(String serverAddr) throws NacosException {
        this.serverAddr = serverAddr;
        Properties properties = new Properties();
        properties.setProperty("serverAddr", serverAddr);
        this.namingService = NacosFactory.createNamingService(properties);
    }
    
    // 服务注册
    public void register(ServiceInstance instance) throws NacosException {
        Instance nacosInstance = new Instance();
        nacosInstance.setInstanceId(instance.getInstanceId());
        nacosInstance.setServiceName(instance.getServiceId());
        nacosInstance.setIp(instance.getHost());
        nacosInstance.setPort(instance.getPort());
        nacosInstance.setHealthy(true);
        nacosInstance.setEnabled(true);
        nacosInstance.setEphemeral(true); // 临时实例
        
        // 设置元数据
        Map<String, String> metadata = new HashMap<>();
        metadata.put("version", instance.getMetadata().getOrDefault("version", "1.0.0"));
        metadata.put("zone", instance.getMetadata().getOrDefault("zone", "default"));
        metadata.put("weight", instance.getMetadata().getOrDefault("weight", "100"));
        nacosInstance.setMetadata(metadata);
        
        namingService.registerInstance(instance.getServiceId(), nacosInstance);
        System.out.println("Service registered in Nacos: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务注销
    public void unregister(ServiceInstance instance) throws NacosException {
        namingService.deregisterInstance(instance.getServiceId(), 
                                       instance.getHost(), instance.getPort());
        System.out.println("Service unregistered from Nacos: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务发现
    public List<ServiceInstance> discover(String serviceId) throws NacosException {
        List<com.alibaba.nacos.api.naming.pojo.Instance> instances = 
            namingService.getAllInstances(serviceId);
        
        List<ServiceInstance> serviceInstances = new ArrayList<>();
        for (com.alibaba.nacos.api.naming.pojo.Instance instance : instances) {
            if (instance.isHealthy()) {
                ServiceInstance serviceInstance = new ServiceInstance();
                serviceInstance.setServiceId(instance.getServiceName());
                serviceInstance.setInstanceId(instance.getInstanceId());
                serviceInstance.setHost(instance.getIp());
                serviceInstance.setPort(instance.getPort());
                serviceInstance.setStatus(ServiceStatus.UP);
                
                // 设置元数据
                Map<String, String> metadata = instance.getMetadata();
                serviceInstance.setMetadata(metadata);
                
                serviceInstances.add(serviceInstance);
            }
        }
        
        return serviceInstances;
    }
    
    // 订阅服务变化
    public void subscribe(String serviceId, ServiceInstancesChangeListener listener) 
            throws NacosException {
        namingService.subscribe(serviceId, event -> {
            if (event instanceof com.alibaba.nacos.api.naming.listener.NamingEvent) {
                com.alibaba.nacos.api.naming.listener.NamingEvent namingEvent = 
                    (com.alibaba.nacos.api.naming.listener.NamingEvent) event;
                
                List<ServiceInstance> serviceInstances = new ArrayList<>();
                for (com.alibaba.nacos.api.naming.pojo.Instance instance : namingEvent.getInstances()) {
                    if (instance.isHealthy()) {
                        ServiceInstance serviceInstance = new ServiceInstance();
                        serviceInstance.setServiceId(instance.getServiceName());
                        serviceInstance.setInstanceId(instance.getInstanceId());
                        serviceInstance.setHost(instance.getIp());
                        serviceInstance.setPort(instance.getPort());
                        serviceInstance.setStatus(ServiceStatus.UP);
                        serviceInstance.setMetadata(instance.getMetadata());
                        serviceInstances.add(serviceInstance);
                    }
                }
                
                listener.onServiceInstancesChanged(serviceId, serviceInstances);
            }
        });
    }
    
    // 关闭连接
    public void close() {
        // Nacos 客户端会自动管理连接
    }
    
    // 获取原生 NamingService
    public NamingService getNamingService() {
        return namingService;
    }
}

// 服务实例类
class ServiceInstance {
    private String serviceId;
    private String instanceId;
    private String host;
    private int port;
    private String scheme;
    private Map<String, String> metadata;
    private ServiceStatus status;
    private long registerTime;
    private long lastHeartbeatTime;
    
    public ServiceInstance() {
        this.instanceId = java.util.UUID.randomUUID().toString();
        this.registerTime = System.currentTimeMillis();
        this.lastHeartbeatTime = System.currentTimeMillis();
        this.status = ServiceStatus.UP;
        this.metadata = new java.util.concurrent.ConcurrentHashMap<>();
        this.scheme = "http";
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
                '}';
    }
}

// 服务状态枚举
enum ServiceStatus {
    UP, DOWN, STARTING, OUT_OF_SERVICE
}

// 服务实例变更监听器接口
interface ServiceInstancesChangeListener {
    void onServiceInstancesChanged(String serviceId, List<ServiceInstance> instances);
}
```

### Nacos 服务提供者

```java
// Nacos 服务提供者
public class NacosServiceProvider {
    private NacosRegistryCenter registryCenter;
    private ServiceInstance serviceInstance;
    
    public NacosServiceProvider(NacosRegistryCenter registryCenter, 
                               String serviceId, String host, int port) {
        this.registryCenter = registryCenter;
        this.serviceInstance = new ServiceInstance(serviceId, host, port);
    }
    
    // 启动服务提供者
    public void start() throws Exception {
        // 添加元数据
        serviceInstance.addMetadata("version", "1.0.0");
        serviceInstance.addMetadata("zone", "default");
        serviceInstance.addMetadata("weight", "100");
        
        // 注册服务
        registryCenter.register(serviceInstance);
        
        System.out.println("Nacos service provider started: " + serviceInstance.getServiceId() + 
                          " at " + serviceInstance.getHost() + ":" + serviceInstance.getPort());
    }
    
    // 停止服务提供者
    public void stop() throws Exception {
        // 注销服务
        registryCenter.unregister(serviceInstance);
        
        System.out.println("Nacos service provider stopped: " + serviceInstance.getServiceId());
    }
    
    // 更新服务元数据
    public void updateMetadata(String key, String value) throws Exception {
        serviceInstance.addMetadata(key, value);
        // 重新注册以更新元数据
        registryCenter.register(serviceInstance);
    }
    
    // 获取服务实例
    public ServiceInstance getServiceInstance() {
        return serviceInstance;
    }
}

// Nacos 服务提供者示例
public class NacosServiceProviderExample {
    public static void main(String[] args) {
        try {
            NacosRegistryCenter registryCenter = new NacosRegistryCenter("localhost:8848");
            
            // 创建用户服务提供者
            NacosServiceProvider userServiceProvider = new NacosServiceProvider(
                registryCenter, "UserService", "localhost", 8081);
            
            // 创建订单服务提供者
            NacosServiceProvider orderServiceProvider = new NacosServiceProvider(
                registryCenter, "OrderService", "localhost", 8082);
            
            // 启动服务提供者
            userServiceProvider.start();
            orderServiceProvider.start();
            
            // 运行一段时间
            Thread.sleep(120000); // 运行2分钟
            
            // 停止服务提供者
            userServiceProvider.stop();
            orderServiceProvider.stop();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### Nacos 服务消费者

```java
// Nacos 服务消费者
public class NacosServiceConsumer {
    private NacosRegistryCenter registryCenter;
    private LoadBalancer loadBalancer;
    
    public NacosServiceConsumer(NacosRegistryCenter registryCenter) {
        this.registryCenter = registryCenter;
        this.loadBalancer = new RandomLoadBalancer();
    }
    
    // 选择服务实例
    public ServiceInstance selectInstance(String serviceId) throws Exception {
        List<ServiceInstance> instances = registryCenter.discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceId);
        }
        
        return loadBalancer.select(instances);
    }
    
    // 获取所有服务实例
    public List<ServiceInstance> getAllInstances(String serviceId) throws Exception {
        return registryCenter.discover(serviceId);
    }
    
    // 订阅服务变化
    public void subscribeService(String serviceId, ServiceInstancesChangeListener listener) 
            throws Exception {
        registryCenter.subscribe(serviceId, listener);
    }
    
    // 设置负载均衡器
    public void setLoadBalancer(LoadBalancer loadBalancer) {
        this.loadBalancer = loadBalancer;
    }
}

// 负载均衡器接口
interface LoadBalancer {
    ServiceInstance select(List<ServiceInstance> instances);
}

// 随机负载均衡器
class RandomLoadBalancer implements LoadBalancer {
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        int index = java.util.concurrent.ThreadLocalRandom.current().nextInt(instances.size());
        return instances.get(index);
    }
}

// 轮询负载均衡器
class RoundRobinLoadBalancer implements LoadBalancer {
    private java.util.concurrent.atomic.AtomicInteger index = 
        new java.util.concurrent.atomic.AtomicInteger(0);
    
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        int pos = Math.abs(index.getAndIncrement()) % instances.size();
        return instances.get(pos);
    }
}

// 加权随机负载均衡器
class WeightedRandomLoadBalancer implements LoadBalancer {
    @Override
    public ServiceInstance select(List<ServiceInstance> instances) {
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances");
        }
        
        // 计算总权重
        int totalWeight = instances.stream()
            .mapToInt(instance -> {
                String weightStr = instance.getMetadata("weight");
                return weightStr != null ? Integer.parseInt(weightStr) : 1;
            })
            .sum();
        
        // 随机选择
        int randomWeight = java.util.concurrent.ThreadLocalRandom.current().nextInt(totalWeight);
        int currentWeight = 0;
        
        for (ServiceInstance instance : instances) {
            String weightStr = instance.getMetadata("weight");
            int weight = weightStr != null ? Integer.parseInt(weightStr) : 1;
            currentWeight += weight;
            
            if (randomWeight < currentWeight) {
                return instance;
            }
        }
        
        return instances.get(0);
    }
}

// Nacos 服务消费者示例
public class NacosServiceConsumerExample {
    public static void main(String[] args) {
        try {
            NacosRegistryCenter registryCenter = new NacosRegistryCenter("localhost:8848");
            NacosServiceConsumer consumer = new NacosServiceConsumer(registryCenter);
            
            // 设置负载均衡器
            consumer.setLoadBalancer(new WeightedRandomLoadBalancer());
            
            // 订阅服务变化
            consumer.subscribeService("UserService", new ServiceInstancesChangeListener() {
                @Override
                public void onServiceInstancesChanged(String serviceId, List<ServiceInstance> instances) {
                    System.out.println("Service instances changed for: " + serviceId);
                    for (ServiceInstance instance : instances) {
                        System.out.println("  Instance: " + instance.getHost() + ":" + instance.getPort());
                    }
                }
            });
            
            // 选择实例
            for (int i = 0; i < 10; i++) {
                ServiceInstance instance = consumer.selectInstance("UserService");
                System.out.println("Selected instance: " + instance.getHost() + ":" + instance.getPort() +
                                 " (weight: " + instance.getMetadata("weight") + ")");
                Thread.sleep(1000);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

## Consul 服务发现实现

### Consul 简介

Consul 是 HashiCorp 公司推出的开源工具，用于实现分布式系统的服务发现与配置。与其他分布式服务注册与发现方案相比，Consul 的方案更"一站式"。

### 环境搭建

```bash
# 下载 Consul
wget https://releases.hashicorp.com/consul/1.10.3/consul_1.10.3_linux_amd64.zip

# 解压
unzip consul_1.10.3_linux_amd64.zip

# 启动（开发模式）
./consul agent -dev

# 访问控制台 http://localhost:8500
```

### 添加依赖

```xml
<!-- Consul 客户端依赖 -->
<dependency>
    <groupId>com.orbitz.consul</groupId>
    <artifactId>consul-client</artifactId>
    <version>1.5.3</version>
</dependency>

<!-- Spring Cloud Consul Discovery -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-consul-discovery</artifactId>
    <version>3.0.3</version>
</dependency>
```

### Consul 服务注册中心实现

```java
import com.orbitz.consul.Consul;
import com.orbitz.consul.HealthClient;
import com.orbitz.consul.KeyValueClient;
import com.orbitz.consul.model.agent.ImmutableRegCheck;
import com.orbitz.consul.model.agent.ImmutableRegistration;
import com.orbitz.consul.model.health.ServiceHealth;

import java.util.*;

// 基于 Consul 的服务注册中心
public class ConsulRegistryCenter {
    private Consul consul;
    private String agentHost;
    private int agentPort;
    
    public ConsulRegistryCenter(String agentHost, int agentPort) {
        this.agentHost = agentHost;
        this.agentPort = agentPort;
        this.consul = Consul.builder()
            .withHostAndPort(com.orbitz.consul.config.HostAndPort.fromParts(agentHost, agentPort))
            .build();
    }
    
    // 服务注册
    public void register(ServiceInstance instance) throws Exception {
        String serviceId = instance.getServiceId() + "-" + instance.getInstanceId();
        
        // 构建健康检查
        ImmutableRegCheck check = ImmutableRegCheck.builder()
            .id("check-" + serviceId)
            .name("HTTP check for " + serviceId)
            .http("http://" + instance.getHost() + ":" + instance.getPort() + "/health")
            .interval("10s")
            .timeout("1s")
            .build();
        
        // 构建服务注册信息
        ImmutableRegistration registration = ImmutableRegistration.builder()
            .id(serviceId)
            .name(instance.getServiceId())
            .address(instance.getHost())
            .port(instance.getPort())
            .tags(Arrays.asList("version=" + instance.getMetadata().getOrDefault("version", "1.0.0"),
                              "zone=" + instance.getMetadata().getOrDefault("zone", "default")))
            .check(check)
            .meta(instance.getMetadata())
            .build();
        
        consul.agentClient().register(registration);
        System.out.println("Service registered in Consul: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务注销
    public void unregister(ServiceInstance instance) throws Exception {
        String serviceId = instance.getServiceId() + "-" + instance.getInstanceId();
        consul.agentClient().deregister(serviceId);
        System.out.println("Service unregistered from Consul: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务发现
    public List<ServiceInstance> discover(String serviceId) throws Exception {
        HealthClient healthClient = consul.healthClient();
        List<ServiceHealth> services = healthClient.getHealthyServiceInstances(serviceId).getResponse();
        
        List<ServiceInstance> serviceInstances = new ArrayList<>();
        for (ServiceHealth serviceHealth : services) {
            com.orbitz.consul.model.catalog.Service service = serviceHealth.getService();
            
            ServiceInstance serviceInstance = new ServiceInstance();
            serviceInstance.setServiceId(service.getService());
            serviceInstance.setInstanceId(service.getId().replace(service.getService() + "-", ""));
            serviceInstance.setHost(service.getAddress());
            serviceInstance.setPort(service.getPort());
            serviceInstance.setStatus(ServiceStatus.UP);
            serviceInstance.setMetadata(service.getMeta());
            
            serviceInstances.add(serviceInstance);
        }
        
        return serviceInstances;
    }
    
    // 获取所有服务
    public List<String> getAllServices() throws Exception {
        return new ArrayList<>(consul.agentClient().services().getResponse().keySet());
    }
    
    // 检查服务是否存在
    public boolean serviceExists(String serviceId) throws Exception {
        return consul.agentClient().services().getResponse().containsKey(serviceId);
    }
    
    // 关闭连接
    public void close() {
        if (consul != null) {
            consul.destroy();
        }
    }
    
    // 获取原生 Consul 客户端
    public Consul getConsul() {
        return consul;
    }
}
```

## Eureka 服务发现实现

### Eureka 简介

Eureka 是 Netflix 开源的服务发现框架，主要用于定位运行在 AWS 域中的中间层服务，以实现中间层服务之间的负载均衡和故障转移。

### 环境搭建

```xml
<!-- Eureka Server 依赖 -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
    <version>3.0.3</version>
</dependency>

<!-- Eureka Client 依赖 -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
    <version>3.0.3</version>
</dependency>
```

### Eureka 服务注册中心实现

```java
import com.netflix.appinfo.ApplicationInfoManager;
import com.netflix.appinfo.EurekaInstanceConfig;
import com.netflix.appinfo.InstanceInfo;
import com.netflix.appinfo.MyDataCenterInstanceConfig;
import com.netflix.appinfo.providers.EurekaConfigBasedInstanceInfoProvider;
import com.netflix.discovery.DefaultEurekaClientConfig;
import com.netflix.discovery.DiscoveryClient;
import com.netflix.discovery.EurekaClient;
import com.netflix.discovery.EurekaClientConfig;

import java.util.*;

// 基于 Eureka 的服务注册中心
public class EurekaRegistryCenter {
    private ApplicationInfoManager applicationInfoManager;
    private EurekaClient eurekaClient;
    
    public EurekaRegistryCenter(String eurekaServerUrl) {
        // 配置实例信息
        EurekaInstanceConfig instanceConfig = new MyDataCenterInstanceConfig();
        InstanceInfo instanceInfo = new EurekaConfigBasedInstanceInfoProvider(instanceConfig).get();
        applicationInfoManager = new ApplicationInfoManager(instanceConfig, instanceInfo);
        
        // 配置客户端
        EurekaClientConfig clientConfig = new DefaultEurekaClientConfig() {
            @Override
            public List<String> getEurekaServerServiceUrls(String myZone) {
                return Arrays.asList(eurekaServerUrl);
            }
        };
        
        eurekaClient = new DiscoveryClient(applicationInfoManager, clientConfig);
    }
    
    // 服务注册
    public void register(ServiceInstance instance) throws Exception {
        // Eureka 通过 ApplicationInfoManager 和 DiscoveryClient 自动处理注册
        // 这里主要是设置实例信息
        applicationInfoManager.getInfo().setStatus(InstanceInfo.InstanceStatus.UP);
        
        System.out.println("Service registered in Eureka: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务注销
    public void unregister(ServiceInstance instance) throws Exception {
        eurekaClient.shutdown();
        System.out.println("Service unregistered from Eureka: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务发现
    public List<ServiceInstance> discover(String serviceId) throws Exception {
        List<InstanceInfo> instances = eurekaClient.getInstancesByVipAddress(serviceId, false);
        
        List<ServiceInstance> serviceInstances = new ArrayList<>();
        for (InstanceInfo instanceInfo : instances) {
            if (instanceInfo.getStatus() == InstanceInfo.InstanceStatus.UP) {
                ServiceInstance serviceInstance = new ServiceInstance();
                serviceInstance.setServiceId(instanceInfo.getAppName());
                serviceInstance.setInstanceId(instanceInfo.getInstanceId());
                serviceInstance.setHost(instanceInfo.getHostName());
                serviceInstance.setPort(instanceInfo.getPort());
                serviceInstance.setStatus(ServiceStatus.UP);
                
                // 设置元数据
                Map<String, String> metadata = instanceInfo.getMetadata();
                serviceInstance.setMetadata(metadata != null ? metadata : new HashMap<>());
                
                serviceInstances.add(serviceInstance);
            }
        }
        
        return serviceInstances;
    }
    
    // 关闭连接
    public void close() {
        if (eurekaClient != null) {
            eurekaClient.shutdown();
        }
    }
}
```

## 统一服务发现接口

### 抽象服务发现接口

```java
// 统一的服务发现接口
public interface ServiceDiscovery {
    void register(ServiceInstance instance) throws Exception;
    void unregister(ServiceInstance instance) throws Exception;
    List<ServiceInstance> discover(String serviceId) throws Exception;
    void subscribe(String serviceId, ServiceInstancesChangeListener listener) throws Exception;
    void unsubscribe(String serviceId, ServiceInstancesChangeListener listener) throws Exception;
}

// 服务发现工厂
public class ServiceDiscoveryFactory {
    public static ServiceDiscovery createServiceDiscovery(String type, String config) 
            throws Exception {
        switch (type.toLowerCase()) {
            case "nacos":
                return new NacosRegistryCenter(config);
            case "consul":
                String[] consulConfig = config.split(":");
                return new ConsulRegistryCenter(consulConfig[0], 
                    consulConfig.length > 1 ? Integer.parseInt(consulConfig[1]) : 8500);
            case "eureka":
                return new EurekaRegistryCenter(config);
            case "zookeeper":
                return new ZookeeperRegistryCenter(config);
            default:
                throw new IllegalArgumentException("Unsupported service discovery type: " + type);
        }
    }
}

// 统一的服务消费者
public class UnifiedServiceConsumer {
    private ServiceDiscovery serviceDiscovery;
    private LoadBalancer loadBalancer;
    
    public UnifiedServiceConsumer(ServiceDiscovery serviceDiscovery) {
        this.serviceDiscovery = serviceDiscovery;
        this.loadBalancer = new RandomLoadBalancer();
    }
    
    public ServiceInstance selectInstance(String serviceId) throws Exception {
        List<ServiceInstance> instances = serviceDiscovery.discover(serviceId);
        if (instances.isEmpty()) {
            throw new RuntimeException("No available instances for service: " + serviceId);
        }
        
        return loadBalancer.select(instances);
    }
    
    public List<ServiceInstance> getAllInstances(String serviceId) throws Exception {
        return serviceDiscovery.discover(serviceId);
    }
    
    public void subscribeService(String serviceId, ServiceInstancesChangeListener listener) 
            throws Exception {
        serviceDiscovery.subscribe(serviceId, listener);
    }
    
    public void setLoadBalancer(LoadBalancer loadBalancer) {
        this.loadBalancer = loadBalancer;
    }
}
```

## 总结

通过本章的学习，我们深入了解了 Nacos、Consul 和 Eureka 三种主流服务发现组件的实现原理和使用方法。关键要点包括：

1. **Nacos**：提供了服务发现和配置管理一体化的解决方案，支持丰富的元数据和权重配置
2. **Consul**：基于 Go 语言实现，具有强大的健康检查和多数据中心支持
3. **Eureka**：Spring Cloud 生态系统的核心组件，简单易用但已停止维护

每种服务发现组件都有其独特的优势：

- **Nacos** 适合需要配置管理和服务发现一体化的场景
- **Consul** 适合多语言环境和复杂网络环境
- **Eureka** 适合 Spring Cloud 生态系统（尽管已停止维护）

在实际应用中，我们可以根据具体需求选择合适的服务发现组件，或者通过统一接口实现多组件的兼容支持。通过合理的设计和实现，可以构建出高可用、高性能的微服务架构。

在下一章中，我们将探讨客户端负载均衡策略，进一步完善 RPC 框架的服务治理能力。