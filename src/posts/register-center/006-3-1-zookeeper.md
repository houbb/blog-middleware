---
title: Zookeeper
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center]
published: true
---

ZooKeeper是Apache的一个开源项目，它是一个分布式的、开源的协调服务，用于维护配置信息、命名、提供分布式同步和组服务。在微服务架构中，ZooKeeper常被用作服务注册中心。

## 数据模型（ZNode）

ZooKeeper的数据模型基于ZNode（ZooKeeper Node）的概念，这是一种层次化的命名空间，类似于文件系统的目录结构：

1. **ZNode类型**：
   - **持久节点（Persistent）**：创建后会一直存在，直到被显式删除
   - **临时节点（Ephemeral）**：与客户端会话绑定，会话结束时自动删除
   - **顺序节点（Sequential）**：创建时会在节点名后自动追加一个单调递增的数字

2. **ZNode结构**：
   ```
   /
   ├── dubbo
   │   ├── com.example.DemoService
   │   │   ├── providers
   │   │   ├── consumers
   │   │   └── configurators
   │   └── com.example.AnotherService
   └── config
       └── app1
   ```

3. **ZNode存储**：
   每个ZNode可以存储数据（最大1MB），同时维护一些元数据，如版本号、ACL信息等。

## 临时节点与 Watch 机制

ZooKeeper的临时节点和Watch机制是其作为服务注册中心的核心特性：

### 临时节点

临时节点是ZooKeeper中一种特殊的节点类型，它与客户端会话绑定。当客户端会话结束（无论是正常关闭还是异常断开），临时节点会自动被删除。这一特性非常适合用于服务注册：

```java
// 服务注册示例
public class ServiceRegistry {
    private ZooKeeper zk;
    private String registryPath = "/dubbo/com.example.DemoService/providers";
    
    public void register(String serviceUrl) throws Exception {
        // 创建临时节点注册服务
        String path = zk.create(registryPath + "/provider-", 
                               serviceUrl.getBytes(), 
                               ZooDefs.Ids.OPEN_ACL_UNSAFE, 
                               CreateMode.EPHEMERAL_SEQUENTIAL);
        System.out.println("Service registered at: " + path);
    }
}
```

### Watch 机制

Watch机制允许客户端在ZNode上设置监听器，当ZNode发生变化时（如节点创建、删除、数据变更），ZooKeeper会通知客户端：

```java
// 服务发现示例
public class ServiceDiscovery {
    private ZooKeeper zk;
    private String servicePath = "/dubbo/com.example.DemoService/providers";
    private List<String> serviceUrls = new ArrayList<>();
    
    public void discoverServices() throws Exception {
        // 获取服务列表并设置监听
        List<String> children = zk.getChildren(servicePath, event -> {
            // 当子节点发生变化时，重新获取服务列表
            if (event.getType() == Watcher.Event.EventType.NodeChildrenChanged) {
                try {
                    updateServiceList();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
        
        // 获取每个服务实例的URL
        updateServiceUrls(children);
    }
    
    private void updateServiceList() throws Exception {
        List<String> children = zk.getChildren(servicePath, true);
        updateServiceUrls(children);
    }
    
    private void updateServiceUrls(List<String> children) throws Exception {
        serviceUrls.clear();
        for (String child : children) {
            byte[] data = zk.getData(servicePath + "/" + child, false, null);
            serviceUrls.add(new String(data));
        }
        System.out.println("Updated service list: " + serviceUrls);
    }
}
```

## 在 Dubbo 中的应用

Dubbo是阿里巴巴开源的一个高性能Java RPC框架，它使用ZooKeeper作为默认的注册中心：

### 服务注册

在Dubbo中，服务提供者启动时会向ZooKeeper注册自己的信息：

```xml
<!-- dubbo-provider.xml -->
<dubbo:application name="demo-provider"/>
<dubbo:registry address="zookeeper://127.0.0.1:2181"/>
<dubbo:protocol name="dubbo" port="20880"/>
<bean id="demoService" class="com.example.DemoServiceImpl"/>
<dubbo:service interface="com.example.DemoService" ref="demoService"/>
```

注册信息在ZooKeeper中的结构如下：
```
/dubbo
  └── com.example.DemoService
       ├── providers
       │    └── dubbo://192.168.1.100:20880/com.example.DemoService?anyhost=true&application=demo-provider
       ├── consumers
       └── configurators
```

### 服务发现

服务消费者启动时会从ZooKeeper获取服务提供者列表：

```xml
<!-- dubbo-consumer.xml -->
<dubbo:application name="demo-consumer"/>
<dubbo:registry address="zookeeper://127.0.0.1:2181"/>
<dubbo:reference id="demoService" interface="com.example.DemoService"/>
```

## 优缺点与痛点

### 优点

1. **高可用性**：ZooKeeper集群通常由奇数个节点组成，能够容忍少数节点故障
2. **强一致性**：使用Zab协议保证数据一致性
3. **成熟稳定**：经过多年大规模生产环境验证
4. **丰富的API**：提供了完整的客户端API

### 缺点

1. **复杂性**：ZooKeeper本身是一个复杂的分布式系统，运维成本较高
2. **性能瓶颈**：所有写操作都需要通过Leader节点，可能成为性能瓶颈
3. **网络分区敏感**：在网络分区情况下，可能影响服务可用性

### 痛点

1. **运维复杂**：需要专门的运维团队维护ZooKeeper集群
2. **资源消耗**：ZooKeeper对内存和网络带宽要求较高
3. **学习成本**：需要深入了解ZooKeeper的内部机制才能正确使用

## 总结

ZooKeeper作为服务注册中心的经典实现，具有强一致性和高可用性的特点。其临时节点和Watch机制非常适合服务注册与发现场景。在Dubbo等RPC框架中得到了广泛应用。然而，随着微服务架构的发展，一些更轻量级的注册中心（如Nacos、Eureka）也逐渐流行起来。