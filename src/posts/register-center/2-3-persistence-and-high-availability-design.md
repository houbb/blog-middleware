---
title: 持久化与高可用设计
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center]
published: true
---

在前两节中，我们分别实现了最小可用的注册中心和配置中心雏形。然而，这些实现都基于内存存储，存在数据丢失的风险。在生产环境中，我们需要考虑数据的持久化和系统的高可用性。本节将探讨如何为注册与配置中心设计持久化和高可用方案。

## 数据持久化到文件/数据库

### 文件持久化

对于简单的场景，我们可以将数据持久化到文件系统中：

```java
// 数据持久化管理器
class PersistenceManager {
    private String dataDir = "./data/";
    
    // 将注册中心数据持久化到文件
    public void persistRegistry(Map<String, List<ServiceInstance>> registry) throws IOException {
        Path path = Paths.get(dataDir, "registry.json");
        String json = new Gson().toJson(registry);
        Files.write(path, json.getBytes(StandardCharsets.UTF_8));
    }
    
    // 从文件恢复注册中心数据
    public Map<String, List<ServiceInstance>> restoreRegistry() throws IOException {
        Path path = Paths.get(dataDir, "registry.json");
        if (Files.exists(path)) {
            String json = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
            Type type = new TypeToken<Map<String, List<ServiceInstance>>>(){}.getType();
            return new Gson().fromJson(json, type);
        }
        return new HashMap<>();
    }
    
    // 将配置中心数据持久化到文件
    public void persistConfig(Map<String, ConfigInfo> configStore) throws IOException {
        Path path = Paths.get(dataDir, "config.json");
        String json = new Gson().toJson(configStore);
        Files.write(path, json.getBytes(StandardCharsets.UTF_8));
    }
    
    // 从文件恢复配置中心数据
    public Map<String, ConfigInfo> restoreConfig() throws IOException {
        Path path = Paths.get(dataDir, "config.json");
        if (Files.exists(path)) {
            String json = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
            Type type = new TypeToken<Map<String, ConfigInfo>>(){}.getType();
            return new Gson().fromJson(json, type);
        }
        return new HashMap<>();
    }
}
```

### 数据库持久化

对于更复杂的场景，我们可以使用数据库进行持久化：

```java
// 数据库持久化管理器
class DatabasePersistenceManager {
    private DataSource dataSource;
    
    public DatabasePersistenceManager(DataSource dataSource) {
        this.dataSource = dataSource;
    }
    
    // 将服务实例信息保存到数据库
    public void saveServiceInstance(ServiceInstance instance) throws SQLException {
        String sql = "INSERT INTO service_instances (service_id, host, port, register_time) VALUES (?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, instance.getServiceId());
            stmt.setString(2, instance.getHost());
            stmt.setInt(3, instance.getPort());
            stmt.setLong(4, instance.getRegisterTime());
            stmt.executeUpdate();
        }
    }
    
    // 从数据库加载服务实例信息
    public List<ServiceInstance> loadServiceInstances(String serviceId) throws SQLException {
        String sql = "SELECT * FROM service_instances WHERE service_id = ?";
        List<ServiceInstance> instances = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, serviceId);
            ResultSet rs = stmt.executeQuery();
            
            while (rs.next()) {
                ServiceInstance instance = new ServiceInstance();
                instance.setServiceId(rs.getString("service_id"));
                instance.setHost(rs.getString("host"));
                instance.setPort(rs.getInt("port"));
                instance.setRegisterTime(rs.getLong("register_time"));
                instances.add(instance);
            }
        }
        
        return instances;
    }
    
    // 将配置信息保存到数据库
    public void saveConfig(ConfigInfo config) throws SQLException {
        String sql = "INSERT INTO config_info (config_id, content, format, version, update_time) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, config.getConfigId());
            stmt.setString(2, config.getContent());
            stmt.setString(3, config.getFormat());
            stmt.setLong(4, config.getVersion());
            stmt.setLong(5, config.getUpdateTime());
            stmt.executeUpdate();
        }
    }
    
    // 从数据库加载配置信息
    public ConfigInfo loadConfig(String configId) throws SQLException {
        String sql = "SELECT * FROM config_info WHERE config_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, configId);
            ResultSet rs = stmt.executeQuery();
            
            if (rs.next()) {
                ConfigInfo config = new ConfigInfo();
                config.setConfigId(rs.getString("config_id"));
                config.setContent(rs.getString("content"));
                config.setFormat(rs.getString("format"));
                config.setVersion(rs.getLong("version"));
                config.setUpdateTime(rs.getLong("update_time"));
                return config;
            }
        }
        return null;
    }
}
```

## 主从同步与副本机制

为了实现高可用性，我们需要设计主从同步和副本机制：

```java
// 主从同步管理器
class ReplicationManager {
    private List<String> replicas; // 副本节点列表
    private boolean isLeader;      // 是否为领导者节点
    
    public ReplicationManager(List<String> replicas, boolean isLeader) {
        this.replicas = replicas;
        this.isLeader = isLeader;
    }
    
    // 同步服务注册信息到副本节点
    public void replicateServiceRegistration(ServiceInstance instance) {
        if (!isLeader) return;
        
        for (String replica : replicas) {
            try {
                // 发送HTTP请求同步数据到副本节点
                OkHttpClient client = new OkHttpClient();
                String url = replica + "/replicate/register";
                
                String json = new Gson().toJson(instance);
                RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
                Request request = new Request.Builder().url(url).post(body).build();
                
                client.newCall(request).execute();
            } catch (IOException e) {
                // 记录日志，但不中断同步过程
                System.err.println("Failed to replicate to " + replica + ": " + e.getMessage());
            }
        }
    }
    
    // 同步配置信息到副本节点
    public void replicateConfigChange(ConfigInfo config) {
        if (!isLeader) return;
        
        for (String replica : replicas) {
            try {
                // 发送HTTP请求同步数据到副本节点
                OkHttpClient client = new OkHttpClient();
                String url = replica + "/replicate/config";
                
                String json = new Gson().toJson(config);
                RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
                Request request = new Request.Builder().url(url).post(body).build();
                
                client.newCall(request).execute();
            } catch (IOException e) {
                // 记录日志，但不中断同步过程
                System.err.println("Failed to replicate config to " + replica + ": " + e.getMessage());
            }
        }
    }
}
```

副本节点需要提供相应的接口来接收同步数据：

```java
// 副本节点的同步接口
public class ReplicaServer {
    private SimpleRegistry registry = new SimpleRegistry();
    private SimpleConfigCenter configCenter = new SimpleConfigCenter();
    
    public void start() {
        // 接收服务注册同步数据
        post("/replicate/register", (req, res) -> {
            String json = req.body();
            ServiceInstance instance = new Gson().fromJson(json, ServiceInstance.class);
            
            // 注册到本地
            registry.register(instance.getServiceId(), instance);
            
            return "Service registered successfully";
        });
        
        // 接收配置同步数据
        post("/replicate/config", (req, res) -> {
            String json = req.body();
            ConfigInfo config = new Gson().fromJson(json, ConfigInfo.class);
            
            // 保存到本地配置中心
            configCenter.saveConfig(config.getConfigId(), config.getContent(), config.getFormat());
            
            return "Config saved successfully";
        });
    }
}
```

## Leader 选举与容错

在分布式系统中，我们需要实现Leader选举机制来确保系统的高可用性：

```java
// Leader选举管理器
class LeaderElectionManager {
    private String currentNodeId;
    private List<String> clusterNodes;
    private volatile boolean isLeader = false;
    private ScheduledExecutorService electionScheduler;
    
    public LeaderElectionManager(String currentNodeId, List<String> clusterNodes) {
        this.currentNodeId = currentNodeId;
        this.clusterNodes = clusterNodes;
        startElection();
    }
    
    // 启动选举过程
    private void startElection() {
        electionScheduler = Executors.newScheduledThreadPool(1);
        electionScheduler.scheduleAtFixedRate(() -> {
            try {
                // 执行选举逻辑
                performElection();
            } catch (Exception e) {
                System.err.println("Election failed: " + e.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS); // 每5秒执行一次选举
    }
    
    // 执行选举
    private void performElection() {
        // 简单的选举算法：选择节点ID最小的作为Leader
        String leaderId = clusterNodes.stream().min(String::compareTo).orElse(currentNodeId);
        
        // 更新Leader状态
        isLeader = currentNodeId.equals(leaderId);
        
        System.out.println("Current node " + currentNodeId + " isLeader: " + isLeader);
    }
    
    // 获取当前节点是否为Leader
    public boolean isLeader() {
        return isLeader;
    }
    
    // 关闭选举
    public void shutdown() {
        if (electionScheduler != null) {
            electionScheduler.shutdown();
        }
    }
}
```

## 总结

通过以上实现，我们为注册与配置中心设计了完整的持久化和高可用方案：

1. **数据持久化**：支持文件系统和数据库两种持久化方式，确保数据不会因服务重启而丢失。
2. **主从同步**：通过主从复制机制，确保数据在多个节点间保持一致。
3. **Leader选举**：实现简单的Leader选举算法，确保在分布式环境中只有一个节点负责写操作。

这些机制共同构成了一个高可用的注册与配置中心系统。在实际生产环境中，还可以进一步优化，如使用更复杂的选举算法（如Raft或Zab）、实现更精细的故障检测和恢复机制等。