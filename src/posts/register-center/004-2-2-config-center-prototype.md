---
title: 配置中心雏形
date: 2025-09-01
categories: [RegisterCenter]
tags: [register-center]
published: true
---

在上一节中，我们实现了一个最小可用的注册中心。现在，我们来构建一个配置中心的雏形，进一步理解配置中心的核心机制。

## JSON/YAML 存储与文件分发

配置中心需要能够存储和管理各种格式的配置信息。我们将使用JSON和YAML两种常见的配置格式来演示：

```java
// 配置信息类
class ConfigInfo {
    private String configId;      // 配置ID
    private String content;       // 配置内容
    private String format;        // 配置格式 (JSON/YAML)
    private long version;         // 配置版本
    private long updateTime;      // 更新时间
    
    // getter和setter方法
}

// 配置中心核心类
class SimpleConfigCenter {
    // 使用ConcurrentHashMap存储配置信息
    private ConcurrentHashMap<String, ConfigInfo> configStore = new ConcurrentHashMap<>();
    
    // 存储配置
    public void saveConfig(String configId, String content, String format) {
        ConfigInfo config = new ConfigInfo();
        config.setConfigId(configId);
        config.setContent(content);
        config.setFormat(format);
        config.setVersion(System.currentTimeMillis());
        config.setUpdateTime(System.currentTimeMillis());
        
        configStore.put(configId, config);
    }
    
    // 获取配置
    public ConfigInfo getConfig(String configId) {
        return configStore.get(configId);
    }
    
    // 删除配置
    public void deleteConfig(String configId) {
        configStore.remove(configId);
    }
}
```

为了支持文件分发，我们需要将配置信息保存到文件中：

```java
class ConfigFileManager {
    private String configDir = "./configs/"; // 配置文件存储目录
    
    // 将配置保存到文件
    public void saveToFile(ConfigInfo config) throws IOException {
        Path path = Paths.get(configDir, config.getConfigId() + "." + config.getFormat().toLowerCase());
        Files.write(path, config.getContent().getBytes(StandardCharsets.UTF_8));
    }
    
    // 从文件读取配置
    public String loadFromFile(String configId, String format) throws IOException {
        Path path = Paths.get(configDir, configId + "." + format.toLowerCase());
        return new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
    }
}
```

## 简单的拉取式配置更新

在配置中心的雏形中，我们实现一个简单的拉取式配置更新机制：

```java
// 配置客户端
class ConfigClient {
    private String configCenterUrl; // 配置中心地址
    private ConcurrentHashMap<String, ConfigInfo> localCache = new ConcurrentHashMap<>();
    
    public ConfigClient(String configCenterUrl) {
        this.configCenterUrl = configCenterUrl;
    }
    
    // 拉取配置
    public ConfigInfo pullConfig(String configId) throws IOException {
        // 构造请求URL
        String url = configCenterUrl + "/config/" + configId;
        
        // 发送HTTP请求获取配置
        OkHttpClient client = new OkHttpClient();
        Request request = new Request.Builder().url(url).build();
        Response response = client.newCall(request).execute();
        
        if (response.isSuccessful()) {
            String json = response.body().string();
            ConfigInfo config = new Gson().fromJson(json, ConfigInfo.class);
            
            // 更新本地缓存
            localCache.put(configId, config);
            
            return config;
        } else {
            throw new IOException("Failed to pull config: " + response.code());
        }
    }
    
    // 获取本地缓存的配置
    public ConfigInfo getLocalConfig(String configId) {
        return localCache.get(configId);
    }
}
```

配置中心服务端提供相应的HTTP接口：

```java
// 配置中心HTTP服务
public class ConfigServer {
    private SimpleConfigCenter configCenter = new SimpleConfigCenter();
    
    public void start() {
        // 保存配置接口
        post("/config", (req, res) -> {
            String configId = req.queryParams("configId");
            String content = req.queryParams("content");
            String format = req.queryParams("format");
            
            configCenter.saveConfig(configId, content, format);
            
            return "Config saved successfully";
        });
        
        // 获取配置接口
        get("/config/:configId", (req, res) -> {
            String configId = req.params(":configId");
            ConfigInfo config = configCenter.getConfig(configId);
            
            if (config != null) {
                return new Gson().toJson(config);
            } else {
                res.status(404);
                return "Config not found";
            }
        });
    }
}
```

## 客户端本地缓存

为了提高性能和系统可靠性，客户端需要实现本地缓存机制：

```java
class ConfigCacheManager {
    private String cacheDir = "./cache/"; // 本地缓存目录
    
    // 将配置保存到本地缓存
    public void saveToCache(ConfigInfo config) throws IOException {
        Path path = Paths.get(cacheDir, config.getConfigId() + ".cache");
        String json = new Gson().toJson(config);
        Files.write(path, json.getBytes(StandardCharsets.UTF_8));
    }
    
    // 从本地缓存加载配置
    public ConfigInfo loadFromCache(String configId) throws IOException {
        Path path = Paths.get(cacheDir, configId + ".cache");
        if (Files.exists(path)) {
            String json = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
            return new Gson().fromJson(json, ConfigInfo.class);
        }
        return null;
    }
    
    // 检查本地缓存是否存在
    public boolean existsInCache(String configId) {
        Path path = Paths.get(cacheDir, configId + ".cache");
        return Files.exists(path);
    }
}
```

更新客户端实现，加入本地缓存支持：

```java
class EnhancedConfigClient {
    private String configCenterUrl;
    private ConfigCacheManager cacheManager = new ConfigCacheManager();
    
    public EnhancedConfigClient(String configCenterUrl) {
        this.configCenterUrl = configCenterUrl;
    }
    
    // 获取配置（优先从本地缓存获取）
    public ConfigInfo getConfig(String configId) throws IOException {
        // 首先尝试从本地缓存获取
        ConfigInfo config = cacheManager.loadFromCache(configId);
        if (config != null) {
            return config;
        }
        
        // 如果本地缓存不存在，则从配置中心拉取
        config = pullConfig(configId);
        
        // 保存到本地缓存
        if (config != null) {
            cacheManager.saveToCache(config);
        }
        
        return config;
    }
    
    // 拉取配置
    private ConfigInfo pullConfig(String configId) throws IOException {
        // 实现与之前相同
        // ...
        return null;
    }
}
```

## 总结

通过以上实现，我们构建了一个配置中心的雏形，具备了以下核心功能：

1. 配置存储：支持JSON和YAML格式的配置存储
2. 文件分发：能够将配置保存到文件系统中
3. 拉取式更新：客户端可以通过HTTP接口拉取配置
4. 本地缓存：客户端实现了本地缓存机制，提高性能和可靠性

虽然这个实现还比较简单，但它涵盖了配置中心的核心功能。在实际生产环境中，还需要考虑更多因素，如配置版本管理、配置推送、安全性、高可用性等。在后续章节中，我们将逐步完善这个配置中心，使其更加健壮和实用。