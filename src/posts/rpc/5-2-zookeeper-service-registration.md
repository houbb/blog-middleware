---
title: Zookeeper 实现服务注册
date: 2025-08-30
categories: [rpc]
tags: [rpc]
published: true
---

Apache ZooKeeper 是一个开源的分布式协调服务，广泛用于分布式系统中的配置管理、命名服务、分布式同步和组服务等场景。在 RPC 框架中，ZooKeeper 常被用作服务注册中心，提供高可用、一致性的服务注册与发现功能。本章将深入探讨如何使用 ZooKeeper 实现服务注册功能。

## ZooKeeper 基础知识

### 什么是 ZooKeeper

ZooKeeper 是一个分布式的、开源的协调服务，由 Apache 软件基金会维护。它提供了简单的原语集，分布式应用程序可以基于这些原语实现更高级别的服务，如配置管理、命名服务、分布式同步等。

### ZooKeeper 的核心特性

1. **简单性**：提供简单的文件系统接口
2. **高可用性**：通过集群部署实现高可用
3. **顺序一致性**：客户端的更新操作按照发送顺序应用
4. **原子性**：更新操作要么成功要么失败，没有中间状态
5. **单一视图**：客户端无论连接到哪个服务器，看到的服务视图都是一致的
6. **可靠性**：一旦更新成功，除非被另一个更新覆盖，否则该更新将一直保持
7. **实时性**：在特定时间范围内，客户端看到的系统视图是最新的

### ZooKeeper 数据模型

ZooKeeper 提供了一个类似文件系统的层次化命名空间，其中的数据存储在称为 znode 的节点中。每个 znode 都可以通过路径来标识，就像文件系统中的文件和目录一样。

## ZooKeeper 环境搭建

### 安装 ZooKeeper

首先需要安装和配置 ZooKeeper：

```bash
# 下载 ZooKeeper
wget https://archive.apache.org/dist/zookeeper/zookeeper-3.7.0/apache-zookeeper-3.7.0-bin.tar.gz

# 解压
tar -zxvf apache-zookeeper-3.7.0-bin.tar.gz
cd apache-zookeeper-3.7.0-bin

# 复制配置文件
cp conf/zoo_sample.cfg conf/zoo.cfg

# 启动 ZooKeeper
bin/zkServer.sh start
```

### ZooKeeper 配置文件

```properties
# zoo.cfg 配置示例
tickTime=2000
dataDir=/tmp/zookeeper
clientPort=2181
initLimit=5
syncLimit=2

# 集群配置示例
server.1=localhost:2888:3888
server.2=localhost:2889:3889
server.3=localhost:2890:3890
```

## ZooKeeper Java 客户端

### 添加依赖

在项目中添加 ZooKeeper 客户端依赖：

```xml
<!-- Maven 依赖 -->
<dependency>
    <groupId>org.apache.zookeeper</groupId>
    <artifactId>zookeeper</artifactId>
    <version>3.7.0</version>
</dependency>

<!-- Curator 框架（推荐使用） -->
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-framework</artifactId>
    <version>5.2.0</version>
</dependency>
<dependency>
    <groupId>org.apache.curator</groupId>
    <artifactId>curator-recipes</artifactId>
    <version>5.2.0</version>
</dependency>
```

### 基础 ZooKeeper 客户端

```java
import org.apache.zookeeper.*;
import org.apache.zookeeper.data.Stat;
import java.util.List;
import java.util.concurrent.CountDownLatch;

// 基础 ZooKeeper 客户端
public class BasicZookeeperClient {
    private ZooKeeper zooKeeper;
    private CountDownLatch connectedSignal = new CountDownLatch(1);
    
    public void connect(String connectString) throws Exception {
        zooKeeper = new ZooKeeper(connectString, 3000, new Watcher() {
            @Override
            public void process(WatchedEvent event) {
                if (event.getState() == Watcher.Event.KeeperState.SyncConnected) {
                    connectedSignal.countDown();
                }
            }
        });
        
        connectedSignal.await();
        System.out.println("Connected to ZooKeeper: " + connectString);
    }
    
    public void createNode(String path, String data, CreateMode mode) throws Exception {
        Stat stat = zooKeeper.exists(path, false);
        if (stat == null) {
            // 创建父节点
            createParentNodes(path);
        }
        
        zooKeeper.create(path, data.getBytes(), ZooDefs.Ids.OPEN_ACL_UNSAFE, mode);
        System.out.println("Created node: " + path);
    }
    
    private void createParentNodes(String path) throws Exception {
        String[] parts = path.split("/");
        StringBuilder currentPath = new StringBuilder();
        
        for (int i = 1; i < parts.length - 1; i++) {
            currentPath.append("/").append(parts[i]);
            Stat stat = zooKeeper.exists(currentPath.toString(), false);
            if (stat == null) {
                zooKeeper.create(currentPath.toString(), new byte[0], 
                    ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.PERSISTENT);
            }
        }
    }
    
    public String getNodeData(String path) throws Exception {
        byte[] data = zooKeeper.getData(path, false, null);
        return new String(data);
    }
    
    public List<String> getChildren(String path) throws Exception {
        return zooKeeper.getChildren(path, false);
    }
    
    public void updateNodeData(String path, String data) throws Exception {
        zooKeeper.setData(path, data.getBytes(), -1);
        System.out.println("Updated node: " + path);
    }
    
    public void deleteNode(String path) throws Exception {
        Stat stat = zooKeeper.exists(path, false);
        if (stat != null) {
            List<String> children = getChildren(path);
            for (String child : children) {
                deleteNode(path + "/" + child);
            }
            zooKeeper.delete(path, -1);
            System.out.println("Deleted node: " + path);
        }
    }
    
    public void close() throws InterruptedException {
        if (zooKeeper != null) {
            zooKeeper.close();
        }
    }
    
    public static void main(String[] args) {
        BasicZookeeperClient client = new BasicZookeeperClient();
        try {
            client.connect("localhost:2181");
            
            // 创建节点
            client.createNode("/test", "test data", CreateMode.PERSISTENT);
            client.createNode("/test/child", "child data", CreateMode.PERSISTENT);
            
            // 获取节点数据
            String data = client.getNodeData("/test");
            System.out.println("Node data: " + data);
            
            // 获取子节点
            List<String> children = client.getChildren("/test");
            System.out.println("Children: " + children);
            
            // 更新节点数据
            client.updateNodeData("/test", "updated data");
            
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                client.close();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}
```

## 基于 Curator 的高级客户端

### Curator 框架介绍

Curator 是 Netflix 开源的 ZooKeeper 客户端框架，提供了更高级的 API 和丰富的功能。

```java
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.retry.ExponentialBackoffRetry;
import org.apache.curator.framework.recipes.cache.*;
import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.data.Stat;

// 基于 Curator 的 ZooKeeper 客户端
public class CuratorZookeeperClient {
    private CuratorFramework client;
    
    public void connect(String connectString) {
        client = CuratorFrameworkFactory.newClient(connectString, 
            new ExponentialBackoffRetry(1000, 3));
        client.start();
        System.out.println("Connected to ZooKeeper: " + connectString);
    }
    
    public void createNode(String path, String data, CreateMode mode) throws Exception {
        client.create()
              .creatingParentsIfNeeded()
              .withMode(mode)
              .forPath(path, data.getBytes());
        System.out.println("Created node: " + path);
    }
    
    public String getNodeData(String path) throws Exception {
        byte[] data = client.getData().forPath(path);
        return new String(data);
    }
    
    public List<String> getChildren(String path) throws Exception {
        return client.getChildren().forPath(path);
    }
    
    public void updateNodeData(String path, String data) throws Exception {
        client.setData().forPath(path, data.getBytes());
        System.out.println("Updated node: " + path);
    }
    
    public void deleteNode(String path) throws Exception {
        client.delete().deletingChildrenIfNeeded().forPath(path);
        System.out.println("Deleted node: " + path);
    }
    
    public void addNodeListener(String path, NodeCacheListener listener) throws Exception {
        NodeCache nodeCache = new NodeCache(client, path);
        nodeCache.getListenable().addListener(listener);
        nodeCache.start();
    }
    
    public void addTreeListener(String path, TreeCacheListener listener) throws Exception {
        TreeCache treeCache = TreeCache.newBuilder(client, path).build();
        treeCache.getListenable().addListener(listener);
        treeCache.start();
    }
    
    public void close() {
        if (client != null) {
            client.close();
        }
    }
    
    public static void main(String[] args) {
        CuratorZookeeperClient client = new CuratorZookeeperClient();
        try {
            client.connect("localhost:2181");
            
            // 创建节点
            client.createNode("/curator/test", "test data", CreateMode.PERSISTENT);
            
            // 添加节点监听器
            client.addNodeListener("/curator/test", new NodeCacheListener() {
                @Override
                public void nodeChanged() throws Exception {
                    System.out.println("Node changed: /curator/test");
                }
            });
            
            // 更新节点数据
            Thread.sleep(1000);
            client.updateNodeData("/curator/test", "updated data");
            
            Thread.sleep(1000);
            
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            client.close();
        }
    }
}
```

## ZooKeeper 服务注册实现

### 服务注册中心设计

```java
import org.apache.curator.framework.CuratorFramework;
import org.apache.curator.framework.CuratorFrameworkFactory;
import org.apache.curator.retry.ExponentialBackoffRetry;
import org.apache.zookeeper.CreateMode;
import org.apache.zookeeper.data.Stat;
import com.fasterxml.jackson.databind.ObjectMapper;

// 基于 ZooKeeper 的服务注册中心
public class ZookeeperRegistryCenter {
    private CuratorFramework client;
    private String basePath = "/rpc/services";
    private ObjectMapper objectMapper = new ObjectMapper();
    
    public ZookeeperRegistryCenter(String connectString) {
        this.client = CuratorFrameworkFactory.newClient(connectString, 
            new ExponentialBackoffRetry(1000, 3));
        this.client.start();
    }
    
    // 服务注册
    public void register(ServiceInstance instance) throws Exception {
        String servicePath = basePath + "/" + instance.getServiceId();
        String instancePath = servicePath + "/" + instance.getInstanceId();
        
        // 创建服务节点（持久节点）
        Stat serviceStat = client.checkExists().forPath(servicePath);
        if (serviceStat == null) {
            client.create()
                  .creatingParentsIfNeeded()
                  .withMode(CreateMode.PERSISTENT)
                  .forPath(servicePath);
        }
        
        // 创建实例节点（临时节点）
        String instanceData = objectMapper.writeValueAsString(instance);
        client.create()
              .withMode(CreateMode.EPHEMERAL)
              .forPath(instancePath, instanceData.getBytes());
        
        System.out.println("Service registered: " + instance.getServiceId() + 
                          " instance: " + instance.getInstanceId());
    }
    
    // 服务注销
    public void unregister(ServiceInstance instance) throws Exception {
        String instancePath = basePath + "/" + instance.getServiceId() + 
                             "/" + instance.getInstanceId();
        
        Stat stat = client.checkExists().forPath(instancePath);
        if (stat != null) {
            client.delete().forPath(instancePath);
            System.out.println("Service unregistered: " + instance.getServiceId() + 
                              " instance: " + instance.getInstanceId());
        }
    }
    
    // 服务发现
    public List<ServiceInstance> discover(String serviceId) throws Exception {
        String servicePath = basePath + "/" + serviceId;
        Stat stat = client.checkExists().forPath(servicePath);
        
        if (stat == null) {
            return new ArrayList<>();
        }
        
        List<String> instanceIds = client.getChildren().forPath(servicePath);
        List<ServiceInstance> instances = new ArrayList<>();
        
        for (String instanceId : instanceIds) {
            String instancePath = servicePath + "/" + instanceId;
            byte[] data = client.getData().forPath(instancePath);
            String instanceData = new String(data);
            ServiceInstance instance = objectMapper.readValue(instanceData, ServiceInstance.class);
            instances.add(instance);
        }
        
        return instances;
    }
    
    // 获取所有服务
    public List<String> getAllServices() throws Exception {
        Stat stat = client.checkExists().forPath(basePath);
        if (stat == null) {
            return new ArrayList<>();
        }
        
        return client.getChildren().forPath(basePath);
    }
    
    // 检查服务是否存在
    public boolean serviceExists(String serviceId) throws Exception {
        String servicePath = basePath + "/" + serviceId;
        Stat stat = client.checkExists().forPath(servicePath);
        return stat != null;
    }
    
    // 关闭连接
    public void close() {
        if (client != null) {
            client.close();
        }
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
```

## 服务提供者实现

### ZooKeeper 服务提供者

```java
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

// ZooKeeper 服务提供者
public class ZookeeperServiceProvider {
    private ZookeeperRegistryCenter registryCenter;
    private ServiceInstance serviceInstance;
    private ScheduledExecutorService heartbeatScheduler;
    
    public ZookeeperServiceProvider(ZookeeperRegistryCenter registryCenter, 
                                   String serviceId, String host, int port) {
        this.registryCenter = registryCenter;
        this.serviceInstance = new ServiceInstance(serviceId, host, port);
        this.heartbeatScheduler = Executors.newSingleThreadScheduledExecutor();
    }
    
    // 启动服务提供者
    public void start() throws Exception {
        // 添加元数据
        serviceInstance.addMetadata("version", "1.0.0");
        serviceInstance.addMetadata("zone", "default");
        serviceInstance.addMetadata("weight", "100");
        
        // 注册服务
        registryCenter.register(serviceInstance);
        
        // 启动心跳
        startHeartbeat();
        
        System.out.println("Service provider started: " + serviceInstance.getServiceId() + 
                          " at " + serviceInstance.getHost() + ":" + serviceInstance.getPort());
    }
    
    // 停止服务提供者
    public void stop() throws Exception {
        // 停止心跳
        if (heartbeatScheduler != null) {
            heartbeatScheduler.shutdown();
        }
        
        // 注销服务
        registryCenter.unregister(serviceInstance);
        
        System.out.println("Service provider stopped: " + serviceInstance.getServiceId());
    }
    
    // 启动心跳机制
    private void startHeartbeat() {
        heartbeatScheduler.scheduleAtFixedRate(() -> {
            try {
                // 更新心跳时间
                serviceInstance.setLastHeartbeatTime(System.currentTimeMillis());
                
                // 重新注册以更新临时节点
                registryCenter.register(serviceInstance);
                
                System.out.println("Heartbeat sent for service: " + serviceInstance.getServiceId());
            } catch (Exception e) {
                System.err.println("Heartbeat failed for service: " + serviceInstance.getServiceId() + 
                                  ", error: " + e.getMessage());
            }
        }, 0, 30, TimeUnit.SECONDS); // 每30秒发送一次心跳
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

// 服务提供者示例
public class ServiceProviderExample {
    public static void main(String[] args) {
        ZookeeperRegistryCenter registryCenter = new ZookeeperRegistryCenter("localhost:2181");
        
        try {
            // 创建用户服务提供者
            ZookeeperServiceProvider userServiceProvider = new ZookeeperServiceProvider(
                registryCenter, "UserService", "localhost", 8081);
            
            // 创建订单服务提供者
            ZookeeperServiceProvider orderServiceProvider = new ZookeeperServiceProvider(
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
        } finally {
            registryCenter.close();
        }
    }
}
```

## 服务消费者实现

### ZooKeeper 服务消费者

```java
import org.apache.curator.framework.recipes.cache.NodeCache;
import org.apache.curator.framework.recipes.cache.NodeCacheListener;
import java.util.concurrent.ThreadLocalRandom;

// ZooKeeper 服务消费者
public class ZookeeperServiceConsumer {
    private ZookeeperRegistryCenter registryCenter;
    private LoadBalancer loadBalancer;
    
    public ZookeeperServiceConsumer(ZookeeperRegistryCenter registryCenter) {
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
    
    // 检查服务是否存在
    public boolean serviceExists(String serviceId) throws Exception {
        return registryCenter.serviceExists(serviceId);
    }
    
    // 获取所有服务列表
    public List<String> getAllServices() throws Exception {
        return registryCenter.getAllServices();
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
        
        int index = ThreadLocalRandom.current().nextInt(instances.size());
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
        int randomWeight = ThreadLocalRandom.current().nextInt(totalWeight);
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

// 服务消费者示例
public class ServiceConsumerExample {
    public static void main(String[] args) {
        ZookeeperRegistryCenter registryCenter = new ZookeeperRegistryCenter("localhost:2181");
        ZookeeperServiceConsumer consumer = new ZookeeperServiceConsumer(registryCenter);
        
        try {
            // 设置负载均衡器
            consumer.setLoadBalancer(new WeightedRandomLoadBalancer());
            
            // 检查服务是否存在
            if (consumer.serviceExists("UserService")) {
                System.out.println("UserService exists");
                
                // 获取所有实例
                List<ServiceInstance> instances = consumer.getAllInstances("UserService");
                System.out.println("UserService instances: " + instances.size());
                
                // 选择实例
                for (int i = 0; i < 10; i++) {
                    ServiceInstance instance = consumer.selectInstance("UserService");
                    System.out.println("Selected instance: " + instance.getHost() + ":" + instance.getPort() +
                                     " (weight: " + instance.getMetadata("weight") + ")");
                    Thread.sleep(1000);
                }
            } else {
                System.out.println("UserService not found");
            }
            
            // 获取所有服务
            List<String> services = consumer.getAllServices();
            System.out.println("All services: " + services);
            
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            registryCenter.close();
        }
    }
}
```

## 高级特性实现

### 服务监听机制

```java
import org.apache.curator.framework.recipes.cache.PathChildrenCache;
import org.apache.curator.framework.recipes.cache.PathChildrenCacheListener;
import org.apache.curator.framework.recipes.cache.PathChildrenCacheEvent;

// 服务变更监听器
public class ServiceChangeListener {
    private ZookeeperRegistryCenter registryCenter;
    private PathChildrenCache pathChildrenCache;
    
    public ServiceChangeListener(ZookeeperRegistryCenter registryCenter, String serviceId) 
            throws Exception {
        this.registryCenter = registryCenter;
        String servicePath = "/rpc/services/" + serviceId;
        
        this.pathChildrenCache = new PathChildrenCache(
            registryCenter.getClient(), servicePath, true);
    }
    
    public void startListening(ServiceInstancesChangeListener listener) throws Exception {
        pathChildrenCache.getListenable().addListener(new PathChildrenCacheListener() {
            @Override
            public void childEvent(CuratorFramework client, PathChildrenCacheEvent event) 
                    throws Exception {
                switch (event.getType()) {
                    case CHILD_ADDED:
                        System.out.println("Service instance added: " + 
                            event.getData().getPath());
                        break;
                    case CHILD_REMOVED:
                        System.out.println("Service instance removed: " + 
                            event.getData().getPath());
                        break;
                    case CHILD_UPDATED:
                        System.out.println("Service instance updated: " + 
                            event.getData().getPath());
                        break;
                }
                
                // 通知监听器
                String serviceId = extractServiceId(event.getData().getPath());
                List<ServiceInstance> instances = registryCenter.discover(serviceId);
                listener.onServiceInstancesChanged(serviceId, instances);
            }
        });
        
        pathChildrenCache.start();
    }
    
    public void stopListening() throws Exception {
        if (pathChildrenCache != null) {
            pathChildrenCache.close();
        }
    }
    
    private String extractServiceId(String path) {
        String[] parts = path.split("/");
        return parts.length > 3 ? parts[3] : "";
    }
}

// 服务实例变更监听器接口
interface ServiceInstancesChangeListener {
    void onServiceInstancesChanged(String serviceId, List<ServiceInstance> instances);
}

// 带监听的服务消费者
public class ListeningServiceConsumer extends ZookeeperServiceConsumer {
    private Map<String, ServiceChangeListener> listeners = 
        new java.util.concurrent.ConcurrentHashMap<>();
    
    public ListeningServiceConsumer(ZookeeperRegistryCenter registryCenter) {
        super(registryCenter);
    }
    
    public void watchService(String serviceId, ServiceInstancesChangeListener listener) 
            throws Exception {
        ServiceChangeListener serviceListener = new ServiceChangeListener(
            (ZookeeperRegistryCenter) getRegistryCenter(), serviceId);
        serviceListener.startListening(listener);
        listeners.put(serviceId, serviceListener);
    }
    
    public void unwatchService(String serviceId) throws Exception {
        ServiceChangeListener listener = listeners.remove(serviceId);
        if (listener != null) {
            listener.stopListening();
        }
    }
    
    private Object getRegistryCenter() {
        // 这里需要访问父类的 registryCenter 字段
        return null; // 简化处理
    }
}
```

## 总结

通过本章的学习，我们深入了解了如何使用 ZooKeeper 实现服务注册功能。关键要点包括：

1. **ZooKeeper 基础**：了解了 ZooKeeper 的核心特性和数据模型
2. **客户端实现**：掌握了基于原生 API 和 Curator 框架的客户端实现
3. **服务注册中心**：实现了基于 ZooKeeper 的服务注册中心，支持服务注册、发现和注销
4. **服务提供者**：构建了服务提供者的注册和心跳机制
5. **服务消费者**：实现了服务发现和多种负载均衡策略
6. **高级特性**：实现了服务变更监听机制

ZooKeeper 作为服务注册中心的优势：

1. **高可用性**：通过集群部署实现高可用
2. **一致性**：保证数据的一致性
3. **临时节点**：自动处理服务实例的上下线
4. **监听机制**：支持实时的服务变更通知
5. **成熟稳定**：经过多年生产环境验证

在实际应用中，ZooKeeper 服务注册中心可以与 RPC 框架深度集成，为分布式系统提供可靠的服

务治理能力。通过合理的设计和实现，可以构建出高可用、高性能的微服务架构。